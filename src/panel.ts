/**
 * The Customization Studio — a Webview that visually edits a Document Profile and
 * shows a live, page-accurate preview by running the same render path used for
 * export (true WYSIWYG). It also manages profiles and cleanup options.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  DocProfile,
  loadProfiles,
  getProfile,
  saveProfile,
  deleteProfile,
  builtinProfile,
  defaultProfile,
  normalizeProfile,
} from "./profiles";
import { CleanupOptions } from "./cleanup";
import { buildHtml, makeRelativeLogo } from "./render";
import { makeContext, runExport, Format } from "./runner";

export interface StudioInit {
  markdown: string;
  filename: string;
  baseDir: string;
  workspaceRoot: string | undefined;
  cleanup: CleanupOptions;
  defaultProfileName: string;
}

export class StudioPanel {
  public static current: StudioPanel | undefined;
  private static readonly viewType = "markready.studio";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private markdown: string;
  private filename: string;
  private baseDir: string;
  private workspaceRoot: string | undefined;
  private cleanup: CleanupOptions;
  private defaultProfileName: string;
  private profile: DocProfile;

  public static createOrShow(context: vscode.ExtensionContext, init: StudioInit) {
    // Open in the active column (full editor width) so the studio has room to
    // customize, rather than a cramped side-by-side split.
    const column = vscode.ViewColumn.Active;
    if (StudioPanel.current) {
      StudioPanel.current.reset(init);
      StudioPanel.current.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      StudioPanel.viewType,
      "Markdown to PDF & Word Studio",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "node_modules", "@vscode", "codicons", "dist"),
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      }
    );
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "icon.png");
    StudioPanel.current = new StudioPanel(panel, init, context.extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, init: StudioInit, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.markdown = init.markdown;
    this.filename = init.filename;
    this.baseDir = init.baseDir;
    this.workspaceRoot = init.workspaceRoot;
    this.cleanup = init.cleanup;
    this.defaultProfileName = init.defaultProfileName;
    this.profile = getProfile(init.workspaceRoot, init.defaultProfileName) || defaultProfile();

    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), null, this.disposables);
  }

  private reset(init: StudioInit) {
    this.markdown = init.markdown;
    this.filename = init.filename;
    this.baseDir = init.baseDir;
    this.workspaceRoot = init.workspaceRoot;
    this.cleanup = init.cleanup;
    this.defaultProfileName = init.defaultProfileName;
    this.post({ type: "source", filename: this.filename });
    this.sendInit();
  }

  private ctx() {
    return makeContext(this.filename, this.baseDir);
  }

  private profileNames(): string[] {
    return loadProfiles(this.workspaceRoot).map((p) => p.name);
  }

  private uniqueName(base: string): string {
    const names = new Set(this.profileNames());
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }

  private renderPreview() {
    const html = buildHtml({
      markdown: this.markdown,
      profile: this.profile,
      ctx: this.ctx(),
      cleanup: this.cleanup,
      previewNote: `Live preview · profile "${this.profile.name}" · cleanup ${
        this.cleanup.removeChatter ? "on" : "off"
      }`,
    });
    this.post({ type: "preview", html });
  }

  private sendInit() {
    this.post({
      type: "init",
      profiles: this.profileNames(),
      profile: this.profile,
      cleanup: this.cleanup,
      filename: this.filename,
    });
    this.renderPreview();
  }

  private async onMessage(msg: any) {
    switch (msg?.type) {
      case "ready":
        this.sendInit();
        break;

      case "change":
        this.profile = normalizeProfile(msg.profile);
        this.renderPreview();
        break;

      case "cleanup":
        this.cleanup = { ...this.cleanup, ...(msg.cleanup || {}) };
        this.renderPreview();
        break;

      case "selectProfile": {
        this.profile = getProfile(this.workspaceRoot, msg.name);
        this.post({ type: "setProfile", profile: this.profile });
        this.renderPreview();
        break;
      }

      case "newProfile": {
        this.profile = defaultProfile();
        this.profile.name = this.uniqueName("New Profile");
        this.post({ type: "setProfile", profile: this.profile });
        this.renderPreview();
        break;
      }

      case "duplicateProfile": {
        this.profile = normalizeProfile(msg.profile);
        this.profile.name = this.uniqueName(`${this.profile.name} Copy`);
        this.post({ type: "setProfile", profile: this.profile });
        this.renderPreview();
        break;
      }

      case "resetProfile": {
        const cur = normalizeProfile(msg.profile);
        this.profile = builtinProfile(cur.name) || defaultProfile();
        this.post({ type: "setProfile", profile: this.profile });
        this.renderPreview();
        vscode.window.showInformationMessage(
          `Reset "${this.profile.name}" to preset defaults (Save to keep).`
        );
        break;
      }

      case "deleteProfile": {
        if (!this.workspaceRoot) {
          vscode.window.showWarningMessage("Open a folder/workspace to manage saved profiles.");
          break;
        }
        const name = normalizeProfile(msg.profile).name;
        const pick = await vscode.window.showWarningMessage(
          `Delete profile "${name}"?`,
          { modal: true },
          "Delete"
        );
        if (pick !== "Delete") break;
        const removed = deleteProfile(this.workspaceRoot, name);
        this.profile = getProfile(this.workspaceRoot, this.defaultProfileName) || defaultProfile();
        this.post({ type: "init", profiles: this.profileNames(), profile: this.profile, cleanup: this.cleanup, filename: this.filename });
        this.renderPreview();
        vscode.window.showInformationMessage(
          removed ? `Deleted profile "${name}".` : `Profile "${name}" was a built-in (not saved); reset only.`
        );
        break;
      }

      case "exportProfile": {
        const prof = normalizeProfile(msg.profile);
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(this.baseDir, `${slug(prof.name)}.json`)),
          filters: { "Profile JSON": ["json"] },
          saveLabel: "Export Profile",
        });
        if (!uri) break;
        try {
          fs.writeFileSync(uri.fsPath, JSON.stringify(prof, null, 2), "utf8");
          vscode.window.showInformationMessage(`Exported profile to ${path.basename(uri.fsPath)}.`);
        } catch (e: any) {
          vscode.window.showErrorMessage(`Could not export profile: ${e?.message ?? e}`);
        }
        break;
      }

      case "importProfile": {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { "Profile JSON": ["json"] },
          title: "Import a profile JSON",
        });
        if (!picked || !picked[0]) break;
        try {
          const raw = JSON.parse(fs.readFileSync(picked[0].fsPath, "utf8"));
          this.profile = normalizeProfile(raw);
          this.profile.name = this.uniqueName(this.profile.name);
          this.post({ type: "setProfile", profile: this.profile });
          this.renderPreview();
          vscode.window.showInformationMessage(`Imported profile "${this.profile.name}" (Save to keep).`);
        } catch (e: any) {
          vscode.window.showErrorMessage(`Could not import profile: ${e?.message ?? e}`);
        }
        break;
      }

      case "pickLogo": {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          title: "Choose a logo image",
          filters: { Images: ["png", "jpg", "jpeg", "svg", "gif"] },
        });
        if (picked && picked[0]) {
          const rel = makeRelativeLogo(picked[0].fsPath, this.baseDir);
          this.profile = normalizeProfile(msg.profile);
          this.profile.cover.logo = rel;
          this.post({ type: "setProfile", profile: this.profile });
          this.renderPreview();
        }
        break;
      }

      case "save": {
        this.profile = normalizeProfile(msg.profile);
        if (!this.workspaceRoot) {
          vscode.window.showWarningMessage(
            "Open a folder/workspace to save profiles (they live in .markready/profiles)."
          );
          break;
        }
        const file = saveProfile(this.workspaceRoot, this.profile);
        this.post({ type: "init", profiles: this.profileNames(), profile: this.profile, cleanup: this.cleanup, filename: this.filename });
        vscode.window.showInformationMessage(
          `Saved profile "${this.profile.name}" -> ${path.relative(this.workspaceRoot, file)}`
        );
        break;
      }

      case "export": {
        this.profile = normalizeProfile(msg.profile);
        const format = msg.format as Format;
        await runExport({
          format,
          markdown: this.markdown,
          profile: this.profile,
          cleanup: this.cleanup,
          ctx: this.ctx(),
          defaultPath: path.join(this.baseDir, this.filename),
          chromePath: vscode.workspace.getConfiguration("markready").get<string>("chromePath", ""),
        });
        break;
      }

      case "refreshSource": {
        const ed = vscode.window.activeTextEditor;
        if (ed && ed.document.languageId === "markdown") {
          const doc = ed.document;
          this.markdown = doc.getText();
          const fsPath = doc.isUntitled ? undefined : doc.uri.fsPath;
          this.filename = fsPath
            ? path.basename(fsPath).replace(/\.(md|markdown)$/i, "")
            : "Untitled";
          this.baseDir = fsPath ? path.dirname(fsPath) : this.baseDir;
          this.post({ type: "source", filename: this.filename });
          this.renderPreview();
          vscode.window.showInformationMessage(`Markdown to PDF & Word: loaded "${this.filename}".`);
        } else {
          vscode.window.showWarningMessage("Focus a markdown editor, then click Refresh.");
        }
        break;
      }
    }
  }

  private post(message: any) {
    this.panel.webview.postMessage(message);
  }

  private dispose() {
    StudioPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }

  private html(): string {
    const nonce = getNonce();
    const webview = this.panel.webview;
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "node_modules",
        "@vscode",
        "codicons",
        "dist",
        "codicon.css"
      )
    );
    const csp = [
      "default-src 'none'",
      "img-src data: https:",
      `style-src 'unsafe-inline' ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      "frame-src *",
    ].join("; ");

    return /* html */ `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<link href="${codiconUri}" rel="stylesheet"/>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         margin: 0; height: 100vh; display: flex; flex-direction: column; }
  .toolbar { display:flex; gap:6px; align-items:center; padding:8px 10px;
             border-bottom:1px solid var(--vscode-panel-border); flex-wrap:wrap; }
  .toolbar .spacer { flex:1; }
  .sep { width:1px; align-self:stretch; background:var(--vscode-panel-border); margin:0 2px; }
  select, input, button { font-family: inherit; font-size: 12px; }
  input[type=text], input[type=number], select {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #888); border-radius:4px; padding:4px 6px; width:100%;
  }
  input.invalid { border-color: var(--vscode-inputValidation-errorBorder, #e51400); }
  input[type=date] {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #888); border-radius:4px; padding:4px 6px;
    width:auto; color-scheme: light dark;
  }
  button {
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border:none; border-radius:4px; padding:6px 10px; cursor:pointer;
    display:inline-flex; align-items:center; gap:5px;
  }
  button.icon { padding:6px 7px; }
  .codicon { font-size:14px; line-height:1; }
  .title { display:inline-flex; align-items:center; gap:6px; font-weight:600; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button:hover { opacity:.9; }
  .zoom { display:inline-flex; align-items:center; gap:4px; }
  #zoomLabel { min-width:38px; text-align:center; font-size:11px; opacity:.8; }
  .main { flex:1; display:flex; min-height:0; }
  .form { width:340px; min-width:240px; max-width:60%; overflow:auto; padding:12px;
          border-right:1px solid var(--vscode-panel-border); }
  .form.collapsed { display:none; }
  .splitter { width:6px; cursor:col-resize; background:transparent; flex:0 0 auto; }
  .splitter:hover { background: var(--vscode-panel-border); }
  body.sidebar-hidden .splitter { display:none; }
  .desk { flex:1; min-width:0; overflow:auto; background:#525659; display:flex;
          justify-content:center; align-items:flex-start; padding:20px; }
  iframe { border:0; background:#fff; box-shadow:0 2px 16px rgba(0,0,0,.5); }

  /* Fullscreen preview */
  body.preview-full .toolbar, body.preview-full .form, body.preview-full .splitter { display:none; }
  body.preview-full .desk { position:fixed; inset:0; z-index:100; }
  #exitFsBtn { position:fixed; top:10px; right:10px; z-index:101; display:none; box-shadow:0 1px 6px rgba(0,0,0,.3); }
  body.preview-full #exitFsBtn { display:inline-flex; }

  fieldset { border:1px solid var(--vscode-panel-border); border-radius:6px; margin:0 0 12px; padding:8px 10px; }
  legend { font-weight:600; padding:0 4px; }
  label { display:block; font-size:11px; opacity:.85; margin:8px 0 2px; }
  .row { display:flex; gap:8px; }
  .row > div { flex:1; }
  .inline { display:flex; align-items:center; gap:6px; margin:6px 0; }
  .inline input[type=checkbox] { width:auto; }
  .color { display:flex; align-items:center; gap:6px; }
  .color input[type=color] { width:32px; height:26px; padding:0; border:none; background:none; }
  .swatches { display:flex; gap:4px; margin-top:4px; flex-wrap:wrap; }
  .swatch { width:16px; height:16px; border-radius:3px; cursor:pointer; border:1px solid rgba(0,0,0,.25); }
  .hint { font-size:10px; opacity:.6; margin-top:6px; }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="title" title="Markdown to PDF & Word Studio"><i class="codicon codicon-files"></i></span>
    <button class="secondary icon" id="toggleSidebarBtn" title="Hide sidebar"><i class="codicon codicon-layout-sidebar-left"></i></button>
    <button class="secondary icon" id="fullscreenBtn" title="Fullscreen preview"><i class="codicon codicon-screen-full"></i></button>
    <span class="zoom">
      <button class="secondary icon" id="zoomOutBtn" title="Zoom out"><i class="codicon codicon-zoom-out"></i></button>
      <span id="zoomLabel">100%</span>
      <button class="secondary icon" id="zoomInBtn" title="Zoom in"><i class="codicon codicon-zoom-in"></i></button>
      <button class="secondary icon" id="fitBtn" title="Fit page width"><i class="codicon codicon-screen-normal"></i></button>
    </span>
    <span class="sep"></span>
    <select id="profileSelect" style="width:auto;min-width:130px" title="Profile"></select>
    <button class="secondary icon" id="newBtn" title="New profile"><i class="codicon codicon-add"></i></button>
    <button class="secondary icon" id="dupBtn" title="Duplicate profile"><i class="codicon codicon-copy"></i></button>
    <button class="secondary icon" id="saveBtn" title="Save profile to .markready/profiles"><i class="codicon codicon-save"></i></button>
    <button class="secondary icon" id="deleteBtn" title="Delete profile"><i class="codicon codicon-trash"></i></button>
    <button class="secondary icon" id="resetBtn" title="Reset to preset"><i class="codicon codicon-discard"></i></button>
    <button class="secondary icon" id="importBtn" title="Import profile JSON"><i class="codicon codicon-cloud-upload"></i></button>
    <button class="secondary icon" id="exportProfileBtn" title="Export profile JSON"><i class="codicon codicon-cloud-download"></i></button>
    <button class="secondary icon" id="refreshBtn" title="Reload from the active markdown editor"><i class="codicon codicon-refresh"></i></button>
    <span class="spacer"></span>
    <button id="pdfBtn"><i class="codicon codicon-export"></i>PDF</button>
    <button id="docxBtn"><i class="codicon codicon-file"></i>Word</button>
    <button class="secondary" id="htmlBtn"><i class="codicon codicon-file-code"></i>HTML</button>
  </div>
  <button class="secondary" id="exitFsBtn" title="Exit fullscreen (Esc)"><i class="codicon codicon-screen-normal"></i>Exit fullscreen</button>
  <div class="main">
    <div class="form">
      <fieldset>
        <legend>Profile</legend>
        <label>Profile name</label>
        <input type="text" id="name"/>
      </fieldset>

      <fieldset>
        <legend>Cover page</legend>
        <div class="inline"><input type="checkbox" id="coverEnabled"/><label style="margin:0">Show cover page</label></div>
        <label>Title</label><input type="text" id="coverTitle"/>
        <label>Subtitle</label><input type="text" id="coverSubtitle"/>
        <div class="row">
          <div><label>Author</label><input type="text" id="coverAuthor"/></div>
          <div><label>Company</label><input type="text" id="coverCompany"/></div>
        </div>
        <label>Date</label>
        <div class="row">
          <div><input type="text" id="coverDate" placeholder="{{today}} or any text"/></div>
          <input type="date" id="coverDatePick" title="Pick a specific date"/>
        </div>
        <label>Logo</label>
        <div class="row">
          <div><input type="text" id="coverLogo" placeholder="path/to/logo.png"/></div>
          <button class="secondary" id="logoBtn" style="white-space:nowrap"><i class="codicon codicon-folder-opened"></i>Browse</button>
        </div>
        <div class="hint">Placeholders: {{filename}}, {{title}}, {{today}}, {{author}}, {{company}}, {{date}} (front-matter aware)</div>
      </fieldset>

      <fieldset>
        <legend>Branding</legend>
        <label>Primary color</label>
        <div class="color"><input type="color" id="primaryColorPick"/><input type="text" id="primaryColor"/></div>
        <div class="swatches" data-target="primaryColor"></div>
        <label>Text color</label>
        <div class="color"><input type="color" id="textColorPick"/><input type="text" id="textColor"/></div>
        <label>Heading font</label><input type="text" id="fontHeading" list="fontList"/>
        <label>Body font</label><input type="text" id="fontBody" list="fontList"/>
        <label>Base font size</label><input type="text" id="fontSize" placeholder="11pt"/>
      </fieldset>

      <fieldset>
        <legend>Header & footer</legend>
        <div class="inline"><input type="checkbox" id="headerShow"/><label style="margin:0">Show header</label></div>
        <label>Header text</label><input type="text" id="headerText"/>
        <div class="inline"><input type="checkbox" id="footerPageNumbers"/><label style="margin:0">Page numbers in footer</label></div>
        <label>Footer text</label><input type="text" id="footerText"/>
      </fieldset>

      <fieldset>
        <legend>Layout</legend>
        <div class="row">
          <div><label>Page size</label>
            <select id="pageSize"><option>A4</option><option>Letter</option><option>Legal</option></select></div>
          <div><label>Orientation</label>
            <select id="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
        </div>
        <label>Margin</label><input type="text" id="margin" placeholder="2cm"/>
        <div class="inline"><input type="checkbox" id="tocEnabled"/><label style="margin:0">Insert Table of Contents</label></div>
        <div class="row">
          <div><label>TOC depth</label>
            <select id="tocDepth"><option value="1">H1</option><option value="2">H1–H2</option><option value="3">H1–H3</option><option value="4">H1–H4</option><option value="5">H1–H5</option><option value="6">H1–H6</option></select></div>
          <div><label>&nbsp;</label>
            <div class="inline"><input type="checkbox" id="headingNumbers"/><label style="margin:0">Number headings</label></div></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Style & extras</legend>
        <label>Code theme</label>
        <select id="codeTheme">
          <option value="github">GitHub (light)</option>
          <option value="github-dark">GitHub (dark)</option>
          <option value="atom-one-light">Atom One (light)</option>
          <option value="atom-one-dark">Atom One (dark)</option>
          <option value="vs">Visual Studio</option>
          <option value="monokai">Monokai</option>
        </select>
        <div class="inline"><input type="checkbox" id="math"/><label style="margin:0">Render math ($...$ via KaTeX)</label></div>
        <label>Watermark text (optional)</label><input type="text" id="watermark" placeholder="e.g. DRAFT"/>
      </fieldset>

      <fieldset>
        <legend>Cleanup (de-AI-ify)</legend>
        <div class="inline"><input type="checkbox" id="cl_removeChatter"/><label style="margin:0">Remove AI chatter</label></div>
        <div class="inline"><input type="checkbox" id="cl_removeEmoji"/><label style="margin:0">Strip emoji</label></div>
        <div class="inline"><input type="checkbox" id="cl_normalizeHeadings"/><label style="margin:0">Normalize headings</label></div>
        <div class="inline"><input type="checkbox" id="cl_normalizeWhitespace"/><label style="margin:0">Collapse blank lines</label></div>
        <div class="inline"><input type="checkbox" id="cl_normalizePunctuation"/><label style="margin:0">Plain punctuation</label></div>
        <div class="hint">These affect this preview/export only. Defaults come from settings.</div>
      </fieldset>
      <div class="hint">Tip: "Save" stores the profile in <code>.markready/profiles</code> so your whole team exports with the same look (commit it to git).</div>
    </div>
    <div class="splitter" id="splitter"></div>
    <div class="desk"><iframe id="preview" sandbox="allow-same-origin"></iframe></div>
  </div>

  <datalist id="fontList">
    <option value="Arial, sans-serif"></option>
    <option value="Calibri, 'Segoe UI', Arial, sans-serif"></option>
    <option value="'Segoe UI', Arial, sans-serif"></option>
    <option value="Georgia, 'Times New Roman', serif"></option>
    <option value="'Times New Roman', serif"></option>
    <option value="Cambria, Georgia, serif"></option>
    <option value="Garamond, serif"></option>
    <option value="Helvetica, Arial, sans-serif"></option>
    <option value="Verdana, sans-serif"></option>
    <option value="Tahoma, sans-serif"></option>
    <option value="'Trebuchet MS', sans-serif"></option>
    <option value="'Courier New', monospace"></option>
  </datalist>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  let suppress = false;
  const SWATCHES = ["#1a3d7c","#0f766e","#374151","#111111","#b91c1c","#7c3aed","#c2410c","#047857"];

  const ids = ["name","coverEnabled","coverTitle","coverSubtitle","coverAuthor","coverCompany","coverDate","coverLogo",
    "primaryColor","textColor","fontHeading","fontBody","fontSize",
    "headerShow","headerText","footerPageNumbers","footerText","pageSize","orientation","margin",
    "tocEnabled","tocDepth","headingNumbers","codeTheme","math","watermark"];
  const cleanupIds = ["removeChatter","removeEmoji","normalizeHeadings","normalizeWhitespace","normalizePunctuation"];
  const $ = (id) => document.getElementById(id);

  // ---- Persisted UI state ----
  const ui = Object.assign({ sidebar:true, formWidth:340, zoom:1 }, vscode.getState() || {});
  function saveUi(){ vscode.setState(ui); }

  function readForm() {
    return {
      name: $("name").value,
      cover: {
        enabled: $("coverEnabled").checked,
        title: $("coverTitle").value, subtitle: $("coverSubtitle").value,
        author: $("coverAuthor").value, company: $("coverCompany").value,
        date: $("coverDate").value, logo: $("coverLogo").value,
      },
      branding: {
        primaryColor: $("primaryColor").value, textColor: $("textColor").value,
        fontHeading: $("fontHeading").value, fontBody: $("fontBody").value, fontSize: $("fontSize").value,
      },
      header: { show: $("headerShow").checked, text: $("headerText").value },
      footer: { pageNumbers: $("footerPageNumbers").checked, text: $("footerText").value },
      layout: { pageSize: $("pageSize").value, orientation: $("orientation").value, margin: $("margin").value },
      options: {
        toc: $("tocEnabled").checked, tocDepth: parseInt($("tocDepth").value,10) || 3,
        headingNumbers: $("headingNumbers").checked, codeTheme: $("codeTheme").value,
        math: $("math").checked, watermark: $("watermark").value,
      },
    };
  }

  function readCleanup() {
    const c = {};
    cleanupIds.forEach((k) => c[k] = $("cl_"+k).checked);
    return c;
  }

  function fillForm(p) {
    suppress = true;
    $("name").value = p.name || "";
    $("coverEnabled").checked = !!p.cover.enabled;
    $("coverTitle").value = p.cover.title || "";
    $("coverSubtitle").value = p.cover.subtitle || "";
    $("coverAuthor").value = p.cover.author || "";
    $("coverCompany").value = p.cover.company || "";
    $("coverDate").value = p.cover.date || "";
    $("coverLogo").value = p.cover.logo || "";
    $("primaryColor").value = p.branding.primaryColor || "#000000";
    $("primaryColorPick").value = toHex(p.branding.primaryColor);
    $("textColor").value = p.branding.textColor || "#222222";
    $("textColorPick").value = toHex(p.branding.textColor);
    $("fontHeading").value = p.branding.fontHeading || "";
    $("fontBody").value = p.branding.fontBody || "";
    $("fontSize").value = p.branding.fontSize || "11pt";
    $("headerShow").checked = !!p.header.show;
    $("headerText").value = p.header.text || "";
    $("footerPageNumbers").checked = !!p.footer.pageNumbers;
    $("footerText").value = p.footer.text || "";
    $("pageSize").value = p.layout.pageSize || "A4";
    $("orientation").value = p.layout.orientation || "portrait";
    $("margin").value = p.layout.margin || "2cm";
    const o = p.options || {};
    $("tocEnabled").checked = !!o.toc;
    $("tocDepth").value = String(o.tocDepth || 3);
    $("headingNumbers").checked = !!o.headingNumbers;
    $("codeTheme").value = o.codeTheme || "github";
    $("math").checked = !!o.math;
    $("watermark").value = o.watermark || "";
    suppress = false;
    validate();
  }

  function fillCleanup(c) {
    suppress = true;
    cleanupIds.forEach((k) => { if ($("cl_"+k)) $("cl_"+k).checked = !!(c && c[k]); });
    suppress = false;
  }

  function toHex(c) {
    if (!c) return "#000000";
    const m = String(c).trim().match(/^#([0-9a-f]{6})$/i);
    return m ? "#" + m[1] : "#000000";
  }

  function validate() {
    const unit = /^\\s*\\d+(\\.\\d+)?\\s*(cm|mm|in|px|pt)\\s*$/i;
    [["margin",unit],["fontSize",unit]].forEach(([id,re]) => {
      const el = $(id); if (!el) return;
      el.classList.toggle("invalid", el.value.trim() !== "" && !re.test(el.value));
    });
  }

  let timer = null;
  function pushChange() {
    if (suppress) return;
    validate();
    clearTimeout(timer);
    timer = setTimeout(() => vscode.postMessage({ type: "change", profile: readForm() }), 150);
  }

  ids.forEach((id) => {
    const el = $(id);
    el.addEventListener("input", pushChange);
    el.addEventListener("change", pushChange);
  });
  cleanupIds.forEach((k) => $("cl_"+k).addEventListener("change", () =>
    vscode.postMessage({ type: "cleanup", cleanup: readCleanup() })));

  $("primaryColorPick").addEventListener("input", (e) => { $("primaryColor").value = e.target.value; pushChange(); });
  $("textColorPick").addEventListener("input", (e) => { $("textColor").value = e.target.value; pushChange(); });

  // Color swatches
  document.querySelectorAll(".swatches").forEach((row) => {
    const target = row.getAttribute("data-target");
    SWATCHES.forEach((c) => {
      const b = document.createElement("span");
      b.className = "swatch"; b.style.background = c; b.title = c;
      b.addEventListener("click", () => { $(target).value = c; $(target+"Pick").value = toHex(c); pushChange(); });
      row.appendChild(b);
    });
  });

  // Date picker -> formatted text (timezone-safe)
  $("coverDatePick").addEventListener("change", (e) => {
    const v = e.target.value; if (!v) return;
    const [y,m,d] = v.split("-").map(Number);
    $("coverDate").value = new Date(y, m-1, d).toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });
    pushChange();
  });

  // Profile management
  $("profileSelect").addEventListener("change", (e) => vscode.postMessage({ type: "selectProfile", name: e.target.value }));
  $("newBtn").addEventListener("click", () => vscode.postMessage({ type: "newProfile" }));
  $("dupBtn").addEventListener("click", () => vscode.postMessage({ type: "duplicateProfile", profile: readForm() }));
  $("saveBtn").addEventListener("click", () => vscode.postMessage({ type: "save", profile: readForm() }));
  $("deleteBtn").addEventListener("click", () => vscode.postMessage({ type: "deleteProfile", profile: readForm() }));
  $("resetBtn").addEventListener("click", () => vscode.postMessage({ type: "resetProfile", profile: readForm() }));
  $("importBtn").addEventListener("click", () => vscode.postMessage({ type: "importProfile" }));
  $("exportProfileBtn").addEventListener("click", () => vscode.postMessage({ type: "exportProfile", profile: readForm() }));
  $("refreshBtn").addEventListener("click", () => vscode.postMessage({ type: "refreshSource" }));
  $("logoBtn").addEventListener("click", () => vscode.postMessage({ type: "pickLogo", profile: readForm() }));
  $("pdfBtn").addEventListener("click", () => vscode.postMessage({ type: "export", format: "pdf", profile: readForm() }));
  $("docxBtn").addEventListener("click", () => vscode.postMessage({ type: "export", format: "docx", profile: readForm() }));
  $("htmlBtn").addEventListener("click", () => vscode.postMessage({ type: "export", format: "html", profile: readForm() }));

  // Sidebar toggle
  function applySidebar() {
    const form = document.querySelector(".form");
    form.classList.toggle("collapsed", !ui.sidebar);
    document.body.classList.toggle("sidebar-hidden", !ui.sidebar);
    const btn = $("toggleSidebarBtn");
    btn.title = ui.sidebar ? "Hide sidebar" : "Show sidebar";
    btn.querySelector("i").className = "codicon codicon-layout-sidebar-left" + (ui.sidebar ? "" : "-off");
  }
  $("toggleSidebarBtn").addEventListener("click", () => { ui.sidebar = !ui.sidebar; saveUi(); applySidebar(); });

  // Fullscreen
  function setFullscreen(on) {
    document.body.classList.toggle("preview-full", on);
    const i = $("fullscreenBtn").querySelector("i");
    i.className = on ? "codicon codicon-screen-normal" : "codicon codicon-screen-full";
    $("fullscreenBtn").title = on ? "Exit fullscreen" : "Fullscreen preview";
    sizePage();
  }
  $("fullscreenBtn").addEventListener("click", () => setFullscreen(!document.body.classList.contains("preview-full")));
  $("exitFsBtn").addEventListener("click", () => setFullscreen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setFullscreen(false); });

  // Splitter drag
  (function(){
    const form = document.querySelector(".form");
    form.style.width = ui.formWidth + "px";
    let dragging = false;
    $("splitter").addEventListener("mousedown", (e) => { dragging = true; e.preventDefault(); document.body.style.userSelect="none"; });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const left = document.querySelector(".main").getBoundingClientRect().left;
      let w = Math.max(240, Math.min(e.clientX - left, window.innerWidth*0.6));
      form.style.width = w + "px"; ui.formWidth = Math.round(w);
    });
    window.addEventListener("mouseup", () => { if (dragging){ dragging=false; document.body.style.userSelect=""; saveUi(); } });
  })();

  // ---- Page sizing / zoom (matches render.ts page geometry) ----
  function pageDimsPx() {
    const dims = { A4:[794,1123], Letter:[816,1056], Legal:[816,1344] };
    let [w,h] = dims[$("pageSize").value] || dims.A4;
    if (($("orientation").value || "portrait") === "landscape") { const t=w; w=h; h=t; }
    return { w, h };
  }
  function sizePage() {
    const ifr = $("preview");
    const { w, h } = pageDimsPx();
    ifr.style.width = w + "px";
    try {
      const doc = ifr.contentDocument;
      if (doc && doc.body) {
        const sh = doc.documentElement.scrollHeight;
        const pages = Math.max(1, Math.ceil((sh - 2) / h)); // round up to whole pages
        ifr.style.height = (pages * h) + "px";
      }
    } catch (e) {}
    ifr.style.zoom = ui.zoom;
    $("zoomLabel").textContent = Math.round(ui.zoom*100) + "%";
  }
  function setZoom(z) { ui.zoom = Math.max(0.25, Math.min(3, z)); saveUi(); sizePage(); }
  $("zoomInBtn").addEventListener("click", () => setZoom(ui.zoom + 0.1));
  $("zoomOutBtn").addEventListener("click", () => setZoom(ui.zoom - 0.1));
  $("fitBtn").addEventListener("click", () => {
    const deskW = document.querySelector(".desk").clientWidth - 40;
    setZoom(deskW / pageDimsPx().w);
  });

  $("preview").addEventListener("load", () => {
    sizePage();
    // Esc to exit fullscreen even when focus is inside the (same-origin) preview.
    try {
      const doc = $("preview").contentDocument;
      doc && doc.addEventListener("keydown", (e) => { if (e.key === "Escape") setFullscreen(false); });
    } catch (e) {}
  });
  window.addEventListener("resize", sizePage);

  window.addEventListener("message", (event) => {
    const m = event.data;
    if (m.type === "init") {
      const sel = $("profileSelect");
      sel.innerHTML = "";
      (m.profiles || []).forEach((n) => {
        const o = document.createElement("option");
        o.value = n; o.textContent = n; sel.appendChild(o);
      });
      sel.value = m.profile.name;
      fillForm(m.profile);
      if (m.cleanup) fillCleanup(m.cleanup);
    } else if (m.type === "setProfile") {
      fillForm(m.profile);
      const sel = $("profileSelect");
      if (![...sel.options].some(o => o.value === m.profile.name)) {
        const o = document.createElement("option"); o.value = m.profile.name; o.textContent = m.profile.name; sel.appendChild(o);
      }
      sel.value = m.profile.name;
    } else if (m.type === "preview") {
      $("preview").srcdoc = m.html;
    } else if (m.type === "source") {
      // filename changed; nothing to render here directly
    }
  });

  applySidebar();
  $("zoomLabel").textContent = Math.round(ui.zoom*100) + "%";
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "profile";
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
