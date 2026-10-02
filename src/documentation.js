import { basicSetup, EditorView } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { EditorState } from "@codemirror/state";

const path = location.pathname.replace(/\/+$/, "");

if (path.endsWith("/documentation")) {
  document.querySelector(".app-shell").classList.add("app-hidden");
  document.querySelector("#documentation-app").hidden = false;
  initializeDocumentation();
}

function initializeDocumentation() {
  const descriptions = {
    output: "Print shows text or a value in the output below.",
    math: "Luau calculates the expression before print displays it.",
    variables: "A local variable keeps a value you can reuse later.",
  };
  const drafts = {
    output: 'print("Hello, Luau!")',
    math: "print(2 + 3)\nprint(10 / 2)",
    variables: 'local name = "Ada"\nlocal score = 10\nprint(name, score)',
  };
  const editorHost = document.querySelector("#documentation-editor");
  const output = document.querySelector("#example-output");
  const runButton = document.querySelector("#run-example");
  const status = document.querySelector("#example-status");
  const description = document.querySelector("#example-description");
  const feedback = document.querySelector("#answer-feedback");
  const editor = new EditorView({
    state: EditorState.create({
      doc: drafts.output,
      extensions: [basicSetup, StreamLanguage.define(lua)],
    }),
    parent: editorHost,
  });
  let activeWorker;
  let timeoutId;
  let activeExample = "output";

  function stopWorker() {
    clearTimeout(timeoutId);
    activeWorker?.terminate();
    activeWorker = undefined;
    runButton.disabled = false;
  }

  function addLine(text, kind = "normal") {
    if (output.querySelector(".empty-state")) output.replaceChildren();
    const line = document.createElement("div");
    line.className = `output-line ${kind}`;
    line.textContent = text;
    output.append(line);
  }

  function run() {
    if (activeWorker) stopWorker();
    output.replaceChildren();
    runButton.disabled = true;
    status.textContent = "Running…";
    let failed = false;
    const worker = new Worker(new URL("./luau.worker.js", import.meta.url), { type: "module" });
    activeWorker = worker;
    worker.addEventListener("message", (event) => {
      const { type, text } = event.data;
      if (type === "booted") worker.postMessage({ source: editor.state.doc.toString(), mode: "run" });
      if (type === "output") addLine(text);
      if (type === "warning") addLine(text, "warning");
      if (type === "error") {
        failed = true;
        addLine(text, "error");
      }
      if (type === "done") {
        stopWorker();
        status.textContent = failed || event.data.failed ? "Error" : "Finished";
      }
    });
    worker.addEventListener("error", (event) => {
      addLine(event.message || "The Luau runtime could not start.", "error");
      stopWorker();
      status.textContent = "Error";
    });
    timeoutId = window.setTimeout(() => {
      if (!activeWorker) return;
      stopWorker();
      addLine("Execution stopped after 5 seconds.", "warning");
      status.textContent = "Timed out";
    }, 5000);
  }

  editor.contentDOM.addEventListener("input", () => {
    drafts[activeExample] = editor.state.doc.toString();
  });

  document.querySelectorAll("[data-example]").forEach((tab) => {
    tab.addEventListener("click", () => {
      drafts[activeExample] = editor.state.doc.toString();
      activeExample = tab.dataset.example;
      document.querySelectorAll("[data-example]").forEach((item) => {
        item.setAttribute("aria-selected", String(item === tab));
      });
      description.textContent = descriptions[activeExample];
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: drafts[activeExample] } });
      editor.focus();
      status.textContent = "";
      output.innerHTML = '<p class="empty-state">Output</p>';
    });
  });

  runButton.addEventListener("click", run);
  document.querySelectorAll("[data-answer]").forEach((answer) => {
    answer.addEventListener("click", () => {
      const correct = answer.dataset.answer === "5";
      feedback.textContent = correct ? "Correct. Luau adds the numbers before printing." : "Not quite. Run the Math example to see what + does.";
      feedback.dataset.correct = String(correct);
    });
  });

  const themeButton = document.querySelector("#docs-theme");
  themeButton.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("luau-playground-theme", nextTheme);
    themeButton.textContent = nextTheme === "dark" ? "☼" : "◐";
    themeButton.setAttribute("aria-label", `Switch to ${nextTheme === "dark" ? "light" : "dark"} mode`);
  });
}
