/**
 * Folder Gather panel — lists every .md file found in a folder, lets the user
 * include/exclude and REORDER them, then combine into one document (with optional
 * Table of Contents) and export to PDF / Word / HTML.
 */

import * as vscode from "vscode";
import * as path from "path";
import {
  DocProfile,
  loadProfiles,
  getProfile,
  cloneProfile,
  defaultProfile,
} from "./profiles";
import { CleanupOptions } from "./cleanup";
import { GatheredFile, combineMarkdown } from "./gather";
import { makeContext, runExport, Format } from "./runner";

export interface GatherInit {
  folder: string;
  files: GatheredFile[];
  workspaceRoot: string | undefined;
  cleanup: CleanupOptions;
  defaultProfileName: string;
}

export class GatherPanel {
  public static current: GatherPanel | undefined;
  private static readonly viewType = "markready.gather";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private folder: string;
  private files: GatheredFile[];
  private byRel: Map<string, GatheredFile>;
  private workspaceRoot: string | undefined;
  private cleanup: CleanupOptions;
  private defaultProfileName: string;

  public static createOrShow(context: vscode.ExtensionContext, init: GatherInit) {
    const column = vscode.ViewColumn.Active;
    if (GatherPanel.current) {
      GatherPanel.current.reset(init);
      GatherPanel.current.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      GatherPanel.viewType,
      "Markdown to PDF & Word — Gather Folder",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "node_modules", "@vscode", "codicons", "dist"),
        ],
      }
    );
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "icon.png");
    GatherPanel.current = new GatherPanel(panel, init, context.extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, init: GatherInit, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.folder = init.folder;
    this.files = init.files;
    this.byRel = new Map(init.files.map((f) => [f.rel, f]));
    this.workspaceRoot = init.workspaceRoot;
    this.cleanup = init.cleanup;
    this.defaultProfileName = init.defaultProfileName;

    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage((m) => this.onMessage(m), null, this.disposables);
  }

  private reset(init: GatherInit) {
    this.folder = init.folder;
    this.files = init.files;
    this.byRel = new Map(init.files.map((f) => [f.rel, f]));
    this.workspaceRoot = init.workspaceRoot;
    this.cleanup = init.cleanup;
    this.defaultProfileName = init.defaultProfileName;
    this.sendInit();
  }

  private profileNames(): string[] {
    return loadProfiles(this.workspaceRoot).map((p) => p.name);
  }

  private sendInit() {
    this.panel.webview.postMessage({
      type: "init",
      files: this.files.map((f) => f.rel),
      profiles: this.profileNames(),
      defaultProfile: this.defaultProfileName,
      folder: path.basename(this.folder),
    });
  }

  private async onMessage(msg: any) {
    if (msg?.type === "ready") {
      this.sendInit();
      return;
    }
    if (msg?.type === "export") {
      const order: string[] = Array.isArray(msg.order) ? msg.order : [];
      const ordered = order
        .map((rel) => this.byRel.get(rel))
        .filter((f): f is GatheredFile => !!f);
      if (!ordered.length) {
        vscode.window.showWarningMessage("Markdown to PDF & Word: select at least one file to include.");
        return;
      }

      const combined = combineMarkdown(ordered, {
        addSectionTitles: !!msg.sectionTitles,
        pageBreaks: !!msg.pageBreaks,
      });

      const base: DocProfile =
        getProfile(this.workspaceRoot, msg.profileName) || defaultProfile();
      const profile = cloneProfile(base);
      profile.options.toc = !!msg.toc;

      const name = path.basename(this.folder) + "-combined";
      await runExport({
        format: msg.format as Format,
        markdown: combined,
        profile,
        cleanup: this.cleanup,
        ctx: makeContext(name, this.folder),
        defaultPath: path.join(this.folder, name),
        chromePath: vscode.workspace.getConfiguration("markready").get<string>("chromePath", ""),
      });
    }
  }

  private dispose() {
    GatherPanel.current = undefined;
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
      `style-src 'unsafe-inline' ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return /* html */ `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<link href="${codiconUri}" rel="stylesheet"/>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); margin: 0; padding: 12px; }
  h2 { margin: 0 0 10px; font-size: 15px; display:flex; align-items:center; gap:6px; }
  .bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;
         padding-bottom:12px; border-bottom:1px solid var(--vscode-panel-border); }
  .bar .spacer { flex:1; }
  select { background: var(--vscode-input-background); color: var(--vscode-input-foreground);
           border:1px solid var(--vscode-input-border,#888); border-radius:4px; padding:4px 6px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
           border:none; border-radius:4px; padding:6px 10px; cursor:pointer;
           display:inline-flex; align-items:center; gap:5px; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.icon { padding:4px 6px; }
  button:hover { opacity:.9; }
  .codicon { font-size:14px; line-height:1; }
  label.chk { display:inline-flex; align-items:center; gap:5px; font-size:12px; }
  ul { list-style:none; margin:0; padding:0; }
  li { display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--vscode-panel-border);
       border-radius:6px; margin-bottom:6px; background: var(--vscode-editor-background); }
  li .name { flex:1; font-size:13px; }
  li.excluded .name { opacity:.4; text-decoration:line-through; }
  .idx { opacity:.5; font-size:11px; width:22px; text-align:right; }
  .hint { font-size:11px; opacity:.65; margin-top:10px; }
</style>
</head>
<body>
  <h2><i class="codicon codicon-files"></i><span id="title">Gather Folder</span></h2>
  <div class="bar">
    <label>Profile:</label>
    <select id="profileSelect"></select>
    <label class="chk"><input type="checkbox" id="toc"/> Table of Contents</label>
    <label class="chk"><input type="checkbox" id="sectionTitles" checked/> Section titles</label>
    <label class="chk"><input type="checkbox" id="pageBreaks" checked/> Page breaks</label>
    <span class="spacer"></span>
    <button id="pdfBtn"><i class="codicon codicon-export"></i>PDF</button>
    <button id="docxBtn"><i class="codicon codicon-file"></i>Word</button>
    <button class="secondary" id="htmlBtn"><i class="codicon codicon-file-code"></i>HTML</button>
  </div>
  <ul id="list"></ul>
  <div class="hint">Use the arrows to reorder, untick to exclude. Files are combined top-to-bottom.</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  let items = []; // { rel, included }

  function render() {
    const ul = $("list");
    ul.innerHTML = "";
    items.forEach((it, i) => {
      const li = document.createElement("li");
      if (!it.included) li.className = "excluded";

      const chk = document.createElement("input");
      chk.type = "checkbox"; chk.checked = it.included;
      chk.addEventListener("change", () => { it.included = chk.checked; render(); });

      const idx = document.createElement("span");
      idx.className = "idx"; idx.textContent = (i + 1);

      const name = document.createElement("span");
      name.className = "name"; name.textContent = it.rel;

      const up = document.createElement("button");
      up.className = "secondary icon"; up.title = "Move up";
      up.innerHTML = '<i class="codicon codicon-arrow-up"></i>';
      up.disabled = i === 0;
      up.addEventListener("click", () => { move(i, i - 1); });

      const down = document.createElement("button");
      down.className = "secondary icon"; down.title = "Move down";
      down.innerHTML = '<i class="codicon codicon-arrow-down"></i>';
      down.disabled = i === items.length - 1;
      down.addEventListener("click", () => { move(i, i + 1); });

      li.appendChild(chk);
      li.appendChild(idx);
      li.appendChild(name);
      li.appendChild(up);
      li.appendChild(down);
      ul.appendChild(li);
    });
  }

  function move(from, to) {
    if (to < 0 || to >= items.length) return;
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    render();
  }

  function doExport(format) {
    const order = items.filter((it) => it.included).map((it) => it.rel);
    vscode.postMessage({
      type: "export",
      format,
      order,
      toc: $("toc").checked,
      sectionTitles: $("sectionTitles").checked,
      pageBreaks: $("pageBreaks").checked,
      profileName: $("profileSelect").value,
    });
  }

  $("pdfBtn").addEventListener("click", () => doExport("pdf"));
  $("docxBtn").addEventListener("click", () => doExport("docx"));
  $("htmlBtn").addEventListener("click", () => doExport("html"));

  window.addEventListener("message", (e) => {
    const m = e.data;
    if (m.type === "init") {
      $("title").textContent = m.folder + " — " + m.files.length + " file(s)";
      const sel = $("profileSelect");
      sel.innerHTML = "";
      (m.profiles || []).forEach((n) => {
        const o = document.createElement("option");
        o.value = n; o.textContent = n; sel.appendChild(o);
      });
      if (m.defaultProfile) sel.value = m.defaultProfile;
      items = (m.files || []).map((rel) => ({ rel, included: true }));
      render();
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
