/**
 * Tier-1 cleanup engine — "de-AI-ify" markdown using deterministic rules only.
 * No AI, no network, fully offline. This is the product's moat.
 */

export interface CleanupOptions {
  removeChatter: boolean;
  removeEmoji: boolean;
  normalizeHeadings: boolean;
  normalizeWhitespace: boolean;
  normalizePunctuation: boolean;
}

export const DEFAULT_CLEANUP: CleanupOptions = {
  removeChatter: true,
  removeEmoji: true,
  normalizeHeadings: true,
  normalizeWhitespace: true,
  normalizePunctuation: true,
};

/** Broad emoji / pictograph / dingbat / variation-selector ranges. */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{200D}\u{2122}\u{2139}\u{2B05}-\u{2B07}]/gu;

/**
 * STRONG chatter: unambiguous AI greetings / sign-offs. Removed ANYWHERE in the doc
 * (they commonly appear right after the title, not only as the first paragraph).
 */
const STRONG_CHATTER: RegExp[] = [
  /^\s*(certainly|sure|absolutely|of course|great|got it|no problem|here you go|happy to help)\b[!,.:]/i,
  /^\s*(i'?ve|i have|i'?ll|i will)\b.*\b(created|written|prepared|generated|put together|drafted|made)\b/i,
  /\b(i hope this helps|hope this helps|hope that helps)\b/i,
  /^\s*(feel free to|please let me know|let me know if)\b/i,
  /^\s*as an ai\b/i,
];

/**
 * WEAK chatter: framing lines like "Here is the …" / "This document will …".
 * Riskier (a real sentence can look similar), so only removed at the leading/trailing
 * edge of the document, never from the middle.
 */
const WEAK_CHATTER: RegExp[] = [
  /^\s*here('?s| is| are)\b.*[:!]?\s*$/i,
  /^\s*(below|here) (is|are) (the|a|an|your)\b.*[:.]?\s*$/i,
  /^\s*(this (document|guide|report|file) (will|aims to|is designed to))\b/i,
];

/** Inline filler phrases removed even when embedded in an otherwise-kept paragraph. */
const INLINE_FILLER: RegExp[] = [
  /\blet me know if you (have any questions|need anything else|would like[^.!]*)[.!]?/gi,
  /\bfeel free to [^.!]*[.!]?/gi,
  /\bi hope this helps[^.!]*[.!]?/gi,
];

function isStructural(t: string): boolean {
  // headings, lists, quotes, code, tables — never treat as chatter
  return /^[#>\-*\d`|+]/.test(t);
}

function matchesAny(t: string, res: RegExp[]): boolean {
  return res.some((re) => re.test(t));
}

function isStrongChatter(p: string): boolean {
  const t = p.trim();
  if (!t || t.length > 240) return false;
  if (isStructural(t)) return false;
  return matchesAny(t, STRONG_CHATTER);
}

function isWeakChatter(p: string): boolean {
  const t = p.trim();
  if (!t || t.length > 160) return false;
  if (isStructural(t)) return false;
  return matchesAny(t, WEAK_CHATTER);
}

function firstContentIndex(paras: string[]): number {
  for (let i = 0; i < paras.length; i++) {
    const t = paras[i].trim();
    if (t.length > 0 && !t.startsWith("#")) return i;
  }
  return -1;
}

function lastContentIndex(paras: string[]): number {
  for (let i = paras.length - 1; i >= 0; i--) {
    const t = paras[i].trim();
    if (t.length > 0 && !t.startsWith("#")) return i;
  }
  return -1;
}

/**
 * Clean a markdown string. Order matters: punctuation/emoji first (whole text),
 * then paragraph-level chatter removal, then heading + whitespace normalization.
 */
export function cleanMarkdown(input: string, opts: CleanupOptions = DEFAULT_CLEANUP): string {
  let text = (input || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (opts.normalizePunctuation) {
    text = text
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/—/g, "--")
      .replace(/–/g, "-")
      .replace(/…/g, "...")
      .replace(/ /g, " ");
  }

  if (opts.removeEmoji) {
    text = text.replace(EMOJI_RE, "");
    // Tidy "##  Heading" -> "## Heading" and "-  item" -> "- item" after an emoji was removed.
    text = text.replace(/^(#{1,6})\s{2,}/gm, "$1 ");
    text = text.replace(/^(\s*(?:[-*+]|\d+[.)]))\s{2,}/gm, "$1 ");
  }

  if (opts.removeChatter) {
    // 1) Inline filler inside otherwise-kept paragraphs.
    for (const re of INLINE_FILLER) text = text.replace(re, "");

    // 2) Strong greetings/sign-offs: remove anywhere.
    let paras = text.split(/\n{2,}/).filter((p) => !isStrongChatter(p));

    // 3) Weak framing lines: only at the leading / trailing content edge.
    const first = firstContentIndex(paras);
    if (first >= 0 && isWeakChatter(paras[first])) paras.splice(first, 1);
    const last = lastContentIndex(paras);
    if (last >= 0 && isWeakChatter(paras[last])) paras.splice(last, 1);

    text = paras.join("\n\n");
  }

  if (opts.normalizeHeadings) {
    // Ensure exactly one space after the leading hashes.
    text = text.replace(/^(#{1,6})\s*/gm, "$1 ");
  }

  if (opts.normalizeWhitespace) {
    text = text
      .split("\n")
      .map((l) => l.replace(/[ \t]+$/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    text += "\n";
  }

  return text;
}

/** Read cleanup options from VS Code settings, falling back to defaults. */
export function cleanupFromConfig(get: (key: string, def: boolean) => boolean): CleanupOptions {
  return {
    removeChatter: get("cleanup.removeChatter", true),
    removeEmoji: get("cleanup.removeEmoji", true),
    normalizeHeadings: get("cleanup.normalizeHeadings", true),
    normalizeWhitespace: get("cleanup.normalizeWhitespace", true),
    normalizePunctuation: get("cleanup.normalizePunctuation", true),
  };
}
