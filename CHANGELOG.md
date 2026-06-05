# Changelog

## 1.1.0

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
