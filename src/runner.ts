/**
 * Shared export runner used by both the command palette and the studio panel.
 * Handles the save dialog, the chosen exporter, progress UI, and the open/reveal prompt.
 */

import * as vscode from "vscode";
import * as path from "path";
import { DocProfile } from "./profiles";
import { CleanupOptions } from "./cleanup";
import { RenderContext, buildHtml, buildDocxHtml } from "./render";
import { exportPdf } from "./exporters/pdf";
import { exportDocx } from "./exporters/docx";
import { exportHtml } from "./exporters/html";

export type Format = "pdf" | "docx" | "html";

export function todayString(): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function makeContext(filename: string, baseDir: string): RenderContext {
  return { filename, today: todayString(), baseDir };
}

function filterFor(format: Format): { [k: string]: string[] } {
  if (format === "pdf") return { PDF: ["pdf"] };
  if (format === "docx") return { "Word Document": ["docx"] };
  return { HTML: ["html"] };
}

export async function runExport(params: {
  format: Format;
  markdown: string;
  profile: DocProfile;
  cleanup: CleanupOptions;
  ctx: RenderContext;
  defaultPath: string; // suggested path WITHOUT extension
}): Promise<void> {
  const { format, markdown, profile, cleanup, ctx } = params;

  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(params.defaultPath + "." + format),
    filters: filterFor(format),
    saveLabel: `Export ${format.toUpperCase()}`,
  });
  if (!target) return;
  const out = target.fsPath;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `MarkReady: exporting ${format.toUpperCase()}…`,
      },
      async () => {
        if (format === "pdf") {
          const html = buildHtml({ markdown, profile, ctx, cleanup });
          await exportPdf(html, out, profile, ctx);
        } else if (format === "docx") {
          const html = buildDocxHtml({ markdown, profile, ctx, cleanup });
          await exportDocx(html, out, profile);
        } else {
          const html = buildHtml({ markdown, profile, ctx, cleanup });
          await exportHtml(html, out);
        }
      }
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`MarkReady export failed: ${err?.message ?? err}`);
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    `Exported ${path.basename(out)}`,
    "Open",
    "Reveal in Explorer"
  );
  if (choice === "Open") {
    vscode.env.openExternal(vscode.Uri.file(out));
  } else if (choice === "Reveal in Explorer") {
    vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(out));
  }
}
