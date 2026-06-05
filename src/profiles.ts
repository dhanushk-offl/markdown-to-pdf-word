/**
 * Document Profiles — the customization data model.
 * A profile is plain JSON. The visual studio edits it; the renderer/exporters consume it.
 * Profiles are stored under `<workspace>/.markready/profiles/*.json` so they are
 * reusable and shareable via git.
 */

import * as fs from "fs";
import * as path from "path";

export interface DocProfile {
  name: string;
  cover: {
    enabled: boolean;
    title: string; // supports {{filename}}, {{today}}, {{author}}, {{company}}
    subtitle: string;
    author: string;
    company: string;
    date: string; // e.g. "{{today}}"
    logo: string; // path relative to workspace (or absolute); optional
  };
  branding: {
    primaryColor: string;
    textColor: string;
    fontHeading: string;
    fontBody: string;
    fontSize: string; // e.g. "11pt"
  };
  header: { show: boolean; text: string };
  footer: { pageNumbers: boolean; text: string };
  layout: {
    pageSize: "A4" | "Letter" | "Legal";
    margin: string; // e.g. "2cm"
    orientation: "portrait" | "landscape";
  };
  options: {
    toc: boolean; // insert a Table of Contents built from headings
    tocDepth?: number; // deepest heading level shown in the TOC (1-6, default 3)
    headingNumbers?: boolean; // prefix headings with 1, 1.1, 1.1.2 numbering
    codeTheme?: string; // highlight.js theme name (e.g. "github", "github-dark")
    math?: boolean; // render $...$ / $$...$$ math with KaTeX
    watermark?: string; // optional diagonal watermark text on every page
  };
}

const PROFILES_DIR = ".markready/profiles";

/** Built-in audience presets shipped with the extension. */
export const BUILTIN_PROFILES: DocProfile[] = [
  {
    name: "HR Formal",
    cover: {
      enabled: true,
      title: "{{filename}}",
      subtitle: "",
      author: "{{author}}",
      company: "{{company}}",
      date: "{{today}}",
      logo: "",
    },
    branding: {
      primaryColor: "#1a3d7c",
      textColor: "#1f2933",
      fontHeading: "Georgia, 'Times New Roman', serif",
      fontBody: "Calibri, 'Segoe UI', Arial, sans-serif",
      fontSize: "11pt",
    },
    header: { show: true, text: "Confidential" },
    footer: { pageNumbers: true, text: "" },
    layout: { pageSize: "A4", margin: "2.2cm", orientation: "portrait" },
    options: { toc: false },
  },
  {
    name: "Client Proposal",
    cover: {
      enabled: true,
      title: "{{filename}}",
      subtitle: "Prepared for our valued client",
      author: "{{author}}",
      company: "{{company}}",
      date: "{{today}}",
      logo: "",
    },
    branding: {
      primaryColor: "#0f766e",
      textColor: "#1f2933",
      fontHeading: "'Segoe UI Semibold', 'Helvetica Neue', sans-serif",
      fontBody: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      fontSize: "11pt",
    },
    header: { show: false, text: "" },
    footer: { pageNumbers: true, text: "{{company}}" },
    layout: { pageSize: "A4", margin: "2cm", orientation: "portrait" },
    options: { toc: false },
  },
  {
    name: "Internal Report",
    cover: {
      enabled: false,
      title: "{{filename}}",
      subtitle: "",
      author: "{{author}}",
      company: "{{company}}",
      date: "{{today}}",
      logo: "",
    },
    branding: {
      primaryColor: "#374151",
      textColor: "#111827",
      fontHeading: "'Segoe UI', Arial, sans-serif",
      fontBody: "'Segoe UI', Arial, sans-serif",
      fontSize: "10.5pt",
    },
    header: { show: true, text: "Internal - {{company}}" },
    footer: { pageNumbers: true, text: "" },
    layout: { pageSize: "A4", margin: "1.8cm", orientation: "portrait" },
    options: { toc: true },
  },
  {
    name: "Minimal",
    cover: {
      enabled: false,
      title: "{{filename}}",
      subtitle: "",
      author: "",
      company: "",
      date: "",
      logo: "",
    },
    branding: {
      primaryColor: "#111111",
      textColor: "#222222",
      fontHeading: "Arial, sans-serif",
      fontBody: "Arial, sans-serif",
      fontSize: "11pt",
    },
    header: { show: false, text: "" },
    footer: { pageNumbers: false, text: "" },
    layout: { pageSize: "A4", margin: "2cm", orientation: "portrait" },
    options: { toc: false },
  },
];

export function defaultProfile(): DocProfile {
  return cloneProfile(BUILTIN_PROFILES[0]);
}

export function cloneProfile(p: DocProfile): DocProfile {
  return JSON.parse(JSON.stringify(p));
}

/** Merge a (possibly partial) object onto a complete default so old/partial files still work. */
export function normalizeProfile(raw: any): DocProfile {
  const base = defaultProfile();
  if (!raw || typeof raw !== "object") return base;
  return {
    name: raw.name ?? base.name,
    cover: { ...base.cover, ...(raw.cover || {}) },
    branding: { ...base.branding, ...(raw.branding || {}) },
    header: { ...base.header, ...(raw.header || {}) },
    footer: { ...base.footer, ...(raw.footer || {}) },
    layout: { ...base.layout, ...(raw.layout || {}) },
    options: {
      toc: false,
      tocDepth: 3,
      headingNumbers: false,
      codeTheme: "github",
      math: false,
      watermark: "",
      ...base.options,
      ...(raw.options || {}),
    },
  };
}

/** All available profiles = built-ins overlaid with any saved in the workspace (by name). */
export function loadProfiles(workspaceRoot: string | undefined): DocProfile[] {
  const map = new Map<string, DocProfile>();
  for (const p of BUILTIN_PROFILES) map.set(p.name, cloneProfile(p));

  if (workspaceRoot) {
    const dir = path.join(workspaceRoot, PROFILES_DIR);
    try {
      if (fs.existsSync(dir)) {
        for (const file of fs.readdirSync(dir)) {
          if (!file.toLowerCase().endsWith(".json")) continue;
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
            const prof = normalizeProfile(raw);
            map.set(prof.name, prof);
          } catch {
            /* ignore a single malformed profile */
          }
        }
      }
    } catch {
      /* ignore directory read errors */
    }
  }
  return [...map.values()];
}

export function getProfile(workspaceRoot: string | undefined, name: string): DocProfile {
  const all = loadProfiles(workspaceRoot);
  return all.find((p) => p.name === name) || all[0] || defaultProfile();
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "profile";
}

/** Persist a profile to `<workspace>/.markready/profiles/<slug>.json`. Returns the file path. */
export function saveProfile(workspaceRoot: string, profile: DocProfile): string {
  const dir = path.join(workspaceRoot, PROFILES_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, slugify(profile.name) + ".json");
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), "utf8");
  return file;
}

/** The built-in preset with this name, if any (used by "Reset to preset"). */
export function builtinProfile(name: string): DocProfile | undefined {
  const found = BUILTIN_PROFILES.find((p) => p.name === name);
  return found ? cloneProfile(found) : undefined;
}

/** Delete a saved profile file from the workspace. Returns true if a file was removed. */
export function deleteProfile(workspaceRoot: string, name: string): boolean {
  try {
    const file = path.join(workspaceRoot, PROFILES_DIR, slugify(name) + ".json");
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
