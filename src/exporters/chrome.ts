/**
 * Browser discovery for PDF export. We use puppeteer-core (no bundled Chromium),
 * so we must locate an installed Chrome / Edge / Chromium on the user's machine.
 *
 * Resolution order:
 *   1. The explicit `markready.chromePath` setting (passed in).
 *   2. The CHROME_PATH environment variable.
 *   3. Well-known install locations for the current OS.
 */

import * as fs from "fs";
import * as path from "path";

function existing(paths: (string | undefined)[]): string | undefined {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function windowsCandidates(): string[] {
  const envs = [
    process.env["PROGRAMFILES"],
    process.env["PROGRAMFILES(X86)"],
    process.env["LOCALAPPDATA"],
  ].filter(Boolean) as string[];
  const rel = [
    "Google\\Chrome\\Application\\chrome.exe",
    "Google\\Chrome Beta\\Application\\chrome.exe",
    "Chromium\\Application\\chrome.exe",
    "Microsoft\\Edge\\Application\\msedge.exe",
    "Microsoft\\Edge Beta\\Application\\msedge.exe",
  ];
  const out: string[] = [];
  for (const base of envs) for (const r of rel) out.push(path.join(base, r));
  return out;
}

function macCandidates(): string[] {
  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
}

function linuxCandidates(): string[] {
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    "/snap/bin/chromium",
  ];
}

/**
 * Find a usable browser executable, or undefined if none is found.
 * @param configuredPath value of the `markready.chromePath` setting (may be empty)
 */
export function findBrowser(configuredPath?: string): string | undefined {
  const explicit = existing([configuredPath?.trim() || undefined, process.env.CHROME_PATH]);
  if (explicit) return explicit;

  const platform = process.platform;
  const candidates =
    platform === "win32"
      ? windowsCandidates()
      : platform === "darwin"
      ? macCandidates()
      : linuxCandidates();

  return existing(candidates);
}

/** Thrown when no browser could be located, with a user-friendly message. */
export class NoBrowserError extends Error {
  constructor() {
    super(
      "No Chrome, Edge, or Chromium browser was found for PDF export. " +
        "Install Google Chrome or Microsoft Edge, or set the 'markready.chromePath' " +
        "setting to your browser executable. (Word and HTML export do not need a browser.)"
    );
    this.name = "NoBrowserError";
  }
}
