/**
 * Optional production bundler. Bundles the extension's own source into a single
 * out/extension.js to cut file count / load time. Native and asset-providing
 * dependencies are kept external (still shipped in node_modules) because they
 * use dynamic requires or are read from disk at runtime (e.g. highlight.js /
 * katex CSS, puppeteer-core, html-to-docx).
 *
 * Usage:  npm run bundle
 * Note:   `npm run compile` (tsc) remains the default verified build used by
 *         `vscode:prepublish`. Switch prepublish to this only after validating
 *         the bundle in the Extension Development Host.
 */
const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    platform: "node",
    target: "node18",
    format: "cjs",
    sourcemap: true,
    minify: true,
    external: [
      "vscode",
      "puppeteer-core",
      "html-to-docx",
      "highlight.js",
      "katex",
      "gray-matter",
      "markdown-it",
      "markdown-it-footnote",
      "markdown-it-task-lists",
      "markdown-it-katex",
    ],
    logLevel: "info",
  })
  .catch(() => process.exit(1));
