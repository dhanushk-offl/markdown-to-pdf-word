import { describe, it, expect } from "vitest";
import { escapeHtml } from "../src/render";

describe("escapeHtml", () => {
  it("escapes HTML entities", () => {
    expect(escapeHtml(`<script>alert("xss")</script>'`))
      .toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&apos;");
  });

  it("preserves safe strings", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
    expect(escapeHtml("123")).toBe("123");
    expect(escapeHtml("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(escapeHtml(null as any)).toBe("");
    expect(escapeHtml(undefined as any)).toBe("");
  });

  it("strips XML-invalid control characters", () => {
    const input = "a\x00b\x01c\x08d\x0Be\x0Cf\x0Eg\x1Fh";
    const result = escapeHtml(input);
    expect(result).toBe("abcdefgh");
    expect(result).not.toContain("\x00");
  });

  it("preserves valid control characters (tab, LF, CR)", () => {
    const input = "a\tb\nc\rd";
    const result = escapeHtml(input);
    expect(result).toBe("a\tb\nc\rd");
  });

  it("strips surrogate blocks (invalid in XML)", () => {
    // U+D800-U+DFFF are invalid in XML 1.0
    const input = "a\uD800\uDFFFb";
    const result = escapeHtml(input);
    expect(result).toBe("ab");
  });

  it("strips BOM and non-characters", () => {
    const input = "a\uFEFF\uFFFE\uFFFFb";
    const result = escapeHtml(input);
    expect(result).toBe("ab");
  });
});
