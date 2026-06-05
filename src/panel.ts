/**
 * The Customization Studio — a Webview that visually edits a Document Profile and
 * shows a live preview by running the same render path used for export (true WYSIWYG).
 */

import * as vscode from "vscode";
import * as path from "path";
import {
  DocProfile,
  loadProfiles,
  getProfile,
  saveProfile,
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
  private profile: DocProfile;

  public static createOrShow(context: vscode.ExtensionContext, init: StudioInit) {
    const column = vscode.ViewColumn.Beside;
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
    this.profile =
      getProfile(init.workspaceRoot, init.defaultProfileName) || defaultProfile();

    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.onMessage(msg),
      null,
      this.disposables
    );
  }

  private reset(init: StudioInit) {
    this.markdown = init.markdown;
    this.filename = init.filename;
    this.baseDir = init.baseDir;
    this.workspaceRoot = init.workspaceRoot;
    this.cleanup = init.cleanup;
    this.post({ type: "source", filename: this.filename });
    this.sendInit();
  }

  private ctx() {
    return makeContext(this.filename, this.baseDir);
  }

  private profileNames(): string[] {
    return loadProfiles(this.workspaceRoot).map((p) => p.name);
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

      case "selectProfile": {
        this.profile = getProfile(this.workspaceRoot, msg.name);
        this.post({ type: "setProfile", profile: this.profile });
        this.renderPreview();
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
        this.post({ type: "init", profiles: this.profileNames(), profile: this.profile, filename: this.filename });
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
  .toolbar { display:flex; gap:8px; align-items:center; padding:8px 10px;
             border-bottom:1px solid var(--vscode-panel-border); flex-wrap:wrap; }
  .toolbar .spacer { flex:1; }
  select, input, button { font-family: inherit; font-size: 12px; }
  input[type=text], input[type=number], select {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #888); border-radius:4px; padding:4px 6px; width:100%;
  }
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
  .codicon { font-size:14px; line-height:1; }
  .title { display:inline-flex; align-items:center; gap:6px; font-weight:600; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button:hover { opacity:.9; }
  .main { flex:1; display:flex; min-height:0; }
  .form { width:340px; overflow:auto; padding:12px; border-right:1px solid var(--vscode-panel-border); }
  .form.collapsed { display:none; }
  .preview { flex:1; background:#fff; }
  iframe { width:100%; height:100%; border:0; background:#fff; }

  /* Fullscreen preview: the preview covers the whole webview, toolbar + form hidden. */
  body.preview-full .toolbar, body.preview-full .form { display:none; }
  body.preview-full .preview { position:fixed; inset:0; z-index:100; }
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
  .hint { font-size:10px; opacity:.6; margin-top:6px; }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="title" title="Markdown to PDF & Word Studio"><i class="codicon codicon-files"></i></span>
    <button class="secondary" id="toggleSidebarBtn" title="Hide sidebar"><i class="codicon codicon-layout-sidebar-left"></i></button>
    <button class="secondary" id="fullscreenBtn" title="Fullscreen preview"><i class="codicon codicon-screen-full"></i></button>
    <label style="margin:0;">Profile:</label>
    <select id="profileSelect" style="width:auto;min-width:140px"></select>
    <button class="secondary" id="saveBtn" title="Save this profile to .markready/profiles"><i class="codicon codicon-save"></i>Save Profile</button>
    <button class="secondary" id="refreshBtn" title="Reload from the active markdown editor"><i class="codicon codicon-refresh"></i>Refresh</button>
    <span class="spacer"></span>
    <button id="pdfBtn"><i class="codicon codicon-export"></i>Export PDF</button>
    <button id="docxBtn"><i class="codicon codicon-file"></i>Export Word</button>
    <button class="secondary" id="htmlBtn"><i class="codicon codicon-file-code"></i>Export HTML</button>
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
        <div class="hint">Placeholders: {{filename}}, {{today}}, {{author}}, {{company}}</div>
      </fieldset>

      <fieldset>
        <legend>Branding</legend>
        <label>Primary color</label>
        <div class="color"><input type="color" id="primaryColorPick"/><input type="text" id="primaryColor"/></div>
        <label>Text color</label>
        <div class="color"><input type="color" id="textColorPick"/><input type="text" id="textColor"/></div>
        <label>Heading font</label><input type="text" id="fontHeading"/>
        <label>Body font</label><input type="text" id="fontBody"/>
        <label>Base font size</label><input type="text" id="fontSize"/>
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
        <label>Margin</label><input type="text" id="margin"/>
        <div class="inline"><input type="checkbox" id="tocEnabled"/><label style="margin:0">Insert Table of Contents</label></div>
      </fieldset>
      <div class="hint">Tip: "Save Profile" stores it in <code>.markready/profiles</code> so your whole team exports with the same look (commit it to git).</div>
    </div>
    <div class="preview"><iframe id="preview" sandbox="allow-same-origin"></iframe></div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  let suppress = false;

  const ids = ["name","coverEnabled","coverTitle","coverSubtitle","coverAuthor","coverCompany","coverDate","coverLogo",
    "primaryColor","textColor","fontHeading","fontBody","fontSize",
    "headerShow","headerText","footerPageNumbers","footerText","pageSize","orientation","margin","tocEnabled"];
  const $ = (id) => document.getElementById(id);

  function readForm() {
    return {
      name: $("name").value,
      cover: {
        enabled: $("coverEnabled").checked,
        title: $("coverTitle").value,
        subtitle: $("coverSubtitle").value,
        author: $("coverAuthor").value,
        company: $("coverCompany").value,
        date: $("coverDate").value,
        logo: $("coverLogo").value,
      },
      branding: {
        primaryColor: $("primaryColor").value,
        textColor: $("textColor").value,
        fontHeading: $("fontHeading").value,
        fontBody: $("fontBody").value,
        fontSize: $("fontSize").value,
      },
      header: { show: $("headerShow").checked, text: $("headerText").value },
      footer: { pageNumbers: $("footerPageNumbers").checked, text: $("footerText").value },
      layout: { pageSize: $("pageSize").value, orientation: $("orientation").value, margin: $("margin").value },
      options: { toc: $("tocEnabled").checked },
    };
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
    $("tocEnabled").checked = !!(p.options && p.options.toc);
    suppress = false;
  }

  function toHex(c) {
    if (!c) return "#000000";
    const m = String(c).trim().match(/^#([0-9a-f]{6})$/i);
    return m ? "#" + m[1] : "#000000";
  }

  let timer = null;
  function pushChange() {
    if (suppress) return;
    clearTimeout(timer);
    timer = setTimeout(() => vscode.postMessage({ type: "change", profile: readForm() }), 150);
  }

  ids.forEach((id) => {
    const el = $(id);
    el.addEventListener("input", pushChange);
    el.addEventListener("change", pushChange);
  });
  $("primaryColorPick").addEventListener("input", (e) => { $("primaryColor").value = e.target.value; pushChange(); });
  $("textColorPick").addEventListener("input", (e) => { $("textColor").value = e.target.value; pushChange(); });

  $("profileSelect").addEventListener("change", (e) =>
    vscode.postMessage({ type: "selectProfile", name: e.target.value }));
  $("saveBtn").addEventListener("click", () => vscode.postMessage({ type: "save", profile: readForm() }));
  $("refreshBtn").addEventListener("click", () => vscode.postMessage({ type: "refreshSource" }));
  $("logoBtn").addEventListener("click", () => vscode.postMessage({ type: "pickLogo", profile: readForm() }));
  $("pdfBtn").addEventListener("click", () => vscode.postMessage({ type: "export", format: "pdf", profile: readForm() }));
  $("docxBtn").addEventListener("click", () => vscode.postMessage({ type: "export", format: "docx", profile: readForm() }));
  $("htmlBtn").addEventListener("click", () => vscode.postMessage({ type: "export", format: "html", profile: readForm() }));

  // Date picker: writes a formatted date into the free-text Date field (which still
  // accepts {{today}} or any text). Parse parts manually to avoid UTC off-by-one.
  $("coverDatePick").addEventListener("change", (e) => {
    const v = e.target.value; // YYYY-MM-DD
    if (!v) return;
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    $("coverDate").value = dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    pushChange();
  });

  // Hide/show the sidebar to give the preview the full panel width.
  $("toggleSidebarBtn").addEventListener("click", () => {
    const hidden = document.querySelector(".form").classList.toggle("collapsed");
    const btn = $("toggleSidebarBtn");
    btn.title = hidden ? "Show sidebar" : "Hide sidebar";
    btn.querySelector("i").className = "codicon codicon-layout-sidebar-left" + (hidden ? "-off" : "");
  });

  // Fullscreen preview: cover the whole webview so page layout is easy to see.
  function setFullscreen(on) {
    document.body.classList.toggle("preview-full", on);
    const i = $("fullscreenBtn").querySelector("i");
    i.className = on ? "codicon codicon-screen-normal" : "codicon codicon-screen-full";
    $("fullscreenBtn").title = on ? "Exit fullscreen" : "Fullscreen preview";
  }
  $("fullscreenBtn").addEventListener("click", () => setFullscreen(!document.body.classList.contains("preview-full")));
  $("exitFsBtn").addEventListener("click", () => setFullscreen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setFullscreen(false); });

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
    } else if (m.type === "setProfile") {
      fillForm(m.profile);
    } else if (m.type === "preview") {
      $("preview").srcdoc = m.html;
    }
  });

  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
