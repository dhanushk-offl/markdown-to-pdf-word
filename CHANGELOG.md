# Changelog

## 1.3.0

### 🎉 AI Tone Polish
- **Four supported providers:** OpenAI (GPT-4o-mini), Claude (Haiku), Google Gemini (Flash),
  and OpenRouter (multi-model gateway) — bring your own API key
- **Inline diff review:** see exactly what changed before applying — green for additions,
  red for removals, with line numbers and change stats
- **Apply / Discard:** accept or reject the polished result; discarded changes leave your
  original markdown untouched
- **Secure key storage:** API keys stored in VS Code's secret storage — never in profiles,
  settings, logs, or files
- **Configurable:** provider, model, system prompt, and temperature (0.0–1.0) per profile
- **Editable system prompt** with one-click reset to the carefully crafted default
- **Model browser:** fetch available models from any provider and pick from a dropdown
- **Key management:** configure, test, and clear API keys via commands or the studio
- **Polish during export:** when enabled, polish is applied transparently during PDF/DOCX/HTML export
- **Provider badges** in README: OpenAI, Claude, Gemini, OpenRouter

### 🧹 Other Improvements
- **Form validation** for margin and font-size fields with visual error states
- **Color picker** sync between text input and native browser color picker
- **Color swatches** for quick brand-color selection (8 pre-defined swatches)
- **Contribution guidelines** (CONTRIBUTING.md) with full dev setup and coding standards
- **Code of Conduct** (CODE_OF_CONDUCT.md) — Contributor Covenant v2.1
- **Documentation overhaul:** README now includes AI feature docs, provider badges with
  branded shields.io badges, star-history graph, improved layout, and clearer navigation
- **Preview zoom reliability fix:** zooming in/out no longer clips the page

### 🔑 AI key validation fixes
- **Claude:** an invalid/expired Anthropic key is now correctly reported as invalid. Previously
  `validateKey` leaned on `listModels`, which fell back to a hardcoded model list on a 401 and
  reported *any* key as valid.
- **Gemini:** a bad key (which Google returns as HTTP 400 "API key not valid") now shows a clean
  "Invalid API key" message instead of a raw HTTP error dump.
- Added regression tests (mocked HTTP) covering invalid-key handling for all providers.

## 1.2.3

- **Preview zoom no longer clips the page**: zooming in or out used CSS `zoom` on the preview
  iframe, which is unreliable inside the VS Code webview (the iframe box scaled but its content
  viewport did not, so the fixed-width sheet and its content diverged and the page got cut off
  at any non-100% zoom). The preview now scales with `transform: scale` and reserves the scaled
  box in a wrapper, so the page keeps its true proportions and stays centered at every zoom level.

## 1.2.2

- **PDF "no browser found" fixed**: browser auto-detection is now far more thorough —
  hardcoded standard install paths (so Edge, present on every Windows PC, is always found),
  the Windows registry "App Paths", a `where`/`which` PATH lookup, more locations on
  macOS/Linux (incl. `~/Applications`, Brave, Chromium, Canary, Arc), and the
  `PUPPETEER_EXECUTABLE_PATH` env var. PDF export should now work out of the box wherever a
  Chromium-family browser exists.
- **Preview now shows separate pages like a Word document**: the live preview paginates into
  discrete A4/Letter/Legal sheets (white pages with gaps and shadows, per-page header/footer
  and page numbers) instead of one continuous strip. Falls back gracefully to a single sheet
  if pagination can't run.

## 1.2.1

- **Preview proportions fixed**: the live preview sheet now uses the real page geometry in
  pixels, so it shows **true A4/Letter/Legal proportions** (portrait/landscape) instead of a
  stretched strip. The cover fills exactly one page, the sheet rounds to whole pages, and a
  faint **page-break guide line** marks each page — so the preview matches the exported PDF.
- Housekeeping: refreshed `.gitignore` / `.vscodeignore` (coverage, caches, `.history`,
  `*.tgz`, build info) and trimmed dependency cruft from the packaged VSIX.

## 1.2.0

### PDF engine
- PDF export now uses **puppeteer-core** with an installed **Chrome / Edge / Chromium**
  (auto-detected on Windows/macOS/Linux), honoring the new `markready.chromePath` setting
  and the `CHROME_PATH` environment variable. No more bundled-Chromium dependency, and a
  clear, actionable error when no browser is found. Word and HTML export need no browser.
- The browser engine is now loaded lazily, so activation and Word/HTML export stay fast.

### Rendering
- **Relative body images** are inlined as data URIs, so images now appear in PDF and Word.
- **Syntax highlighting** for fenced code blocks (highlight.js) with a selectable code theme.
- **GitHub-flavored** extras: task-list checkboxes and footnotes (strikethrough/autolink were already on).
- **Math** rendering with KaTeX (`$...$` / `$$...$$`), opt-in per profile.
- **YAML front matter** is parsed and stripped; `title`/`author`/`date` flow into the cover
  and into `{{title}}`, `{{author}}`, `{{date}}`, `{{subtitle}}` placeholders.
- **TOC depth control** (H1–H6) and optional **automatic heading numbering** (1, 1.1, 1.1.2).
- Optional **diagonal watermark** text on every page.

### Studio
- **Page-accurate preview**: the live preview renders a real paper sheet sized to the chosen
  page size and orientation, with margins and representative header/footer bands. (Refined in 1.2.1.)
- **Zoom** controls (in/out/fit-to-width) and a **draggable splitter** between form and preview.
- **Profile management**: New, Duplicate, Delete, Reset-to-preset, Import and Export JSON.
- **Inline cleanup toggles** in the panel (per preview/export), plus font suggestions, color
  swatches, and live validation for margin/font-size.
- UI state (sidebar, splitter width, zoom) is **remembered** across reopens.
- Esc now exits fullscreen even when focus is inside the preview.

### Quality & infra
- Unit tests (Vitest) guarding the cleanup invariants, a GitHub Actions CI pipeline, an
  optional esbuild bundling script, a leaner VSIX, and Marketplace gallery banner.

## 1.1.0

- Customization Studio now opens in the **full editor width** instead of a cramped side-by-side split, giving more room to customize.
- The editor title-bar **Open Studio** action now shows as a compact icon instead of a long text label.
- Customization Studio: added a **fullscreen preview** toggle (Esc to exit) so page layout is easy to see.
- Customization Studio: the **sidebar can now be hidden** to give the preview the full panel width.
- Customization Studio: added a **date picker** beside the cover Date field (the field still accepts `{{today}}` or any text).
- Studio tab header now uses a document icon instead of a text label, and Studio/Gather tabs show the product icon.
- Renamed user-facing labels and messages from "MarkReady" to "Markdown to PDF & Word" for consistency.

## 0.1.0 — MVP

- Tier-1 rule-based markdown cleanup (chatter, emoji, headings, whitespace, punctuation).
- Document Profiles with built-in presets (HR Formal, Client Proposal, Internal Report, Minimal).
- Customization Studio (Webview) with live preview.
- Export to PDF (Puppeteer), Word/.docx (html-to-docx, no Pandoc), and HTML.
- Folder gather: combine all `.md` files in a folder into one document.
