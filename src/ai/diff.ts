import { diffLines, Change } from "diff";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  value: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export function computeDiff(original: string, polished: string): DiffLine[] {
  const changes: Change[] = diffLines(original, polished);
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const count = (change.value.match(/\n/g) || []).length;
    if (change.added) {
      lines.push({ type: "added", value: change.value, lineNumberNew: newLine });
      newLine += count;
    } else if (change.removed) {
      lines.push({ type: "removed", value: change.value, lineNumberOld: oldLine });
      oldLine += count;
    } else {
      lines.push({
        type: "unchanged",
        value: change.value,
        lineNumberOld: oldLine,
        lineNumberNew: newLine,
      });
      oldLine += count;
      newLine += count;
    }
  }

  return lines;
}

export function diffStats(lines: DiffLine[]): { changed: number; added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "added") added++;
    if (l.type === "removed") removed++;
  }
  return { changed: added + removed, added, removed };
}
