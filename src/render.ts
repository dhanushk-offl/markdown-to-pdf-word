/**
 * Rendering pipeline: clean markdown -> HTML body -> full styled HTML document.
 * One profile drives the CSS, the cover page, and (via exporters) headers/footers.
 * The same function powers both the live preview and the real export => true WYSIWYG.
 */

import MarkdownIt from "markdown-it";
import * as fs from "fs";
import * as path from "path";
import { DocProfile } from "./profiles";
import { cleanMarkdown, CleanupOptions, DEFAULT_CLEANUP } from "./cleanup";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false,
});

export interface RenderContext {
  filename: string;
  today: string;
  baseDir: string; // for resolving the logo path
}

export interface BuildOptions {
  markdown: string;
  profile: DocProfile;
  ctx: RenderContext;
  cleanup?: CleanupOptions;
  includeCover?: boolean;
  /** A small footer note shown only in the on-screen preview (not exported). */
  previewNote?: string;
}

export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolvePlaceholders(s: string, ctx: RenderContext, p: DocProfile): string {
  return (s || "")
    .replace(/\{\{\s*filename\s*\}\}/gi, ctx.filename)
    .replace(/\{\{\s*today\s*\}\}/gi, ctx.today)
    .replace(/\{\{\s*author\s*\}\}/gi, p.cover.author.replace(/\{\{.*?\}\}/g, ""))
    .replace(/\{\{\s*company\s*\}\}/gi, p.cover.company.replace(/\{\{.*?\}\}/g, ""));
}

/** Express a chosen logo path relative to the document's base dir when possible. */
export function makeRelativeLogo(absLogoPath: string, baseDir: string): string {
  try {
    const rel = path.relative(baseDir, absLogoPath);
    // Use the relative form only if it stays within/near the project; else keep absolute.
    if (!rel.startsWith("..") && !path.isAbsolute(rel)) return rel.replace(/\\/g, "/");
    return absLogoPath;
  } catch {
    return absLogoPath;
  }
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "section";
}

interface TocEntry {
  level: number;
  text: string;
  id: string;
}

/**
 * Add stable id="" anchors to rendered headings and collect a Table of Contents.
 * Works on markdown-it output (plain <h1>..<h6> tags).
 */
function addAnchorsAndToc(
  bodyHtml: string,
  minLevel = 1,
  maxLevel = 3
): { html: string; entries: TocEntry[] } {
  const entries: TocEntry[] = [];
  const used: Record<string, number> = {};
  const html = bodyHtml.replace(
    /<h([1-6])>([\s\S]*?)<\/h\1>/g,
    (_m, lvl: string, inner: string) => {
      const level = parseInt(lvl, 10);
      const text = inner.replace(/<[^>]+>/g, "").trim();
      let id = slugify(text);
      if (used[id] !== undefined) {
        used[id] += 1;
        id = `${id}-${used[id]}`;
      } else {
        used[id] = 0;
      }
      if (level >= minLevel && level <= maxLevel && text) {
        entries.push({ level, text, id });
      }
      return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
    }
  );
  return { html, entries };
}

function tocHtmlFrom(entries: TocEntry[]): string {
  if (!entries.length) return "";
  const items = entries
    .map(
      (e) =>
        `<li class="toc-l${e.level}"><a href="#${e.id}">${escapeHtml(e.text)}</a></li>`
    )
    .join("");
  return `<nav class="mr-toc"><div class="mr-toc-title">Contents</div><ul>${items}</ul></nav>`;
}

/** Read the logo file and return a data URI so it embeds cleanly in PDF/HTML/DOCX. */
function logoDataUri(logo: string, baseDir: string): string {
  if (!logo) return "";
  try {
    const abs = path.isAbsolute(logo) ? logo : path.join(baseDir, logo);
    if (!fs.existsSync(abs)) return "";
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime =
      ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext || "png"}`;
    const b64 = fs.readFileSync(abs).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch {
    return "";
  }
}

export function profileToCss(p: DocProfile): string {
  return `
    :root { --mr-primary: ${p.branding.primaryColor}; --mr-text: ${p.branding.textColor}; }
    * { box-sizing: border-box; }
    body {
      font-family: ${p.branding.fontBody};
      font-size: ${p.branding.fontSize};
      color: ${p.branding.textColor};
      line-height: 1.6;
      margin: 0;
    }
    .mr-page { padding: 0; }
    .content { max-width: 100%; }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${p.branding.fontHeading};
      color: ${p.branding.primaryColor};
      line-height: 1.25;
      margin: 1.4em 0 0.5em;
    }
    h1 { font-size: 1.9em; border-bottom: 2px solid var(--mr-primary); padding-bottom: .2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.2em; }
    p { margin: 0.6em 0; }
    a { color: var(--mr-primary); }
    ul, ol { margin: 0.5em 0 0.5em 1.4em; }
    li { margin: 0.25em 0; }
    blockquote {
      margin: 0.8em 0; padding: 0.4em 1em;
      border-left: 4px solid var(--mr-primary);
      background: rgba(0,0,0,0.03); color: #444;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace; font-size: 0.92em;
      background: #f3f4f6; padding: 0.12em 0.35em; border-radius: 4px;
    }
    pre {
      background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 6px;
      padding: 0.9em 1em; overflow: auto; font-size: 0.9em;
    }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.95em; }
    th, td { border: 1px solid #d1d5db; padding: 0.45em 0.7em; text-align: left; }
    th { background: var(--mr-primary); color: #fff; }
    tr:nth-child(even) td { background: #f9fafb; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #d1d5db; margin: 1.4em 0; }
    .page-break { page-break-after: always; }

    /* Table of contents */
    .mr-toc { page-break-after: always; margin-bottom: 1.5em; }
    .mr-toc-title { font-family: ${p.branding.fontHeading}; color: ${p.branding.primaryColor};
      font-size: 1.5em; margin: 0 0 .6em; }
    .mr-toc ul { list-style: none; margin: 0; padding: 0; }
    .mr-toc li { margin: .25em 0; }
    .mr-toc a { text-decoration: none; color: var(--mr-text); }
    .mr-toc .toc-l1 { font-weight: 600; }
    .mr-toc .toc-l2 { padding-left: 1.3em; }
    .mr-toc .toc-l3 { padding-left: 2.6em; font-size: .95em; opacity: .9; }

    /* Cover page */
    .mr-cover {
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; min-height: 92vh; page-break-after: always;
    }
    .mr-cover .mr-logo { max-height: 96px; margin-bottom: 2rem; }
    .mr-cover .mr-title {
      font-family: ${p.branding.fontHeading}; color: ${p.branding.primaryColor};
      font-size: 2.6em; font-weight: 700; margin: 0 0 .3em; border: none;
    }
    .mr-cover .mr-subtitle { font-size: 1.2em; color: #555; margin-bottom: 2.5rem; }
    .mr-cover .mr-meta { font-size: 1em; color: #444; line-height: 1.8; }
    .mr-cover .mr-rule { width: 80px; height: 3px; background: ${p.branding.primaryColor}; margin: 1.2rem auto; }
  `;
}

export function coverHtml(p: DocProfile, ctx: RenderContext): string {
  if (!p.cover.enabled) return "";
  const title = escapeHtml(resolvePlaceholders(p.cover.title, ctx, p));
  const subtitle = escapeHtml(resolvePlaceholders(p.cover.subtitle, ctx, p));
  const author = escapeHtml(resolvePlaceholders(p.cover.author, ctx, p));
  const company = escapeHtml(resolvePlaceholders(p.cover.company, ctx, p));
  const date = escapeHtml(resolvePlaceholders(p.cover.date, ctx, p));
  const logo = logoDataUri(p.cover.logo, ctx.baseDir);

  const meta: string[] = [];
  if (company) meta.push(`<div><strong>${company}</strong></div>`);
  if (author) meta.push(`<div>${author}</div>`);
  if (date) meta.push(`<div>${date}</div>`);

  return `
    <section class="mr-cover">
      ${logo ? `<img class="mr-logo" src="${logo}" alt="logo"/>` : ""}
      <div class="mr-title">${title}</div>
      ${subtitle ? `<div class="mr-subtitle">${subtitle}</div>` : ""}
      <div class="mr-rule"></div>
      <div class="mr-meta">${meta.join("")}</div>
    </section>
  `;
}

/** Build a complete, self-contained HTML document (used for preview and all exporters). */
export function buildHtml(opts: BuildOptions): string {
  const cleanup = opts.cleanup ?? DEFAULT_CLEANUP;
  const cleaned = cleanMarkdown(opts.markdown, cleanup);
  let body = md.render(cleaned);
  let toc = "";
  if (opts.profile.options?.toc) {
    const r = addAnchorsAndToc(body);
    body = r.html;
    toc = tocHtmlFrom(r.entries);
  }
  const cover = opts.includeCover === false ? "" : coverHtml(opts.profile, opts.ctx);
  const previewNote = opts.previewNote
    ? `<div style="position:fixed;bottom:0;left:0;right:0;background:#1a3d7c;color:#fff;font-size:11px;padding:4px 10px;text-align:center;">${escapeHtml(
        opts.previewNote
      )}</div>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.ctx.filename)}</title>
<style>${profileToCss(opts.profile)}</style>
</head>
<body>
<div class="mr-page">
${cover}
${toc}
<main class="content">
${body}
</main>
</div>
${previewNote}
</body>
</html>`;
}

/** HTML for DOCX conversion — html-to-docx ignores most positioning CSS, so keep it simple. */
export function buildDocxHtml(opts: BuildOptions): string {
  const cleanup = opts.cleanup ?? DEFAULT_CLEANUP;
  const cleaned = cleanMarkdown(opts.markdown, cleanup);
  const body = md.render(cleaned);
  const p = opts.profile;

  let toc = "";
  if (p.options?.toc) {
    const r = addAnchorsAndToc(body);
    if (r.entries.length) {
      const items = r.entries
        .map(
          (e) =>
            `<p style="margin:2px 0 2px ${(e.level - 1) * 18}px;">${escapeHtml(e.text)}</p>`
        )
        .join("");
      toc = `<h2 style="color:${p.branding.primaryColor};">Contents</h2>${items}<br clear="all" style="page-break-before:always" />`;
    }
  }

  let cover = "";
  if (opts.includeCover !== false && p.cover.enabled) {
    const title = escapeHtml(resolvePlaceholders(p.cover.title, opts.ctx, p));
    const subtitle = escapeHtml(resolvePlaceholders(p.cover.subtitle, opts.ctx, p));
    const author = escapeHtml(resolvePlaceholders(p.cover.author, opts.ctx, p));
    const company = escapeHtml(resolvePlaceholders(p.cover.company, opts.ctx, p));
    const date = escapeHtml(resolvePlaceholders(p.cover.date, opts.ctx, p));
    cover = `
      <div style="text-align:center;">
        <h1 style="color:${p.branding.primaryColor};font-size:28pt;">${title}</h1>
        ${subtitle ? `<p style="font-size:14pt;color:#555;">${subtitle}</p>` : ""}
        ${company ? `<p style="font-size:12pt;"><strong>${company}</strong></p>` : ""}
        ${author ? `<p style="font-size:12pt;">${author}</p>` : ""}
        ${date ? `<p style="font-size:12pt;">${date}</p>` : ""}
      </div>
      <br clear="all" style="page-break-before:always" />
    `;
  }
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    body { font-family: ${p.branding.fontBody}; color: ${p.branding.textColor}; font-size: ${p.branding.fontSize}; }
    h1,h2,h3,h4 { color: ${p.branding.primaryColor}; }
    table { border-collapse: collapse; }
    th,td { border: 1px solid #999; padding: 4px 8px; }
    th { background: ${p.branding.primaryColor}; color: #fff; }
    code, pre { font-family: Consolas, monospace; background: #f3f4f6; }
  </style></head>
  <body>${cover}${toc}${body}</body></html>`;
}
