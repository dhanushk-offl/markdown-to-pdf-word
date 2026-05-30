![Version](https://img.shields.io/visual-studio-marketplace/v/anandsundaramoorthy.markdown-to-pdf-word)
![Installs](https://img.shields.io/visual-studio-marketplace/i/anandsundaramoorthy.markdown-to-pdf-word)
![Rating](https://img.shields.io/visual-studio-marketplace/r/anandsundaramoorthy.markdown-to-pdf-word)
![License](https://img.shields.io/github/license/anandsundaramoorthysa/markdown-to-pdf-word)
![VS Code](https://img.shields.io/static/v1?label=VS%20Code&message=%5E1.85.0&color=blue)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contribution)

# Markdown to PDF & Word

> Your AI writes Markdown. Your boss wants a Word doc. **One click — cleaned, branded, done.**

A Visual Studio Code extension that turns Markdown into a clean, professional document —
**PDF, Word (.docx), or HTML** — with a visual customization studio, reusable document
profiles, and a rule-based cleanup engine that strips AI clutter. **No Pandoc. No CSS. No setup.**

## Table of Contents

- [About Project](#about-project)
- [Why This Extension](#why-this-extension)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Commands](#commands)
- [Settings](#settings)
- [How It Works](#how-it-works)
- [Document Profiles](#document-profiles)
- [Build From Source](#build-from-source)
- [Contribution](#contribution)
- [Roadmap](#roadmap)
- [License](#license)
- [Contact Me](#contact-me)
- [Acknowledge](#acknowledge)

## About Project

Markdown is great for developers and AI tools, but raw `.md` files — full of `#`, `*`,
backticks, emoji, and chatty AI phrases like *"Certainly! Here's your document…"* — are not
something you can hand to HR, a client, or any non-technical reader.

**Markdown to PDF & Word** solves this entirely inside VS Code. It cleans the Markdown,
applies a professional layout (cover page, branding, headers/footers, table of contents),
and exports a polished **PDF, Word, or HTML** document you can send to anyone — all in one
click, with nothing else to install (no Pandoc, no external tools).

It is designed for developers who dislike reading raw Markdown and who frequently need to
share AI- or hand-written Markdown as a real, presentable document.

## Why This Extension

Most existing tools do **one** piece of this. None combine them:

| Capability | Typical MD→PDF tools | Pandoc tools | This extension |
|---|---|---|---|
| Clean AI clutter (intros/outros, emoji) | No | No | **Yes** |
| Word (.docx) export without Pandoc | No | No (needs Pandoc) | **Yes** |
| Visual customization (no CSS editing) | No | No | **Yes** |
| Reusable, shareable document profiles | No | No | **Yes** |
| Cover page + branding builder | Partial | Partial | **Yes** |
| Gather a whole folder into one document | No | No | **Yes** |

## Features

- **Cleanup (no AI needed):** rule-based removal of AI conversational filler
  ("Certainly! Here's…", "Let me know if…"), emoji, inconsistent heading spacing, smart
  quotes/dashes, and excessive blank lines. 100% offline and deterministic.
- **Customization Studio:** a visual panel — no CSS — to set a cover page, brand colors,
  fonts, header/footer, page numbers, and layout, with a **live preview** that matches the
  exported result exactly.
- **Document Profiles:** save your look as a reusable profile in `.markready/profiles/*.json`
  and commit it so your whole team exports the same way. Ships with presets: **HR Formal,
  Client Proposal, Internal Report, Minimal**.
- **Table of Contents:** optional, auto-generated from headings with in-document links.
- **Folder Gather + Reorder:** gather every `.md` file in a folder, include/exclude and
  reorder them, then combine into one document.
- **Three export formats:** PDF (via headless Chromium), **Word/.docx without Pandoc**, HTML.
- **Clean UI:** built with official VS Code Codicons — no emoji anywhere in the product.

## Installation

### From the VS Code Marketplace (recommended)

1. Open **Visual Studio Code**.
2. Go to the **Extensions** view (`Ctrl+Shift+X`).
3. Search for **Markdown to PDF & Word**.
4. Click **Install**.

Or install from the command line:

```bash
code --install-extension anandsundaramoorthy.markdown-to-pdf-word
```

### From a `.vsix` file

Download the `.vsix` from the [Releases](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/releases) page, then:

```bash
code --install-extension markdown-to-pdf-word-1.0.0.vsix
```

> **Note:** PDF export uses Chromium. The extension uses its bundled engine, and if that is
> unavailable it automatically falls back to an installed **Google Chrome** or **Microsoft Edge**.
> You can also set a custom path via the `markready.chromePath` setting.

## Usage

1. Open any Markdown (`.md`) file.
2. Press `Ctrl+Shift+P` and run **MarkReady: Open Customization Studio**.
3. Adjust the cover page, colors, fonts, and layout — watch the live preview update.
4. Click **Export PDF**, **Export Word**, or **Export HTML**.

You can also **right-click** a `.md` file (or a folder) in the Explorer for quick actions.

## Commands

Open the Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---|---|
| `MarkReady: Open Customization Studio` | Visual editor + live preview + export buttons |
| `MarkReady: Export as PDF` | Clean + render the active file to PDF |
| `MarkReady: Export as Word (DOCX)` | Clean + render the active file to Word (no Pandoc) |
| `MarkReady: Export as HTML` | Clean + render the active file to HTML |
| `MarkReady: Clean Markdown` | Open a cleaned copy of the active file |
| `MarkReady: Gather Folder into One Document` | Combine all `.md` in a folder into one document |

## Settings

| Setting | Default | Description |
|---|---|---|
| `markready.defaultProfile` | `HR Formal` | Profile used by the quick export commands |
| `markready.chromePath` | `""` | Optional path to a Chrome/Edge/Chromium executable for PDF export |
| `markready.cleanup.removeChatter` | `true` | Remove AI intros/outros |
| `markready.cleanup.removeEmoji` | `true` | Strip emoji from headings and text |
| `markready.cleanup.normalizeHeadings` | `true` | Normalize heading spacing |
| `markready.cleanup.normalizeWhitespace` | `true` | Collapse excessive blank lines |
| `markready.cleanup.normalizePunctuation` | `true` | Convert smart quotes/dashes to ASCII |

## How It Works

```
.md  ->  cleanup (rules, no AI)  ->  markdown-it -> HTML + cover + TOC + CSS  ->  PDF | DOCX | HTML
                                              ^
                                  Document Profile (JSON)
```

The Customization Studio edits the Profile JSON and renders the preview through the **same**
pipeline used for export, so what you see is what you get.

## Document Profiles

A profile is a small JSON file describing the cover page, branding, header/footer, layout,
and options. Saving a profile writes it to:

```
<your-project>/.markready/profiles/<profile-name>.json
```

Commit this file to your repository and everyone on the team exports documents with the same
look. Built-in presets are available out of the box and can be cloned and customized.

## Build From Source

```bash
# 1. Clone
git clone https://github.com/anandsundaramoorthysa/markdown-to-pdf-word.git
cd markdown-to-pdf-word

# 2. Install dependencies (Puppeteer downloads Chromium once)
npm install

# 3. Compile
npm run compile

# 4. Launch the Extension Development Host
#    Press F5 in VS Code
```

To package a `.vsix`:

```bash
npm install -g @vscode/vsce
vsce package
```

## Contribution

Contributions are welcome — bug fixes, new presets, new features, or docs.

### Guidelines

- **Discuss first:** for anything non-trivial, open an
  [issue](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues) before coding.
- **Understand the codebase:** the pipeline is `cleanup.ts -> render.ts -> exporters/*`, with
  the UI in `panel.ts` (studio) and `gatherPanel.ts` (folder gather).
- **Keep the cleanup safe:** the cleanup engine must never delete real content — add tests
  when adding rules.
- **Match the style:** TypeScript, no emoji in code or UI (use Codicons).

### Steps

1. **Fork** the [repository](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word).
2. Create a branch: `git checkout -b feature/your-feature`.
3. Make your changes and run `npm run compile`.
4. **Commit** with a clear message.
5. **Open a pull request** describing your change and linking any related issue.

[View Open Issues](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues)

## Roadmap

- [ ] AI tone-polish (optional, bring-your-own-key)
- [ ] Logo positioning and watermarks
- [ ] Code-block theme options
- [ ] Publish to Open VSX (for Cursor / VSCodium / Windsurf)
- [ ] More built-in profile presets

See `PLAN.md` for the full design and roadmap.

## License

This project is released under the **MIT License**. You are free to use, modify, and
distribute it under the terms of this license. See the [LICENSE](LICENSE) file for the full text.

## Contact Me

If you have any questions, feedback, or suggestions, feel free to reach out:

- **Anand Sundaramoorthy** — [sanand03072005@gmail.com](mailto:sanand03072005@gmail.com?subject=About%20Markdown%20to%20PDF%20%26%20Word%20Extension)
- **GitHub:** [@anandsundaramoorthysa](https://github.com/anandsundaramoorthysa)

## Acknowledge

Built with these excellent open-source projects:

- [markdown-it](https://github.com/markdown-it/markdown-it) — Markdown parsing and rendering
- [Puppeteer](https://github.com/puppeteer/puppeteer) — HTML to PDF via headless Chromium
- [html-to-docx](https://github.com/privateOmega/html-to-docx) — HTML to Word, no Pandoc
- [VS Code Codicons](https://github.com/microsoft/vscode-codicons) — the icon set used in the UI

Thanks to the VS Code extension community for the guidance and inspiration.
