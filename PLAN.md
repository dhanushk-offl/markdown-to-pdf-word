# MarkReady — Project Plan

> **One line:** *Your AI writes markdown. Your boss wants a Word doc. One click — cleaned, branded, done.*

A VS Code extension that turns AI-generated markdown into a clean, branded, shareable document
(**PDF / Word / HTML**) — with a visual customization studio, reusable document profiles, and a
rule-based "de-AI-ify" cleanup engine. **No Pandoc. No CSS writing. No AI required.**

---

## 1. The problem

When you vibe-code, the AI produces lots of `.md` files (plans, specs, READMEs, reports).
- Developers who dislike raw markdown find `#`, `*`, ``` ``` ``` hard to read.
- They need to **share** these docs with non-technical people (HR, clients, managers) as real documents.
- AI markdown is full of artifacts that look unprofessional: emoji headings, "Certainly! Here's…",
  chatty filler, inconsistent headings, stray code fences.

Existing extensions either *view* markdown OR *convert* it — none **clean + customize + ship** in one flow.

## 2. The wedge (what nobody does in ONE tool)

| Capability | yzane MD-PDF | pandoc ext | Gutenberg | Emoji Eraser | **MarkReady** |
|---|---|---|---|---|---|
| Clean AI chatty filler | No | No | No | partial | Yes |
| No-Pandoc Word export | No | No (needs Pandoc) | No | No | Yes |
| Visual customization (no CSS) | No (manual CSS) | No | No | No | Yes |
| Reusable, shareable profiles | No | No | No | No | Yes |
| Cover page + branding builder | No | partial | No | No | Yes |
| Gather a whole folder | No | No | Yes | No | Yes |

**Moat = the integration + execution quality**, not any single feature.

## 3. The 4 pillars

1. **Clean** — Tier-1 rule-based cleanup (no AI): remove chatter, emoji, normalize headings,
   whitespace, smart punctuation.
2. **Customize** — Document Profiles (JSON) edited via a visual Webview studio with live preview;
   cover page, branding, header/footer, layout; saved + shareable via git; audience presets.
3. **Gather** — single file OR "gather all `.md` in a folder" into one document.
4. **Ship** — export to PDF (Puppeteer), Word/DOCX (html-to-docx, no Pandoc), HTML.

## 4. Architecture

```
                       ┌──────────────────────────────────────────┐
  .md file  ──────────▶│ cleanup.ts  (Tier-1 rules, no AI)         │
                       └───────────────┬──────────────────────────┘
                                       ▼ clean markdown
                       ┌──────────────────────────────────────────┐
  Profile (JSON) ─────▶│ render.ts  markdown-it -> HTML + cover+CSS │
                       └───────────────┬──────────────────────────┘
                                       ▼ full HTML document
        ┌──────────────────────────────┼───────────────────────────┐
        ▼                               ▼                            ▼
  exporters/pdf.ts               exporters/docx.ts            exporters/html.ts
  (Puppeteer)                    (html-to-docx, no Pandoc)    (write file)
        │                               │                            │
        ▼                               ▼                            ▼
     report.pdf                     report.docx                 report.html
```

The **Customization Studio** (`panel.ts`) is a Webview that edits the Profile JSON and shows a
live preview by running the same `render.ts` path used for export -> true WYSIWYG.

## 5. Tech stack

- **TypeScript** + **VS Code Extension API**
- **markdown-it** — markdown -> HTML (same engine family as VS Code preview)
- **Puppeteer** — HTML -> PDF (headers/footers/page numbers)
- **html-to-docx** — HTML -> Word, *no Pandoc*
- **Webview** — the visual customization studio + live preview
- Profiles stored as JSON under `.markready/profiles/` (shareable via git)

## 6. Commands

| Command | What it does |
|---|---|
| `MarkReady: Open Customization Studio` | Visual profile editor + live preview + export buttons |
| `MarkReady: Export as PDF` | Clean + render + export active file to PDF |
| `MarkReady: Export as Word (DOCX)` | Same -> Word, no Pandoc |
| `MarkReady: Export as HTML` | Same -> HTML |
| `MarkReady: Clean Markdown` | Open a cleaned copy of the active file |
| `MarkReady: Gather Folder into One Document` | Combine all `.md` in a folder -> one document |

## 7. Roadmap

- **v0.1 (this MVP)** — cleanup engine, profiles + built-in presets, studio with live preview,
  PDF/HTML/DOCX export, folder gather.
- **v0.2** — drag-to-reorder folder gather, auto table of contents, more presets.
- **v0.3** — logo positioning, watermarks, code-block themes.
- **v0.4** — optional AI tone-polish (Tier 2, bring-your-own-key).
- **v0.5** — publish to Marketplace + Open VSX, optional license-key for premium features.

## 8. How to run

```bash
cd D:\Projects\markready
npm install          # installs deps (Puppeteer downloads Chromium once)
npm run compile      # build TypeScript
# then press F5 in VS Code to launch the Extension Development Host
```

Open `sample/sample.md`, run **MarkReady: Open Customization Studio**, tweak, and export.
