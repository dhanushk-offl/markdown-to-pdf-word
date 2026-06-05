import { describe, it, expect } from "vitest";
import { cleanMarkdown, DEFAULT_CLEANUP } from "../src/cleanup";

describe("cleanup: de-AI-ify", () => {
  it("removes a strong AI greeting at the top", () => {
    const out = cleanMarkdown("Certainly! Here's your report.\n\n# Title\n\nBody.", DEFAULT_CLEANUP);
    expect(out).not.toMatch(/Certainly/i);
    expect(out).toMatch(/# Title/);
    expect(out).toMatch(/Body\./);
  });

  it("removes trailing 'let me know' sign-off", () => {
    const out = cleanMarkdown("# T\n\nReal content.\n\nLet me know if you have any questions!", DEFAULT_CLEANUP);
    expect(out).not.toMatch(/let me know/i);
    expect(out).toMatch(/Real content\./);
  });

  it("strips emoji from headings and text", () => {
    const out = cleanMarkdown("## 🚀 Launch\n\nGo 🎉 now", DEFAULT_CLEANUP);
    expect(out).toMatch(/## Launch/);
    expect(out).not.toMatch(/🚀|🎉/);
  });

  it("normalizes heading spacing", () => {
    const out = cleanMarkdown("##Heading\n\ntext", DEFAULT_CLEANUP);
    expect(out).toMatch(/## Heading/);
  });

  it("converts smart punctuation to ASCII", () => {
    const out = cleanMarkdown("“Hello” — it’s fine…", DEFAULT_CLEANUP);
    expect(out).toContain('"Hello"');
    expect(out).toContain("it's fine...");
  });

  it("collapses 3+ blank lines to a single blank line", () => {
    const out = cleanMarkdown("a\n\n\n\n\nb", DEFAULT_CLEANUP);
    expect(out).toBe("a\n\nb\n");
  });
});

describe("cleanup: never deletes real content (the invariant)", () => {
  it("keeps lists, code fences, tables and quotes intact", () => {
    const src = [
      "# Doc",
      "",
      "- item one",
      "- item two",
      "",
      "> a quote",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
    ].join("\n");
    const out = cleanMarkdown(src, DEFAULT_CLEANUP);
    expect(out).toMatch(/- item one/);
    expect(out).toMatch(/- item two/);
    expect(out).toMatch(/> a quote/);
    expect(out).toMatch(/const x = 1;/);
    expect(out).toMatch(/\| 1 \| 2 \|/);
  });

  it("does not remove a normal sentence that merely starts with 'Here'", () => {
    const src = "# T\n\nHere we analyze the results in detail and report findings.";
    const out = cleanMarkdown(src, DEFAULT_CLEANUP);
    expect(out).toMatch(/Here we analyze the results/);
  });

  it("is a no-op-safe on empty input", () => {
    expect(cleanMarkdown("", DEFAULT_CLEANUP)).toMatch(/^\s*$/);
  });
});
