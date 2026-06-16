/**
 * Rendering pipeline: clean markdown -> HTML body -> full styled HTML document.
 * One profile drives the CSS, the cover page, and (via exporters) headers/footers.
 * The same function powers both the live preview and the real export => true WYSIWYG.
 */

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import * as fs from "fs";
import * as path from "path";
import { DocProfile } from "./profiles";
import { cleanMarkdown, CleanupOptions, DEFAULT_CLEANUP } from "./cleanup";

// gray-matter has no bundled ESM default that plays with our config; require it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const matter = require("gray-matter");

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Page pixel dimensions at 96dpi, accounting for orientation. */
export function pageDimsPx(p: DocProfile): { w: number; h: number } {
  const base: Record<string, [number, number]> = { A4: [794, 1123], Letter: [816, 1056], Legal: [816, 1344] };
  let [w, h] = base[p.layout.pageSize] || base.A4;
  if (p.layout.orientation === "landscape") {
    const t = w;
    w = h;
    h = t;
  }
  return { w, h };
}

/** Convert a CSS length (cm/mm/in/pt/px) to pixels at 96dpi. */
export function cssLenToPx(v: string): number {
  const m = String(v || "").trim().match(/^([\d.]+)\s*(cm|mm|in|pt|px)?$/i);
  if (!m) return 38;
  const n = parseFloat(m[1]);
  const factor: Record<string, number> = { cm: 37.7952755906, mm: 3.7795275591, in: 96, pt: 1.3333333, px: 1 };
  return n * (factor[(m[2] || "px").toLowerCase()] || 1);
}

/** Syntax-highlight a fenced code block with highlight.js (returns a full <pre>). */
function highlight(str: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return (
        '<pre class="hljs"><code>' +
        hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
        "</code></pre>"
      );
    } catch {
      /* fall through */
    }
  }
  return '<pre class="hljs"><code>' + escapeHtml(str) + "</code></pre>";
}

/** Attach an optional markdown-it plugin; never throw if it is unavailable. */
function tryUse(inst: MarkdownIt, moduleName: string, ...args: any[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(moduleName);
    inst.use(mod && mod.default ? mod.default : mod, ...args);
  } catch {
    /* optional plugin not installed / incompatible — skip silently */
  }
}

function buildMdInstance(withMath: boolean): MarkdownIt {
  const inst = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
    highlight,
  });
  tryUse(inst, "markdown-it-footnote");
  tryUse(inst, "markdown-it-task-lists", { enabled: true, label: true });
  if (withMath) tryUse(inst, "markdown-it-katex", { throwOnError: false, errorColor: "#cc0000" });
  return inst;
}

let _md: MarkdownIt | undefined;
let _mdMath: MarkdownIt | undefined;
function getMd(withMath: boolean): MarkdownIt {
  if (withMath) return (_mdMath = _mdMath || buildMdInstance(true));
  return (_md = _md || buildMdInstance(false));
}

export interface RenderContext {
  filename: string;
  today: string;
  baseDir: string; // for resolving the logo path
  front?: Record<string, string>; // values parsed from YAML front matter
}

export interface BuildOptions {
  markdown: string;
  profile: DocProfile;
  ctx: RenderContext;
  cleanup?: CleanupOptions;
  includeCover?: boolean;
  /** A small footer note shown only in the on-screen preview (not exported). */
  previewNote?: string;
  /**
   * Optional async AI polish step. Called with cleaned markdown; must handle
   * its own errors and return the original on failure.
   */
  polishMarkdown?: (md: string) => Promise<string>;
}

export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolvePlaceholders(s: string, ctx: RenderContext, p: DocProfile): string {
  const fm = ctx.front || {};
  const pick = (key: string, fallback: string) => {
    const v = fm[key];
    return v != null && String(v).trim() ? String(v) : fallback;
  };
  const authorDefault = p.cover.author.replace(/\{\{.*?\}\}/g, "");
  const companyDefault = p.cover.company.replace(/\{\{.*?\}\}/g, "");
  return (s || "")
    .replace(/\{\{\s*filename\s*\}\}/gi, ctx.filename)
    .replace(/\{\{\s*today\s*\}\}/gi, ctx.today)
    .replace(/\{\{\s*title\s*\}\}/gi, pick("title", ctx.filename))
    .replace(/\{\{\s*subtitle\s*\}\}/gi, pick("subtitle", ""))
    .replace(/\{\{\s*author\s*\}\}/gi, pick("author", authorDefault))
    .replace(/\{\{\s*company\s*\}\}/gi, pick("company", companyDefault))
    .replace(/\{\{\s*date\s*\}\}/gi, pick("date", ctx.today));
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
  return (
    (s || "")
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/&[a-z]+;/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

interface TocEntry {
  level: number;
  text: string;
  id: string;
}

/**
 * Add stable id="" anchors to rendered headings, optionally prefix hierarchical
 * numbers (1, 1.1, 1.1.2), and collect Table-of-Contents entries up to maxLevel.
 */
function addAnchorsAndToc(
  bodyHtml: string,
  opts: { minLevel?: number; maxLevel?: number; number?: boolean } = {}
): { html: string; entries: TocEntry[] } {
  const minLevel = opts.minLevel ?? 1;
  const maxLevel = opts.maxLevel ?? 3;
  const number = !!opts.number;
  const entries: TocEntry[] = [];
  const used: Record<string, number> = {};
  const counters = [0, 0, 0, 0, 0, 0];

  const html = bodyHtml.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (_m, lvl: string, attrs: string, inner: string) => {
      const level = parseInt(lvl, 10);
      let prefix = "";
      if (number) {
        counters[level - 1] += 1;
        for (let i = level; i < 6; i++) counters[i] = 0;
        prefix = counters.slice(0, level).join(".") + " ";
      }
      const text = inner.replace(/<[^>]+>/g, "").trim();
      let id = slugify(text);
      if (used[id] !== undefined) {
        used[id] += 1;
        id = `${id}-${used[id]}`;
      } else {
        used[id] = 0;
      }
      if (level >= minLevel && level <= maxLevel && text) {
        entries.push({ level, text: prefix + text, id });
      }
      const innerOut = number ? `<span class="mr-h-num">${prefix}</span>${inner}` : inner;
      return `<h${lvl}${attrs} id="${id}">${innerOut}</h${lvl}>`;
    }
  );
  return { html, entries };
}

function tocHtmlFrom(entries: TocEntry[]): string {
  if (!entries.length) return "";
  const items = entries
    .map((e) => `<li class="toc-l${e.level}"><a href="#${e.id}">${escapeHtml(e.text)}</a></li>`)
    .join("");
  return `<nav class="mr-toc"><div class="mr-toc-title">Contents</div><ul>${items}</ul></nav>`;
}

/** Read a local image file and return a data URI, or "" if it cannot be read. */
function fileToDataUri(src: string, baseDir: string): string {
  if (!src) return "";
  try {
    const abs = path.isAbsolute(src) ? src : path.join(baseDir, src);
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

/** Read the logo file and return a data URI so it embeds cleanly in PDF/HTML/DOCX. */
function logoDataUri(logo: string, baseDir: string): string {
  return fileToDataUri(logo, baseDir);
}

/**
 * Inline local <img> sources as data URIs so images survive PDF/DOCX export and
 * make the HTML self-contained. Absolute http(s)/data URLs are left untouched.
 */
export function embedLocalImages(html: string, baseDir: string): string {
  return html.replace(/(<img\b[^>]*?\bsrc=")([^"]+)("[^>]*>)/gi, (m, pre, src, post) => {
    const s = src.trim();
    if (/^(https?:|data:|file:)/i.test(s)) return m;
    const decoded = decodeURIComponent(s.replace(/^\.\//, ""));
    const uri = fileToDataUri(decoded, baseDir);
    return uri ? `${pre}${uri}${post}` : m;
  });
}

// ---- Bundled stylesheet assets (highlight.js theme + KaTeX), read once. ----
const _cssCache: Record<string, string> = {};
function pkgCss(rel: string): string {
  if (rel in _cssCache) return _cssCache[rel];
  let css = "";
  try {
    css = fs.readFileSync(require.resolve(rel), "utf8");
  } catch {
    css = "";
  }
  _cssCache[rel] = css;
  return css;
}

/** Extra CSS pulled from dependencies: code theme (+ KaTeX when math is on). */
export function assetCss(p: DocProfile): string {
  const theme = String(p.options?.codeTheme || "github").replace(/[^a-z0-9-]/gi, "") || "github";
  let css = pkgCss(`highlight.js/styles/${theme}.css`) || pkgCss("highlight.js/styles/github.css");
  if (p.options?.math) css += "\n" + pkgCss("katex/dist/katex.min.css");
  return css;
}

/** Parse and strip YAML front matter; expose scalar values for placeholders. */
function frontMatter(markdown: string): { data: Record<string, string>; content: string } {
  try {
    const parsed = matter(markdown || "");
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.data || {})) {
      if (v == null || typeof v === "object") continue;
      data[k.toLowerCase()] = String(v);
    }
    return { data, content: parsed.content };
  } catch {
    return { data: {}, content: markdown || "" };
  }
}

/** Shared body render: front matter -> cleanup -> [AI polish] -> markdown-it -> images/TOC/numbering. */
async function renderBody(opts: BuildOptions): Promise<{ body: string; entries: TocEntry[]; ctx: RenderContext }> {
  const cleanup = opts.cleanup ?? DEFAULT_CLEANUP;
  const fm = frontMatter(opts.markdown);
  const ctx: RenderContext = { ...opts.ctx, front: { ...(opts.ctx.front || {}), ...fm.data } };
  let content = cleanMarkdown(fm.content, cleanup);
  if (opts.polishMarkdown) {
    content = await opts.polishMarkdown(content);
  }
  const o = opts.profile.options || ({} as DocProfile["options"]);
  const inst = getMd(!!o.math);
  let body = embedLocalImages(inst.render(content), ctx.baseDir);
  let entries: TocEntry[] = [];
  if (o.toc || o.headingNumbers) {
    const r = addAnchorsAndToc(body, {
      maxLevel: clamp(o.tocDepth ?? 3, 1, 6),
      number: !!o.headingNumbers,
    });
    body = r.html;
    entries = r.entries;
  }
  return { body, entries, ctx };
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
    .mr-h-num { opacity: .75; margin-right: .4em; font-variant-numeric: tabular-nums; }
    p { margin: 0.6em 0; }
    a { color: var(--mr-primary); }
    ul, ol { margin: 0.5em 0 0.5em 1.4em; }
    li { margin: 0.25em 0; }
    ul.contains-task-list { list-style: none; margin-left: 0.6em; }
    .task-list-item input { margin-right: .5em; }
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
    pre code, pre.hljs code { background: none; padding: 0; }
    pre.hljs { background: #f6f8fa; }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.95em; }
    th, td { border: 1px solid #d1d5db; padding: 0.45em 0.7em; text-align: left; }
    th { background: var(--mr-primary); color: #fff; }
    tr:nth-child(even) td { background: #f9fafb; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #d1d5db; margin: 1.4em 0; }
    .page-break { page-break-after: always; }
    .footnotes { font-size: .9em; color: #555; border-top: 1px solid #e5e7eb; margin-top: 2em; }

    /* Watermark (repeats on every printed page) */
    .mr-watermark {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg);
      font-size: 5em; font-weight: 800; color: ${p.branding.primaryColor};
      opacity: 0.07; pointer-events: none; z-index: 0; white-space: nowrap;
    }

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
    .mr-toc .toc-l4 { padding-left: 3.9em; font-size: .92em; opacity: .85; }
    .mr-toc .toc-l5, .mr-toc .toc-l6 { padding-left: 5.2em; font-size: .9em; opacity: .8; }

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
export async function buildHtml(opts: BuildOptions): Promise<string> {
  const { body, entries, ctx } = await renderBody(opts);
  const p = opts.profile;
  const o = p.options || ({} as DocProfile["options"]);
  const toc = o.toc ? tocHtmlFrom(entries) : "";
  const cover = opts.includeCover === false ? "" : coverHtml(p, ctx);
  const wm = String(o.watermark || "").trim();
  const watermark = wm ? `<div class="mr-watermark">${escapeHtml(wm)}</div>` : "";

  // Preview-only chrome: simulate page margins + header/footer bands so the
  // on-screen sheet matches what the PDF will look like.
  const previewMode = !!opts.previewNote;
  let previewCss = "";
  let headerBand = "";
  let footerBand = "";
  if (previewMode) {
    // Use the real page geometry (in px) so the preview sheet has the exact A4/
    // Letter/Legal proportions, and the cover fills exactly one page (its 92vh
    // would otherwise resolve against the auto-height iframe and stretch the sheet).
    const { h: pageH } = pageDimsPx(p);
    const mpx = cssLenToPx(p.layout.margin);
    const contentH = Math.max(200, Math.round(pageH - 2 * mpx));
    previewCss = `html { height:100%; background:#fff; }
      body { min-height:100%; background:#fff; }
      .mr-page { padding: ${p.layout.margin}; position:relative; min-height:${contentH}px; }
      .mr-cover { min-height:${contentH}px !important; }
      /* faint guide line at each page boundary */
      body {
        background-image: repeating-linear-gradient(to bottom,
          transparent 0, transparent ${pageH - 1}px,
          rgba(0,0,0,.16) ${pageH - 1}px, rgba(0,0,0,.16) ${pageH}px);
      }
      .mr-pv-header, .mr-pv-footer { color:#888; font-size:9px; padding:6px 0;
        display:flex; justify-content:space-between; }
      .mr-pv-header { border-bottom:1px solid #eee; margin-bottom:8px; }
      .mr-pv-footer { border-top:1px solid #eee; margin-top:14px; }`;
    if (p.header.show) {
      const ht = escapeHtml(resolvePlaceholders(p.header.text, ctx, p));
      headerBand = `<div class="mr-pv-header"><span>${ht}</span><span></span></div>`;
    }
    if (p.footer.pageNumbers || (p.footer.text && p.footer.text.trim())) {
      const ft = escapeHtml(resolvePlaceholders(p.footer.text, ctx, p));
      const pn = p.footer.pageNumbers ? "Page 1" : "";
      footerBand = `<div class="mr-pv-footer"><span>${ft}</span><span>${pn}</span></div>`;
    }
  }

  const previewNote = opts.previewNote
    ? `<div style="position:fixed;bottom:0;left:0;right:0;background:#1a3d7c;color:#fff;font-size:11px;padding:4px 10px;text-align:center;z-index:5;">${escapeHtml(
        opts.previewNote
      )}</div>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(ctx.filename)}</title>
<style>${profileToCss(p)}</style>
<style>${assetCss(p)}</style>
<style>${previewCss}</style>
</head>
<body>
${watermark}
<div class="mr-page">
${headerBand}
${cover}
${toc}
<main class="content">
${body}
</main>
${footerBand}
</div>
${previewNote}
</body>
</html>`;
}

/** HTML for DOCX conversion — html-to-docx ignores most positioning CSS, so keep it simple. */
export async function buildDocxHtml(opts: BuildOptions): Promise<string> {
  const { body, entries, ctx } = await renderBody(opts);
  const p = opts.profile;
  const o = p.options || ({} as DocProfile["options"]);

  let toc = "";
  if (o.toc && entries.length) {
    const items = entries
      .map(
        (e) => `<p style="margin:2px 0 2px ${(e.level - 1) * 18}px;">${escapeHtml(e.text)}</p>`
      )
      .join("");
    toc = `<h2 style="color:${p.branding.primaryColor};">Contents</h2>${items}<br clear="all" style="page-break-before:always" />`;
  }

  let cover = "";
  if (opts.includeCover !== false && p.cover.enabled) {
    const title = escapeHtml(resolvePlaceholders(p.cover.title, ctx, p));
    const subtitle = escapeHtml(resolvePlaceholders(p.cover.subtitle, ctx, p));
    const author = escapeHtml(resolvePlaceholders(p.cover.author, ctx, p));
    const company = escapeHtml(resolvePlaceholders(p.cover.company, ctx, p));
    const date = escapeHtml(resolvePlaceholders(p.cover.date, ctx, p));
    const logo = logoDataUri(p.cover.logo, ctx.baseDir);
    cover = `
      <div style="text-align:center;">
        ${logo ? `<p style="text-align:center;"><img src="${logo}" style="max-height:120px;" alt="logo"/></p>` : ""}
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
