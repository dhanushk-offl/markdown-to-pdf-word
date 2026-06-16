# Contributing to Markdown to PDF & Word

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to this project. These are mostly
guidelines, not rules. Use your best judgment, and feel free to propose changes to this
document in a pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Questions?](#questions)

---

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Please report unacceptable behavior
to [sanand03072005@gmail.com](mailto:sanand03072005@gmail.com).

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Visual Studio Code** 1.85+
- **Google Chrome**, **Microsoft Edge**, or **Chromium** (for PDF testing — auto-detected)

### One-Time Setup

```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/markdown-to-pdf-word.git
cd markdown-to-pdf-word
npm install
npm run compile
```

---

## Development Setup

### Quick Start

```bash
npm run compile        # TypeScript compilation
npm run watch          # Watch mode (recompiles on save)
npm test               # Run unit tests
npm run bundle         # Optional esbuild bundle for production
```

### Useful Commands

| Command | Description |
|---|---|
| `npm run compile` | One-shot TypeScript compilation |
| `npm run watch` | Watch mode — recompiles on every save |
| `npm test` | Run all unit tests (Vitest) |
| `npx vitest --coverage` | Run tests with coverage report |
| `npx vitest test/cleanup.test.ts` | Run a single test file |
| `npm run bundle` | Production bundle via esbuild |
| `npx vsce package` | Package extension into `.vsix` |
| `npx vsce publish` | Publish to VS Code Marketplace |

### Running the Extension

```bash
# 1. Open project in VS Code
code .

# 2. Launch Extension Development Host (F5)
#    A new window opens with the extension loaded

# 3. Open a .md file and run:
#    Ctrl+Shift+P → "Open Customization Studio"
```

> **Tip:** Use `Cmd+R` / `Ctrl+R` in the dev host to reload after recompiling.

### Testing PDF Exports

PDF export requires a Chromium-based browser on your system. The extension auto-detects
these browsers:

| OS | Detected Browsers |
|---|---|
| Windows | Chrome, Edge, Brave, Chromium |
| macOS | Chrome, Edge, Brave, Chromium, Arc |
| Linux | Chrome, Edge, Chromium, Brave |

If auto-detection fails, set the path explicitly:

```bash
# Option A: VS Code setting
# Set "markready.chromePath" in settings.json

# Option B: Environment variable
export CHROME_PATH=/path/to/chrome
```

### Debugging the Webview

The Customization Studio runs in a VS Code webview. To debug it:

```bash
# 1. Open the studio panel
# 2. Run → "Developer: Toggle Developer Tools"
# 3. Use Console + Elements tabs to inspect
```

The inline script is wrapped in `try { ... } catch` — errors are logged with the
prefix `[MarkReady]`.

### Debugging AI Polish

```bash
# 1. Enable trace logging in VS Code settings:
#    "markready.ai.debug": true

# 2. Open Developer Tools to watch network requests

# 3. API keys are stored in VS Code secret storage —
#    never in profiles, settings, logs, or files
```

---

## Project Structure

```
markdown-to-pdf-word/
├── .github/workflows/     # CI pipeline (GitHub Actions)
├── media/                 # Extension icons and gallery assets
├── sample/                # Sample markdown files for testing
├── src/
│   ├── ai/                # AI tone-polish engine
│   │   ├── client.ts      # Polish entry point + factory
│   │   ├── diff.ts        # Text diff computation
│   │   ├── prompts.ts     # Default system prompt
│   │   ├── types.ts       # AI types + PROVIDER_META registry
│   │   └── providers/     # Provider implementations
│   │       ├── BaseProvider.ts
│   │       ├── OpenAIProvider.ts
│   │       ├── ClaudeProvider.ts
│   │       ├── GeminiProvider.ts
│   │       └── OpenRouterProvider.ts
│   ├── exporters/         # Export implementations
│   │   ├── html.ts
│   │   ├── pdf.ts
│   │   └── docx.ts
│   ├── cleanup.ts         # Rule-based markdown cleanup
│   ├── extension.ts       # Extension activation/deactivation
│   ├── gatherPanel.ts     # Folder-gather webview
│   ├── panel.ts           # Customization Studio webview
│   ├── profiles.ts        # Document profile model + normalization
│   ├── render.ts          # Markdown → HTML pipeline
│   ├── runner.ts          # Export orchestration
│   └── util.ts            # Shared utilities
├── test/                  # Unit tests (Vitest)
├── out/                   # Compiled JavaScript (gitignored)
├── esbuild.js             # Optional bundler script
├── tsconfig.json
├── package.json
└── README.md
```

### Architecture Overview

The data flow through the system:

```
Source (.md)
    │
    ▼
┌─────────────┐     ┌──────────────┐
│  cleanup.ts  │────▶│  render.ts   │
│ (rules, no   │     │ (markdown-it │
│  AI)         │     │  +highlight  │
└─────────────┘     │  +KaTeX)     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   ai/client   │  (optional, BYO key)
                    │  polish MD    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  profiles.ts │── Document Profile (JSON)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐ ┌──────────┐ ┌──────────┐
        │pdf.ts   │ │docx.ts   │ │html.ts   │
        │(Puppe-  │ │(html-to- │ │(stand-   │
        │teer)    │ │docx)     │ │alone)    │
        └─────────┘ └──────────┘ └──────────┘
```

---

## Coding Guidelines

### TypeScript

- **Strict mode** is enabled. Respect `strictNullChecks`, `noImplicitAny`, etc.
- Prefer `const` over `let`; prefer `let` over `var`
- Use TypeScript's built-in types — avoid `any` unless absolutely necessary
- Use `interface` over `type` for object shapes; use `type` for unions and aliases

### Naming Conventions

| Category | Convention | Example |
|---|---|---|
| Files | `camelCase.ts` | `panel.ts`, `render.ts` |
| Classes | `PascalCase` | `StudioPanel` |
| Functions | `camelCase` | `buildHtml()`, `computeDiff()` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_SYSTEM_PROMPT` |
| Private methods | `_camelCase` | `_handleMessage()` |
| Types/Interfaces | `PascalCase` | `AiPolishConfig` |

### No Emoji in Code or UI

The product uses VS Code Codicons for all UI icons. Never use emoji in:
- Source code (comments, strings, variable names)
- UI labels or messages
- HTML templates

Use Codicons via `<i class="codicon codicon-xxx"></i>` instead.

### Cleanup Engine Safety

The cleanup engine (`src/cleanup.ts`) must **never delete real content**. When adding rules:

1. Each rule should operate on clearly identifiable patterns (e.g., AI filler phrases)
2. Add a corresponding test in `test/` that verifies the rule's behavior
3. Test both the removal (positive) and non-removal (negative) cases
4. Never use overly broad patterns that could match real content

### AI Provider Implementation

When adding a new AI provider:

1. Create a file in `src/ai/providers/` extending `BaseProvider`
2. Implement `chat()`, `listModels()`, and `validateKey()`
3. Add the provider ID and metadata to `PROVIDER_META` in `src/ai/types.ts`
4. Add the provider to the factory in `src/ai/client.ts`
5. Add the secret key constant in `src/extension.ts`
6. Update the provider dropdown in `src/panel.ts`

### Code Style

- **Tabs** for indentation (1 tab = 2 spaces)
- **Single quotes** for strings (avoid double quotes unless necessary)
- **Semicolons** required
- **Trailing commas** in multi-line arrays and objects
- **JSDoc** for public APIs and complex logic

```typescript
// Good
export function buildHtml(md: string, profile: Profile): HtmlResult {
  const tokens = parse(md);
  // ...
}

// Avoid
export function buildHtml(md: string, profile: Profile): HtmlResult
{
  var tokens = parse(md);
  // ...
}
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npx vitest run --coverage

# Run in watch mode
npx vitest

# Run a specific test file
npx vitest test/cleanup.test.ts
```

### Test Structure

Tests live in the `test/` directory and mirror the `src/` structure:

```
test/
├── cleanup.test.ts       # Cleanup engine invariants
├── render.test.ts        # Markdown rendering
├── profiles.test.ts      # Profile normalization
├── ai.test.ts            # AI types + polish graceful degradation
└── diff.test.ts          # Diff computation
```

### Writing Tests

- Use **Vitest** (the project's test runner)
- Focus on **behavior**, not implementation details
- Test edge cases: empty input, malformed data, extreme values
- For the cleanup engine, include both positive (should remove) and negative (should not touch) test cases

```typescript
import { describe, it, expect } from "vitest";
import { cleanMarkdown } from "../src/cleanup";

describe("cleanMarkdown", () => {
  it("removes AI introductory phrases", () => {
    const input = "Certainly! Here's your document…\n\n# Title";
    const result = cleanMarkdown(input);
    expect(result).not.toContain("Certainly!");
    expect(result).toContain("# Title");
  });

  it("preserves real content that looks like AI output", () => {
    const input = "The word 'certainly' appears in this sentence.";
    const result = cleanMarkdown(input);
    expect(result).toContain("certainly");
  });
});
```

---

## Pull Request Process

### Before You Submit

1. **Discuss first** — open an [issue](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues) for any non-trivial change
2. **Fork the repo** and create your branch from `main`
3. **Install dependencies** with `npm install`
4. **Compile** with `npm run compile` — no errors
5. **Test** with `npm test` — all tests pass
6. **Lint** your code (follow the [coding guidelines](#coding-guidelines))

### Step-by-Step

```bash
# 1. Create a branch
git checkout -b feature/your-feature-name

# 2. Make your changes
#    - Keep changes focused on a single concern
#    - Write or update tests
#    - Update documentation if needed

# 3. Verify everything works
npm run compile
npm test

# 4. Commit
git add .
git commit -m "feat: brief description of your change"

# 5. Push
git push origin feature/your-feature-name

# 6. Open a Pull Request
#    - Describe your changes in detail
#    - Link any related issues
#    - Include screenshots for UI changes
```

### PR Title Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|---|---|
| `feat:` | A new feature |
| `fix:` | A bug fix |
| `docs:` | Documentation only |
| `style:` | Code style changes (formatting, no code change) |
| `refactor:` | Code refactoring |
| `test:` | Adding or updating tests |
| `chore:` | Build, CI, dependencies |

### PR Checklist

- [ ] I have discussed this change in an issue (for non-trivial changes)
- [ ] My code follows the project's coding style
- [ ] I have added/updated tests that prove my fix/feature works
- [ ] All existing and new tests pass
- [ ] I have updated the documentation (README, comments, etc.)
- [ ] My changes generate no new TypeScript errors
- [ ] I have tested the extension in the Extension Development Host

### Review Process

1. Maintainers will review your PR within a few days
2. Address any feedback or requested changes
3. Once approved, a maintainer will merge your PR
4. Your contribution will appear in the next release

---

## Release Process

Maintained by project maintainers:

1. Update `CHANGELOG.md` with the new version and changes
2. Update version in `package.json`
3. Create a GitHub Release with release notes
4. Publish to VS Code Marketplace via `vsce publish`
5. Tag the release in git

---

## Questions?

- **Open an issue** — [github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues)
- **Start a discussion** — [github.com/anandsundaramoorthysa/markdown-to-pdf-word/discussions](https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/discussions)
- **Email** — [sanand03072005@gmail.com](mailto:sanand03072005@gmail.com?subject=About%20Markdown%20to%20PDF%20%26%20Word%20Extension)

---

<p align="center">
  <a href="README.md">README</a> ·
  <a href="CODE_OF_CONDUCT.md">Code of Conduct</a> ·
  <a href="https://github.com/anandsundaramoorthysa/markdown-to-pdf-word/issues">Issues</a>
</p>
