import { basicSetup, EditorView } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { EditorState } from "@codemirror/state";

const lessons = [
  {
    number: "1.1",
    title: "The basics",
    explanation: "A script runs from top to bottom. print() sends a value to Output.",
    examples: [
      { label: "First output", description: "Print one message.", code: 'print("Hello, Luau!")' },
      { label: "Two lines", description: "Each print() call writes a new line.", code: 'print("First")\nprint("Second")' },
    ],
    check: { question: "Which call prints a message?", options: ["print(\"Hi\")", "local(\"Hi\")", "output(\"Hi\")"], answer: 0, feedback: "print() writes a value to Output." },
  },
  {
    number: "1.2",
    title: "Values",
    explanation: "Text in quotes is a string. Numbers and true/false are values too.",
    examples: [
      { label: "Text", description: "Quotes make this value a string.", code: 'print("blue")' },
      { label: "Number", description: "Numbers can be printed without quotes.", code: "print(12)" },
      { label: "Boolean", description: "Booleans have only two values: true or false.", code: "print(true)\nprint(false)" },
    ],
    check: { question: "Which value is text?", options: ["8", "\"8\"", "true"], answer: 1, feedback: "Quotes mark the string \"8\" as text." },
  },
  {
    number: "1.3",
    title: "Variables",
    explanation: "Use local to store a value under a name, then read or update it.",
    examples: [
      { label: "Store", description: "The name score now refers to 10.", code: "local score = 10\nprint(score)" },
      { label: "Update", description: "Assign a new value to the variable.", code: "local score = 10\nscore = score + 1\nprint(score)" },
    ],
    check: { question: "What does this print? local coins = 4; coins = coins + 1", options: ["4", "5", "coins"], answer: 1, feedback: "The variable changes from 4 to 5." },
  },
  {
    number: "1.4",
    title: "Arithmetic",
    explanation: "Use +, -, *, and / for arithmetic. The % operator gives a remainder.",
    examples: [
      { label: "Operators", description: "Try addition, multiplication, and division.", code: "print(8 + 2)\nprint(8 * 2)\nprint(8 / 2)" },
      { label: "Remainder", description: "Seven divided by two leaves a remainder of one.", code: "print(7 % 2)" },
    ],
    check: { question: "What is 3 * 4?", options: ["7", "12", "34"], answer: 1, feedback: "The * operator multiplies: 3 times 4 is 12." },
  },
  {
    number: "1.5",
    title: "Conditions",
    explanation: "An if statement runs code when a condition is true. else handles the other case.",
    examples: [
      { label: "If / else", description: "Change score to see the other branch run.", code: 'local score = 8\nif score >= 5 then\n    print("Pass")\nelse\n    print("Try again")\nend' },
      { label: "Compare", description: "A comparison produces true or false.", code: "print(4 < 7)\nprint(4 == 7)" },
    ],
    check: { question: "If score is 7, which branch runs?", options: ["Pass", "Try again", "Neither"], answer: 0, feedback: "7 is greater than 5, so the if condition is true." },
  },
  {
    number: "1.6",
    title: "Loops",
    explanation: "A numeric for loop repeats once for every number in its range.",
    examples: [
      { label: "Count up", description: "The end value 3 is included.", code: 'for count = 1, 3 do\n    print("Round", count)\nend' },
      { label: "Count down", description: "Add a negative step to count backward.", code: "for count = 3, 1, -1 do\n    print(count)\nend" },
    ],
    check: { question: "How many times does for n = 1, 3 do ... end run?", options: ["2", "3", "4"], answer: 1, feedback: "It runs for 1, 2, and 3: three times." },
  },
  {
    number: "1.7",
    title: "Functions",
    explanation: "A function groups reusable code. Parameters let you pass in values.",
    examples: [
      { label: "Make one", description: "Call the function by writing its name and parentheses.", code: 'local function greet()\n    print("Hello!")\nend\n\ngreet()' },
      { label: "Parameter", description: "The value in parentheses becomes the parameter name.", code: "local function double(value)\n    return value * 2\nend\n\nprint(double(4))" },
    ],
    check: { question: "What does double(4) return?", options: ["4", "8", "44"], answer: 1, feedback: "The function multiplies its input by 2, so the result is 8." },
  },
  {
    number: "1.8",
    title: "Tables",
    explanation: "Tables group values. List positions start at 1; named fields use keys.",
    examples: [
      { label: "List", description: "Read the second item with index 2.", code: 'local colors = {"red", "blue"}\nprint(colors[2])' },
      { label: "Named fields", description: "Use a key to read a named value.", code: 'local player = {name = "Kai", score = 12}\nprint(player.name)' },
    ],
    check: { question: "What is colors[2] in {\"red\", \"blue\"}?", options: ["red", "blue", "2"], answer: 1, feedback: "List positions start at 1, so colors[2] is blue." },
  },
  {
    number: "1.9",
    title: "Comments",
    explanation: "Start a comment with --. Luau ignores comment text when the script runs.",
    examples: [
      { label: "Comment line", description: "Only the print() line runs.", code: '-- This line is ignored\nprint("Ready")' },
      { label: "Inline comment", description: "A comment can follow code on the same line.", code: 'print("Ready") -- show the status' },
    ],
    check: { question: "What appears in Output? -- hidden; print(\"Ready\")", options: ["hidden", "Ready", "Nothing"], answer: 1, feedback: "Comment text is ignored; the print() call shows Ready." },
  },
];

const path = location.pathname.replace(/\/+$/, "");

if (path.endsWith("/documentation")) {
  document.querySelector(".app-shell").classList.add("app-hidden");
  document.querySelector("#documentation-app").hidden = false;
  initializeDocumentation();
}

function initializeDocumentation() {
  const editorHost = document.querySelector("#documentation-editor");
  const output = document.querySelector("#example-output");
  const runButton = document.querySelector("#run-example");
  const status = document.querySelector("#example-status");
  const description = document.querySelector("#example-description");
  const lessonNavigation = document.querySelector("#lesson-navigation");
  const lessonContent = document.querySelector("#lesson-content");
  const exampleTabs = document.querySelector("#example-tabs");
  const drafts = lessons.map((lesson) => lesson.examples.map((example) => example.code));
  const startingLesson = Number(location.hash.match(/^#1\.([1-9])$/)?.[1] || 1) - 1;
  let activeLesson = startingLesson;
  let activeExample = 0;
  let activeWorker;
  let timeoutId;

  const editor = new EditorView({
    state: EditorState.create({
      doc: drafts[activeLesson][activeExample],
      extensions: [
        basicSetup,
        StreamLanguage.define(lua),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) drafts[activeLesson][activeExample] = update.state.doc.toString();
        }),
      ],
    }),
    parent: editorHost,
  });

  function setEditorCode(code) {
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: code } });
    editor.focus();
  }

  function resetOutput() {
    output.innerHTML = '<p class="empty-state">Output</p>';
    status.textContent = "";
  }

  function renderNavigation() {
    lessonNavigation.replaceChildren();
    lessons.forEach((lesson, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-nav-link";
      button.textContent = `${lesson.number} ${lesson.title}`;
      button.setAttribute("aria-current", String(index === activeLesson ? "step" : "false"));
      button.addEventListener("click", () => selectLesson(index));
      lessonNavigation.append(button);
      if (index === activeLesson) button.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function renderLesson() {
    const lesson = lessons[activeLesson];
    lessonContent.replaceChildren();

    const number = document.createElement("p");
    number.className = "lesson-number";
    number.textContent = lesson.number;
    const title = document.createElement("h1");
    title.textContent = lesson.title;
    const explanation = document.createElement("p");
    explanation.className = "lesson-lead";
    explanation.textContent = lesson.explanation;
    lessonContent.append(number, title, explanation);

    const check = document.createElement("section");
    check.className = "knowledge-check";
    check.setAttribute("aria-labelledby", "knowledge-title");
    const checkTitle = document.createElement("h2");
    checkTitle.id = "knowledge-title";
    checkTitle.textContent = "Quick check";
    const question = document.createElement("p");
    question.textContent = lesson.check.question;
    const options = document.createElement("div");
    options.className = "answer-options";
    lesson.check.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option;
      button.addEventListener("click", () => {
        feedback.textContent = index === lesson.check.answer ? lesson.check.feedback : "Not quite. Try the example, then choose again.";
        feedback.dataset.correct = String(index === lesson.check.answer);
      });
      options.append(button);
    });
    const feedback = document.createElement("p");
    feedback.className = "answer-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    check.append(checkTitle, question, options, feedback);
    lessonContent.append(check);
  }

  function renderExamples() {
    const lesson = lessons[activeLesson];
    exampleTabs.replaceChildren();
    lesson.examples.forEach((example, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(index === activeExample));
      tab.textContent = example.label;
      tab.addEventListener("click", () => {
        if (activeWorker) stopWorker();
        drafts[activeLesson][activeExample] = editor.state.doc.toString();
        activeExample = index;
        setEditorCode(drafts[activeLesson][activeExample]);
        renderExamples();
        resetOutput();
      });
      exampleTabs.append(tab);
    });
    description.textContent = lesson.examples[activeExample].description;
  }

  function selectLesson(index) {
    if (activeWorker) stopWorker();
    drafts[activeLesson][activeExample] = editor.state.doc.toString();
    activeLesson = index;
    activeExample = 0;
    history.replaceState(null, "", `${location.pathname}${location.search}#${lessons[index].number}`);
    renderNavigation();
    renderLesson();
    renderExamples();
    setEditorCode(drafts[activeLesson][activeExample]);
    resetOutput();
  }

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

  renderNavigation();
  renderLesson();
  renderExamples();
  runButton.addEventListener("click", run);

  const themeButton = document.querySelector("#docs-theme");
  themeButton.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("luau-playground-theme", nextTheme);
    themeButton.textContent = nextTheme === "dark" ? "☼" : "◐";
    themeButton.setAttribute("aria-label", `Switch to ${nextTheme === "dark" ? "light" : "dark"} mode`);
  });
}
