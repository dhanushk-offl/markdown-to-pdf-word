/**
 * Folder gather: collect all `.md` files under a folder (recursively) and
 * combine them into a single markdown string with page breaks between documents.
 */

import * as fs from "fs";
import * as path from "path";

const SKIP_DIRS = new Set(["node_modules", ".git", ".markready", "out", "dist", ".vscode"]);

export interface GatheredFile {
  file: string;
  rel: string;
  content: string;
}

function walk(dir: string, root: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, root, acc);
    } else if (e.isFile() && /\.(md|markdown)$/i.test(e.name)) {
      acc.push(full);
    }
  }
}

/** Natural sort so "2-foo.md" comes before "10-foo.md". */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function gatherFiles(folder: string): GatheredFile[] {
  const found: string[] = [];
  walk(folder, folder, found);
  found.sort(naturalCompare);
  return found.map((file) => ({
    file,
    rel: path.relative(folder, file).replace(/\\/g, "/"),
    content: safeRead(file),
  }));
}

function safeRead(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function titleFromName(rel: string): string {
  const base = rel.replace(/\.(md|markdown)$/i, "");
  const last = base.split("/").pop() || base;
  return last
    .replace(/[-_]+/g, " ")
    .replace(/^\d+[\s.)-]*/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Combine gathered files into one markdown document.
 * @param addSectionTitles prefix each file with an H1 derived from its name
 * @param pageBreaks insert a page break between files
 */
export function combineMarkdown(
  files: GatheredFile[],
  opts: { addSectionTitles?: boolean; pageBreaks?: boolean } = {}
): string {
  const { addSectionTitles = true, pageBreaks = true } = opts;
  const parts: string[] = [];
  files.forEach((f, i) => {
    if (i > 0 && pageBreaks) parts.push('\n\n<div class="page-break"></div>\n\n');
    if (addSectionTitles) parts.push(`# ${titleFromName(f.rel)}\n`);
    parts.push(f.content.trim());
  });
  return parts.join("\n\n");
}
