import { basicSetup, EditorView } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { Compartment, EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import "./workbench.css";
import "./documentation.js";

const starterCode = `local message = "Hello, Luau!"
print(message)`;
const editorHost = document.querySelector("#editor");
const fileTabs = document.querySelector("#file-tabs");
const outputHost = document.querySelector("#output");
const outputPanel = document.querySelector("#output-panel");
const runButton = document.querySelector("#run-button");
const checkButton = document.querySelector("#check-button");
const runState = document.querySelector("#run-state");
const themeButton = document.querySelector("#theme-button");
const lineWrapToggle = document.querySelector("#line-wrap");
const wrapCompartment = new Compartment();
let activeWorker;
let timeoutId;
let activeFile = 0;
let darkMode = localStorage.getItem("luau-playground-theme") === "dark";

function decodeShareCode(hash) {
  if (!hash.startsWith("#code=")) return null;
  return decodeURIComponent(escape(atob(hash.slice(6))));
}

let savedFiles;
try {
  savedFiles = JSON.parse(localStorage.getItem("luau-playground-files") || "null");
} catch {
  savedFiles = null;
}

const files = Array.isArray(savedFiles) && savedFiles.length
  ? savedFiles
  : [{ name: "main.luau", doc: localStorage.getItem("luau-playground-code") || starterCode }];
const sharedCode = decodeShareCode(location.hash);
if (sharedCode !== null) files[0].doc = sharedCode;

function saveFiles() {
  localStorage.setItem("luau-playground-files", JSON.stringify(files));
  localStorage.setItem("luau-playground-code", files[0].doc);
}

function renderTabs() {
  fileTabs.replaceChildren();
  files.forEach((file, index) => {
    const tabShell = document.createElement("div");
    tabShell.className = "file-tab-shell";
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "file-tab";
    tab.textContent = file.name;
    tab.setAttribute("aria-current", index === activeFile ? "page" : "false");
    tab.addEventListener("click", () => selectFile(index));
    tabShell.append(tab);
    if (files.length > 1) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "file-tab-close";
      close.textContent = "×";
      close.setAttribute("aria-label", `Close ${file.name}`);
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        closeFile(index);
      });
      tabShell.append(close);
    }
    fileTabs.append(tabShell);
  });
}

function selectFile(index) {
  if (index === activeFile) return;
  files[activeFile].doc = editor.state.doc.toString();
  activeFile = index;
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: files[index].doc } });
  renderTabs();
  editor.focus();
}

function addFile() {
  let suffix = files.length > 1 ? files.length : 0;
  let name = suffix ? `untitled-${suffix}.luau` : "untitled.luau";
  while (files.some((file) => file.name === name)) {
    suffix += 1;
    name = `untitled-${suffix}.luau`;
  }
  files[activeFile].doc = editor.state.doc.toString();
  files.push({ name, doc: "" });
  activeFile = files.length - 1;
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: "" } });
  renderTabs();
  editor.focus();
}

function closeFile(index) {
  if (files.length === 1) return;
  if (index === activeFile) files[index].doc = editor.state.doc.toString();
  files.splice(index, 1);
  const switchActiveFile = index === activeFile;
  if (index < activeFile) activeFile -= 1;
  else if (switchActiveFile) activeFile = Math.min(index, files.length - 1);
  if (switchActiveFile) {
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: files[activeFile].doc } });
  }
  renderTabs();
  saveFiles();
}

function setTheme() {
  const theme = darkMode ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = darkMode ? "☼" : "◐";
  themeButton.setAttribute("aria-label", `Switch to ${darkMode ? "light" : "dark"} mode`);
  themeButton.title = `Switch to ${darkMode ? "light" : "dark"} mode`;
  localStorage.setItem("luau-playground-theme", theme);
}

function shareUrl() {
  let binary = "";
  for (const byte of new TextEncoder().encode(editor.state.doc.toString())) {
    binary += String.fromCharCode(byte);
  }
  const url = new URL(location.href);
  url.hash = `code=${btoa(binary)}`;
  return url.toString();
}

async function copyToClipboard(value, button, label) {
  await navigator.clipboard.writeText(value);
  const originalText = button.textContent;
  button.textContent = label;
  window.setTimeout(() => { button.textContent = originalText; }, 1200);
}

function setRunState(state, label) {
  runState.textContent = label || "";
  runState.hidden = !label;
  runState.dataset.state = state;
  runButton.disabled = state === "running";
  checkButton.disabled = state === "running";
  document.querySelector("#run-label").textContent = state === "running" ? "Running…" : "Run";
}

function appendOutput(text, kind = "normal") {
  if (outputHost.querySelector(".empty-state")) outputHost.replaceChildren();
  const line = document.createElement("div");
  line.className = `output-line ${kind}`;
  line.textContent = text;
  outputHost.append(line);
  outputHost.scrollTop = outputHost.scrollHeight;
}

function clearOutput() {
  outputHost.innerHTML = '<p class="empty-state">Run your code to see output here...</p>';
  setRunState("ready", "");
}

function stopWorker() {
  clearTimeout(timeoutId);
  activeWorker?.terminate();
  activeWorker = undefined;
}

async function runCode(mode = "run") {
  if (activeWorker) stopWorker();
  outputHost.replaceChildren();
  setRunState("running", mode === "check" ? "Checking…" : "Running…");
  const worker = new Worker(new URL("./luau.worker.js", import.meta.url), { type: "module" });
  activeWorker = worker;

  worker.addEventListener("message", (event) => {
    const { type, text } = event.data;
    if (type === "output") appendOutput(text);
    if (type === "warning") appendOutput(text, "warning");
    if (type === "error") appendOutput(text, "error");
    if (type === "booted") {
      worker.postMessage({ source: editor.state.doc.toString(), mode });
    }
    if (type === "done") {
      stopWorker();
      const label = event.data.failed ? "Error" : mode === "check" ? "Valid" : "Finished";
      setRunState(event.data.failed ? "error" : "ready", label);
    }
  });

  worker.addEventListener("error", (event) => {
    appendOutput(event.message || "The Luau runtime could not start.", "error");
    stopWorker();
    setRunState("error", "Error");
  });

  timeoutId = window.setTimeout(() => {
    if (!activeWorker) return;
    stopWorker();
    appendOutput("Execution stopped after 5 seconds.", "warning");
    setRunState("error", "Timed out");
  }, 5000);
}

if (sharedCode !== null) history.replaceState(null, "", location.pathname + location.search);
setTheme();
lineWrapToggle.checked = localStorage.getItem("luau-playground-wrap") === "true";

const editor = new EditorView({
  state: EditorState.create({
    doc: files[0].doc,
    extensions: [
      basicSetup,
      StreamLanguage.define(lua),
      keymap.of([{ key: "Mod-Enter", run: () => { runCode(); return true; } }]),
      wrapCompartment.of(lineWrapToggle.checked ? EditorView.lineWrapping : []),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        files[activeFile].doc = update.state.doc.toString();
        saveFiles();
      }),
    ],
  }),
  parent: editorHost,
});

renderTabs();
runButton.addEventListener("click", () => runCode());
checkButton.addEventListener("click", () => runCode("check"));
document.querySelector("#clear-output").addEventListener("click", clearOutput);
document.querySelector("#new-file").addEventListener("click", addFile);
document.querySelector("#output-toggle").addEventListener("click", (event) => {
  const expanded = outputPanel.dataset.collapsed !== "true";
  outputPanel.dataset.collapsed = String(expanded);
  event.currentTarget.setAttribute("aria-expanded", String(!expanded));
  event.currentTarget.setAttribute("aria-label", expanded ? "Expand output" : "Collapse output");
});
themeButton.addEventListener("click", () => {
  darkMode = !darkMode;
  setTheme();
});
document.querySelector("#settings-button").addEventListener("click", () => document.querySelector("#settings-dialog").showModal());
lineWrapToggle.addEventListener("change", () => {
  localStorage.setItem("luau-playground-wrap", String(lineWrapToggle.checked));
  editor.dispatch({ effects: wrapCompartment.reconfigure(lineWrapToggle.checked ? EditorView.lineWrapping : []) });
});
document.querySelector("#bytecode-button").addEventListener("click", () => document.querySelector("#bytecode-dialog").showModal());
document.querySelector("#share-button").addEventListener("click", (event) => copyToClipboard(shareUrl(), event.currentTarget, "Copied"));
document.querySelector("#embed-button").addEventListener("click", () => {
  const url = shareUrl().replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  document.querySelector("#embed-code").value = `<iframe src="${url}" title="LuauEasy" width="100%" height="600"></iframe>`;
  document.querySelector("#embed-dialog").showModal();
});
document.querySelector("#copy-embed").addEventListener("click", (event) => copyToClipboard(document.querySelector("#embed-code").value, event.currentTarget, "Copied"));