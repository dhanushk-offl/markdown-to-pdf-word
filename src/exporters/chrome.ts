/**
 * Browser discovery for PDF export. We use puppeteer-core (no bundled Chromium),
 * so we must locate an installed Chrome / Edge / Chromium / Brave on the user's
 * machine. Detection is intentionally thorough so PDF "just works" wherever a
 * Chromium-family browser exists.
 *
 * Resolution order:
 *   1. The explicit `markready.chromePath` setting (passed in).
 *   2. The CHROME_PATH / PUPPETEER_EXECUTABLE_PATH environment variables.
 *   3. Well-known install locations for the current OS.
 *   4. Windows registry "App Paths" (chrome.exe / msedge.exe).
 *   5. PATH lookup via `where` (Windows) / `which` (macOS/Linux).
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";

function isFile(p?: string): boolean {
  if (!p) return false;
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function firstExisting(paths: (string | undefined)[]): string | undefined {
  for (const p of paths) if (isFile(p)) return p;
  return undefined;
}

function windowsCandidates(): string[] {
  const bases = [
    process.env["PROGRAMFILES"],
    process.env["PROGRAMFILES(X86)"],
    process.env["LOCALAPPDATA"],
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ].filter(Boolean) as string[];
  const rel = [
    "Google\\Chrome\\Application\\chrome.exe",
    "Google\\Chrome Beta\\Application\\chrome.exe",
    "Google\\Chrome SxS\\Application\\chrome.exe", // Canary
    "Chromium\\Application\\chrome.exe",
    "Microsoft\\Edge\\Application\\msedge.exe",
    "Microsoft\\Edge Beta\\Application\\msedge.exe",
    "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  ];
  const out: string[] = [];
  for (const base of bases) for (const r of rel) out.push(path.join(base, r));
  return out;
}

function macCandidates(): string[] {
  const home = os.homedir();
  const rel = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Arc.app/Contents/MacOS/Arc",
  ];
  // also check the per-user ~/Applications copies
  return rel.concat(rel.map((p) => path.join(home, p)));
}

function linuxCandidates(): string[] {
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/brave-browser",
    "/snap/bin/chromium",
    "/opt/google/chrome/chrome",
  ];
}

/** Windows-only: read the browser path from the registry "App Paths" keys. */
function fromWindowsRegistry(): string | undefined {
  if (process.platform !== "win32") return undefined;
  const keys = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe",
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe",
  ];
  for (const key of keys) {
    try {
      const out = execFileSync("reg", ["query", key, "/ve"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 4000,
      });
      const m = out.match(/REG_SZ\s+(.+?\.exe)\s*$/im);
      if (m && isFile(m[1].trim())) return m[1].trim();
    } catch {
      /* key missing — keep trying */
    }
  }
  return undefined;
}

/** Last resort: look the browser up on PATH. */
function fromPath(): string | undefined {
  const win = process.platform === "win32";
  const finder = win ? "where" : "which";
  const names = win
    ? ["chrome.exe", "msedge.exe", "chromium.exe", "brave.exe"]
    : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable", "brave-browser"];
  for (const name of names) {
    try {
      const out = execFileSync(finder, [name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 4000,
      });
      const p = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (isFile(p)) return p;
    } catch {
      /* not on PATH — keep trying */
    }
  }
  return undefined;
}

/**
 * Find a usable browser executable, or undefined if none is found.
 * @param configuredPath value of the `markready.chromePath` setting (may be empty)
 */
export function findBrowser(configuredPath?: string): string | undefined {
  const explicit = firstExisting([
    configuredPath?.trim() || undefined,
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ]);
  if (explicit) return explicit;

  const candidates =
    process.platform === "win32"
      ? windowsCandidates()
      : process.platform === "darwin"
      ? macCandidates()
      : linuxCandidates();

  return firstExisting(candidates) || fromWindowsRegistry() || fromPath();
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
