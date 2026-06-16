/**
 * Markdown to PDF & Word - entry point. Registers commands and wires the cleanup -> render -> export pipeline.
 */

import * as vscode from "vscode";
import * as path from "path";
import { cleanMarkdown, cleanupFromConfig, CleanupOptions } from "./cleanup";
import { loadProfiles, DocProfile } from "./profiles";
import { makeContext, runExport, Format } from "./runner";
import { gatherFiles } from "./gather";
import { StudioPanel } from "./panel";
import { GatherPanel } from "./gatherPanel";
import {
  AiProviderId,
  AiPolishConfig,
  PROVIDER_META,
} from "./ai/types";
import { validateKey } from "./ai/client";

function cfg() {
  return vscode.workspace.getConfiguration("markready");
}

function getCleanup(): CleanupOptions {
  const c = cfg();
  return cleanupFromConfig((k, d) => c.get<boolean>(k, d));
}

function wsRoot(uri?: vscode.Uri): string | undefined {
  if (uri) {
    const f = vscode.workspace.getWorkspaceFolder(uri);
    if (f) return f.uri.fsPath;
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

interface ActiveMd {
  text: string;
  filename: string;
  baseDir: string;
  fsPath?: string;
}

function activeMarkdown(): ActiveMd | undefined {
  const ed = vscode.window.activeTextEditor;
  if (!ed) return undefined;
  const doc = ed.document;
  if (doc.languageId !== "markdown") return undefined;
  const fsPath = doc.isUntitled ? undefined : doc.uri.fsPath;
  const filename = fsPath
    ? path.basename(fsPath).replace(/\.(md|markdown)$/i, "")
    : "Untitled";
  const baseDir = fsPath ? path.dirname(fsPath) : wsRoot() || process.cwd();
  return { text: doc.getText(), filename, baseDir, fsPath };
}

async function pickProfile(root: string | undefined): Promise<DocProfile | undefined> {
  const profiles = loadProfiles(root);
  const def = cfg().get<string>("defaultProfile", profiles[0]?.name || "");
  const items = profiles.map((p) => ({
    label: p.name,
    description: p.name === def ? "(default)" : "",
    profile: p,
  }));
  const pick = await vscode.window.showQuickPick(items, {
    title: "Markdown to PDF & Word: choose a document profile",
    placeHolder: "Pick the look for your document",
  });
  return pick?.profile;
}

async function quickExport(format: Format) {
  const md = activeMarkdown();
  if (!md) {
    vscode.window.showWarningMessage("Markdown to PDF & Word: open a markdown (.md) file first.");
    return;
  }
  const root = wsRoot(md.fsPath ? vscode.Uri.file(md.fsPath) : undefined);
  const profile = await pickProfile(root);
  if (!profile) return;
  await runExport({
    format,
    markdown: md.text,
    profile,
    cleanup: getCleanup(),
    ctx: makeContext(md.filename, md.baseDir),
    defaultPath: path.join(md.baseDir, md.filename),
    chromePath: cfg().get<string>("chromePath", ""),
  });
}

async function cleanToNewFile() {
  const md = activeMarkdown();
  if (!md) {
    vscode.window.showWarningMessage("Markdown to PDF & Word: open a markdown (.md) file first.");
    return;
  }
  const cleaned = cleanMarkdown(md.text, getCleanup());
  const doc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: cleaned,
  });
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}

function openStudio() {
  const md = activeMarkdown();
  const root = wsRoot(md?.fsPath ? vscode.Uri.file(md.fsPath) : undefined);
  StudioPanel.createOrShow(getContextHolder(), {
    markdown: md?.text ?? SAMPLE_MARKDOWN,
    filename: md?.filename ?? "Sample Document",
    baseDir: md?.baseDir ?? root ?? process.cwd(),
    workspaceRoot: root,
    cleanup: getCleanup(),
    defaultProfileName: cfg().get<string>("defaultProfile", "HR Formal"),
    getAiKey,
  });
}

async function exportFolder(uri?: vscode.Uri) {
  let folder = uri?.fsPath;
  if (!folder) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: "Select a folder of markdown files",
    });
    folder = picked?.[0]?.fsPath;
  }
  if (!folder) return;

  const files = gatherFiles(folder);
  if (!files.length) {
    vscode.window.showWarningMessage("Markdown to PDF & Word: no .md files found in that folder.");
    return;
  }

  const root = wsRoot(vscode.Uri.file(folder));
  GatherPanel.createOrShow(getContextHolder(), {
    folder,
    files,
    workspaceRoot: root,
    cleanup: getCleanup(),
    defaultProfileName: cfg().get<string>("defaultProfile", "HR Formal"),
  });
}

const AI_SECRET_KEYS: Record<AiProviderId, string> = {
  openai: "markready.ai.openai",
  claude: "markready.ai.anthropic",
  gemini: "markready.ai.gemini",
  openrouter: "markready.ai.openrouter",
};

async function getAiKey(provider: AiProviderId): Promise<string | undefined> {
  return _context?.secrets.get(AI_SECRET_KEYS[provider]);
}

async function configureAi(providerArg?: AiProviderId) {
  const provider =
    providerArg ||
    (
      await vscode.window.showQuickPick(
        Object.entries(PROVIDER_META).map(([id, meta]) => ({
          label: meta.label,
          value: id as AiProviderId,
        })),
        { title: "Select AI provider", placeHolder: "Which provider's API key do you want to configure?" }
      )
    )?.value;
  if (!provider) return;

  const key = await vscode.window.showInputBox({
    prompt: `Enter your ${PROVIDER_META[provider].label} API key`,
    password: true,
    placeHolder:
      provider === "openai"
        ? "sk-..."
        : provider === "claude"
          ? "sk-ant-..."
          : provider === "gemini"
            ? "AIza..."
            : "sk-or-...",
    validateInput: (v) => (v?.trim() ? null : "API key cannot be empty"),
    ignoreFocusOut: true,
  });
  if (!key) return;

  try {
    const result = await validateKey(provider, key.trim());
    if (result.valid) {
      await _context!.secrets.store(AI_SECRET_KEYS[provider], key.trim());
      vscode.window.showInformationMessage(
        `${PROVIDER_META[provider].label} key saved. ${result.message}`
      );
    } else {
      const retry = await vscode.window.showErrorMessage(
        `${PROVIDER_META[provider].label} key validation failed: ${result.message}`,
        "Retry",
        "Cancel"
      );
      if (retry === "Retry") configureAi(provider);
    }
  } catch (err: any) {
    const retry = await vscode.window.showErrorMessage(
      `${PROVIDER_META[provider].label} key validation failed: ${err?.message || err}`,
      "Retry",
      "Cancel"
    );
    if (retry === "Retry") configureAi(provider);
  }
}

async function clearAiKeys() {
  const pick = await vscode.window.showWarningMessage(
    "Clear ALL stored AI API keys?",
    { modal: true },
    "Clear All Keys"
  );
  if (pick !== "Clear All Keys") return;
  for (const key of Object.values(AI_SECRET_KEYS)) {
    try {
      await _context?.secrets.delete(key);
    } catch { /* key may not exist */ }
  }
  vscode.window.showInformationMessage("All AI API keys cleared.");
}

async function testAiKey(providerArg?: AiProviderId) {
  const provider =
    providerArg ||
    (
      await vscode.window.showQuickPick(
        Object.entries(PROVIDER_META).map(([id, meta]) => ({
          label: meta.label,
          value: id as AiProviderId,
        })),
        { title: "Test AI API key", placeHolder: "Which provider?" }
      )
    )?.value;
  if (!provider) return;

  const key = await getAiKey(provider);
  if (!key) {
    vscode.window.showWarningMessage(`No API key stored for ${PROVIDER_META[provider].label}. Use "Configure AI Keys" first.`);
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Validating ${PROVIDER_META[provider].label} key…` },
    async () => {
      try {
        const result = await validateKey(provider, key);
        if (result.valid) {
          vscode.window.showInformationMessage(`${PROVIDER_META[provider].label}: ${result.message}`);
        } else {
          vscode.window.showErrorMessage(`${PROVIDER_META[provider].label}: ${result.message}`);
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`${PROVIDER_META[provider].label} validation failed: ${err?.message || err}`);
      }
    }
  );
}

// StudioPanel only needs the extension context for parity with the VS Code API;
// we keep a module-level handle set during activate().
let _context: vscode.ExtensionContext;
function getContextHolder(): vscode.ExtensionContext {
  return _context;
}

export function activate(context: vscode.ExtensionContext) {
  _context = context;
  context.subscriptions.push(
    vscode.commands.registerCommand("markready.exportPdf", () => quickExport("pdf")),
    vscode.commands.registerCommand("markready.exportDocx", () => quickExport("docx")),
    vscode.commands.registerCommand("markready.exportHtml", () => quickExport("html")),
    vscode.commands.registerCommand("markready.cleanToNewFile", cleanToNewFile),
    vscode.commands.registerCommand("markready.openStudio", openStudio),
    vscode.commands.registerCommand("markready.exportFolder", (uri?: vscode.Uri) =>
      exportFolder(uri)
    ),
    vscode.commands.registerCommand("markready.configureAi", () => configureAi()),
    vscode.commands.registerCommand("markready.clearAiKeys", clearAiKeys),
    vscode.commands.registerCommand("markready.testAiKey", () => testAiKey())
  );
}

export function deactivate() {
  /* noop */
}

const SAMPLE_MARKDOWN = `# Sample Document

Certainly! Here's a quick sample so you can see the live preview.

## Overview

This document shows how **Markdown to PDF & Word** renders a clean, branded document from markdown.

- Bullet one
- Bullet two with \`inline code\`
- Bullet three

> A blockquote looks like this.

## Table

| Feature | Status |
|---|---|
| Cleanup | Done |
| Export  | Done |

Let me know if you have any questions!
`;
