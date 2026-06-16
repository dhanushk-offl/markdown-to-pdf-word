<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/anandsundaramoorthysa/markdown-to-pdf-word/main/media/icon.png">
    <img src="https://raw.githubusercontent.com/anandsundaramoorthysa/markdown-to-pdf-word/main/media/icon.png" alt="Markdown to PDF & Word" width="128">
  </picture>
</p>

<h1 align="center">Markdown → PDF &amp; Word</h1>

<p align="center">
  <em>Your AI writes Markdown. Your boss wants a Word doc. <strong>One click — cleaned, branded, done.</strong></em>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=AnandSundaramoorthySa.markdown-to-pdf-word">
    <img src="https://img.shields.io/badge/VS%20Code%20Marketplace-v1.2.3-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Marketplace">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=AnandSundaramoorthySa.markdown-to-pdf-word">
    <img src="https://img.shields.io/visual-studio-marketplace/i/AnandSundaramoorthySa.markdown-to-pdf-word?style=flat-square&label=Installs&color=4c1" alt="Installs">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=AnandSundaramoorthySa.markdown-to-pdf-word">
    <img src="https://img.shields.io/visual-studio-marketplace/d/AnandSundaramoorthySa.markdown-to-pdf-word?style=flat-square&label=Downloads&color=4c1" alt="Downloads">
  </a>
  <a href="https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/stargazers">
    <img src="https://img.shields.io/github/stars/anandsundaramoorthysa/markdown-to-pdf-word?style=flat-square&label=Stars&color=ff69b4" alt="Stars">
  </a>
  <a href="#">
    <img src="https://img.shields.io/github/actions/workflow/status/anandsundaramoorthysa/markdown-to-pdf-word/ci.yml?style=flat-square&label=CI&color=007ACC" alt="CI">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License">
  </a>
  <a href="CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome">
  </a>
</p>

<p align="center">
  <b>Supported AI Providers</b><br>
  <a href="#-ai-tone-polish"><img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI"></a>
  <a href="#-ai-tone-polish"><img src="https://img.shields.io/badge/Claude-FF6600?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude"></a>
  <a href="#-ai-tone-polish"><img src="https://img.shields.io/badge/Gemini-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini"></a>
  <a href="#-ai-tone-polish"><img src="https://img.shields.io/badge/OpenRouter-84309C?style=for-the-badge&logo=openrouter&logoColor=white" alt="OpenRouter"></a>
</p>

---

A Visual Studio Code extension that turns Markdown into clean, professional documents —
**PDF, Word (.docx), or HTML** — with a visual customization studio, reusable document
profiles, an AI tone-polish engine, and a rule-based cleanup system that strips AI clutter.
**No Pandoc. No CSS. No setup.**

---

## Table of Contents

- [About](#-about)
- [Why This Extension](#-why-this-extension)
- [Features](#-features)
- [AI Tone Polish](#-ai-tone-polish)
- [Installation](#-installation)
- [Usage](#-usage)
- [Commands](#-commands)
- [Settings](#-settings)
- [How It Works](#-how-it-works)
- [Document Profiles](#-document-profiles)
- [Build From Source](#-build-from-source)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [Star History](#-star-history)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 📖 About

Markdown is great for developers and AI tools, but raw `.md` files — full of `#`, `*`,
backticks, emoji, and chatty AI phrases like *"Certainly! Here's your document…"* — are not
something you can hand to HR, a client, or any non-technical reader.

**Markdown to PDF & Word** solves this entirely inside VS Code. It cleans the Markdown,
applies a professional layout (cover page, branding, headers/footers, table of contents),
optionally polishes the tone with your preferred AI provider, and exports a polished
**PDF, Word, or HTML** document you can send to anyone — all in one click, with nothing
else to install (no Pandoc, no external tools).

It is designed for developers who dislike reading raw Markdown and who frequently need to
share AI- or hand-written Markdown as a real, presentable document.

---

## 🎯 Why This Extension

Most existing tools do **one** piece of this. None combine them:

| Capability | Typical MD→PDF tools | Pandoc tools | This extension |
|---|---|---|---|
| Clean AI clutter (intros/outros, emoji) | ❌ | ❌ | ✅ |
| Word (.docx) export without Pandoc | ❌ | ❌ (needs Pandoc) | ✅ |
| Visual customization (no CSS editing) | ❌ | ❌ | ✅ |
| Reusable, shareable document profiles | ❌ | ❌ | ✅ |
| Cover page + branding builder | ⚠️ Partial | ⚠️ Partial | ✅ |
| **AI tone polish (optional, BYO key)** | ❌ | ❌ | ✅ |
| Gather a whole folder into one document | ❌ | ❌ | ✅ |
| 100% offline (except AI polish) | ❌ (bundled Chromium) | ✅ | ✅ |

---

## ✨ Features

### 🧹 Cleanup Engine (Offline, No AI)
Rule-based removal of AI conversational filler — *"Certainly! Here's…"*, *"Let me know if…"* —
emoji, inconsistent heading spacing, smart quotes/dashes, and excessive blank lines.
**100% offline and deterministic.** Toggle each rule on/off in the studio.

### 🎨 Customization Studio
A visual panel — **no CSS required** — to set a cover page, brand colors, fonts,
header/footer, page numbers, and layout. Includes a **page-accurate live preview**
(real A4/Letter/Legal sheet, portrait/landscape, margins, header/footer bands),
**zoom controls** (in/out/fit-to-width), a **draggable splitter**, and a **fullscreen** mode.

### 📁 Document Profiles
Save your look as a reusable profile in `.markready/profiles/*.json` and commit it so your
whole team exports the same way. Ships with presets: **HR Formal, Client Proposal,
Internal Report, Minimal** — plus in-studio **New / Duplicate / Delete / Reset / Import / Export**.

### 🤖 AI Tone Polish
Optionally polish your markdown through **OpenAI, Claude, Gemini, or OpenRouter** before
export. See the [AI section](#-ai-tone-polish) for details.

### 📄 Rich Markdown Rendering
- **Syntax highlighting** for fenced code blocks (selectable theme)
- **Task lists**, **footnotes**, **tables**, **blockquotes**, **horizontal rules**
- **KaTeX math** (`$...$` / `$$...$$`), opt-in per profile
- **YAML front matter** — `title`/`author`/`date` feed the cover and `{{placeholder}}` tokens
- **Table of Contents** with depth control and optional **heading numbering**
- Optional **watermark** on every page

### 📂 Folder Gather + Reorder
Gather every `.md` file in a folder, include/exclude and reorder them, then combine into one document.

### 📦 Three Export Formats
- **PDF** — via your installed Chrome/Edge/Chromium (auto-detected)
- **Word (.docx)** — no Pandoc, no external tools
- **HTML** — standalone, self-contained

All exports embed relative images automatically.

### 🧼 Clean UI
Built with official VS Code Codicons — no emoji anywhere in the product UI.

---

## 🤖 AI Tone Polish

> **Bring your own API key.** No subscription, no lock-in, no usage tracking.

The AI tone polish feature lets you run your markdown through a large language model before
export — cleaning up phrasing, removing awkward sentences, and making the language
professional, clear, and confident — all while preserving structure, code blocks, and data.

### How It Works

```
Original Markdown  →  [Your chosen LLM]  →  Diff Review  →  Apply / Discard
                            ↑
                    Your API Key (never stored in files)
```

1. Enable AI polish in the studio and select a provider
2. Configure your API key (stored securely in VS Code's secret storage)
3. Click **Polish Now** — the diff is shown inline
4. Review changes: **Apply** to accept or **Discard** to reject
5. During export with AI enabled, polish is applied seamlessly

### Supported Providers

| Provider | API Format | Default Model | Authentication |
|---|---|---|---|
| **OpenAI** | Chat Completions | `gpt-4o-mini` | `Authorization: Bearer <key>` |
| **Claude (Anthropic)** | Messages API | `claude-3-5-haiku-latest` | `x-api-key: <key>` |
| **Google Gemini** | Generate Content | `gemini-1.5-flash` | Query parameter `?key=<key>` |
| **OpenRouter** | OpenAI-compatible | `openai/gpt-4o-mini` | `Authorization: Bearer <key>` |

### Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `markready.ai.defaultProvider` | enum | `"openai"` | Default AI provider |
| `markready.ai.defaultModel` | string | `""` | Default model (empty = provider default) |
| `markready.ai.defaultTemperature` | number (0-1) | `0.3` | AI response creativity |

### Commands

| Command | Description |
|---|---|
| `Markdown to PDF & Word: Configure AI API Key` | Set a provider's API key |
| `Markdown to PDF & Word: Test AI API Key` | Validate a stored key |
| `Markdown to PDF & Word: Clear All AI API Keys` | Delete all stored keys |

### Security

- **API keys are stored in VS Code's secret storage** — never in profiles, settings, logs, or files
- Each key is stored under a provider-specific secret identifier
- Supports distinct keys per provider (OpenAI, Claude, Gemini, OpenRouter)
- Keys can be tested, individually reconfigured, or bulk-cleared

### Default System Prompt

The polish is guided by a carefully crafted system prompt that instructs the AI to:

- Preserve all headings, code blocks, lists, tables, and formatting exactly as-is
- Make language professional, clear, and confident
- Remove casual or conversational phrasing
- Never add, remove, or alter data, numbers, names, or specifications
- Output only the polished markdown — no greeting, sign-off, or explanation

You can edit the prompt freely in the studio and reset to default at any time.

---

## 📥 Installation

### From VS Code Marketplace (recommended)

1. Open **Visual Studio Code**
2. Go to the **Extensions** view (`Ctrl+Shift+X`)
3. Search for **Markdown to PDF & Word**
4. Click **Install**

Or install from the command line:

```bash
code --install-extension AnandSundaramoorthySa.markdown-to-pdf-word
```

### From a `.vsix` file

Download the `.vsix` from the [Releases](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/releases) page, then:

```bash
code --install-extension markdown-to-pdf-word-1.2.3.vsix
```

> **PDF requirement:** PDF export renders through an installed **Google Chrome**, **Microsoft
> Edge**, or **Chromium** (auto-detected on Windows/macOS/Linux). Most machines already have
> one. If yours doesn't, install Chrome/Edge or point `markready.chromePath` at a browser
> executable (or set the `CHROME_PATH` environment variable). **Word (.docx)** and **HTML**
> export need no browser at all.

---

## 🚀 Usage

1. Open any Markdown (`.md`) file
2. Press `Ctrl+Shift+P` and run **Markdown to PDF & Word: Open Customization Studio**
3. Adjust the cover page, colors, fonts, layout, and AI options — watch the live preview update
4. Click **Export PDF**, **Export Word**, or **Export HTML**

You can also **right-click** a `.md` file (or a folder) in the Explorer for quick actions.

---

## ⌨️ Commands

Open the Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---|---|
| `Markdown to PDF & Word: Open Customization Studio` | Visual editor + live preview + export buttons |
| `Markdown to PDF & Word: Export as PDF` | Clean + render the active file to PDF |
| `Markdown to PDF & Word: Export as Word (DOCX)` | Clean + render the active file to Word (no Pandoc) |
| `Markdown to PDF & Word: Export as HTML` | Clean + render the active file to HTML |
| `Markdown to PDF & Word: Clean Markdown` | Open a cleaned copy of the active file |
| `Markdown to PDF & Word: Gather Folder into One Document` | Combine all `.md` in a folder into one document |
| `Markdown to PDF & Word: Configure AI API Key` | Set a provider's API key |
| `Markdown to PDF & Word: Test AI API Key` | Validate a stored key |
| `Markdown to PDF & Word: Clear All AI API Keys` | Delete all stored keys |

---

## ⚙️ Settings

| Setting | Default | Description |
|---|---|---|
| `markready.defaultProfile` | `HR Formal` | Profile used by the quick export commands |
| `markready.chromePath` | `""` | Optional path to a Chrome/Edge/Chromium executable for PDF export |
| `markready.cleanup.removeChatter` | `true` | Remove AI intros/outros |
| `markready.cleanup.removeEmoji` | `true` | Strip emoji from headings and text |
| `markready.cleanup.normalizeHeadings` | `true` | Normalize heading spacing |
| `markready.cleanup.normalizeWhitespace` | `true` | Collapse excessive blank lines |
| `markready.cleanup.normalizePunctuation` | `true` | Convert smart quotes/dashes to ASCII |
| `markready.ai.defaultProvider` | `"openai"` | Default AI provider (`openai`, `claude`, `gemini`, `openrouter`) |
| `markready.ai.defaultModel` | `""` | Default AI model (empty = provider default) |
| `markready.ai.defaultTemperature` | `0.3` | AI response creativity (0.0 – 1.0) |

---

## 🔧 How It Works

```
.md  →  front matter + cleanup (rules, no AI)  →  markdown-it (+highlight/math/GFM)
     →  AI polish (optional, BYO key)  →  HTML + cover + TOC + CSS
     →  PDF (Chrome/Edge) | DOCX (no Pandoc) | HTML
                           ↑
               Document Profile (JSON)
```

The Customization Studio edits the Profile JSON and renders the preview through the **same**
pipeline used for export, so what you see is what you get.

---

## 📁 Document Profiles

A profile is a small JSON file describing the cover page, branding, header/footer, layout,
options, and AI polish configuration. Saving a profile writes it to:

```
<your-project>/.markready/profiles/<profile-name>.json
```

Commit this file to your repository and everyone on the team exports documents with the same
look. Built-in presets are available out of the box and can be cloned and customized.

---

## 🔨 Build From Source

```bash
# 1. Clone
git clone https://github.com/anandsundaramoorthysa/markdown-to-pdf-word.git
cd markdown-to-pdf-word

# 2. Install dependencies (no browser download — PDF uses your installed Chrome/Edge)
npm install

# 3. Compile
npm run compile

# 4. Run the unit tests
npm test

# 5. Launch the Extension Development Host
#    Press F5 in VS Code
```

To package a `.vsix`:

```bash
npm install -g @vscode/vsce
vsce package
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup and contribution guidelines.

---

## 👥 Contributing

Contributions are welcome — bug fixes, new presets, features, or docs.

- **Discuss first:** for anything non-trivial, open an [issue](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues) before coding
- **Understand the codebase:** the pipeline is `cleanup.ts → render.ts → ai/ → exporters/*`, with the UI in `panel.ts` (studio) and `gatherPanel.ts` (folder gather)
- **Keep the cleanup safe:** the cleanup engine must never delete real content — add tests when adding rules
- **Match the style:** TypeScript, no emoji in code or UI (use Codicons)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution workflow, code style guide, and development setup.

---

## 🗺 Roadmap

- [x] Code-block theme options
- [x] Page watermark
- [x] Math (KaTeX) and richer markdown (task lists, footnotes, front matter)
- [x] **AI tone-polish** (optional, bring-your-own-key)
- [ ] Mermaid diagrams (kept off for now to preserve the fully-offline, small-bundle promise)
- [ ] Logo positioning in header/footer
- [ ] Publish to Open VSX (for Cursor / VSCodium / Windsurf)
- [ ] More built-in profile presets

See `PLAN.md` for the full design and roadmap.

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=anandsundaramoorthysa/markdown-to-pdf-word&type=Date&theme=auto)](https://star-history.com/#anandsundaramoorthysa/markdown-to-pdf-word&Date)

---

## 📄 License

This project is released under the **MIT License**. You are free to use, modify, and
distribute it under the terms of this license. See the [LICENSE](LICENSE) file for the full text.

---

## 🙏 Acknowledgments

Built with these excellent open-source projects:

- [markdown-it](https://github.com/markdown-it/markdown-it) — Markdown parsing and rendering
- [puppeteer-core](https://github.com/puppeteer/puppeteer) — HTML to PDF via your installed browser
- [html-to-docx](https://github.com/privateOmega/html-to-docx) — HTML to Word, no Pandoc
- [highlight.js](https://github.com/highlightjs/highlight.js) — code syntax highlighting
- [KaTeX](https://github.com/KaTeX/KaTeX) — fast math typesetting
- [diff](https://github.com/kpdecker/jsdiff) — text diff engine for AI polish review
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — YAML front-matter parsing
- [VS Code Codicons](https://github.com/microsoft/vscode-codicons) — the icon set used in the UI

---

<p align="center">
  <a href="https://github.com/anandsundaramoorthysa/markdown-to-pdf-word">GitHub</a> ·
  <a href="https://marketplace.visualstudio.com/items?itemName=AnandSundaramoorthySa.markdown-to-pdf-word">Marketplace</a> ·
  <a href="https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues">Issues</a> ·
  <a href="https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/discussions">Discussions</a>
</p>
