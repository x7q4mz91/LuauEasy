import { LuauState } from "luau-web";

self.postMessage({ type: "booted" });

self.addEventListener("message", async (event) => {
  let failed = false;
  try {
    self.postMessage({ type: "initializing" });
    const state = await LuauState.createAsync({
      print: (...values) => self.postMessage({ type: "output", text: values.map(String).join("\t") }),
      warn: (...values) => self.postMessage({ type: "warning", text: values.map(String).join("\t") }),
    });
    const chunk = state.loadstring(event.data.source, "playground", false);
    if (typeof chunk === "string") {
      failed = true;
      self.postMessage({ type: "error", text: chunk });
    } else if (event.data.mode === "check") {
      self.postMessage({ type: "output", text: "Syntax OK." });
    } else {
      await chunk();
    }
  } catch (error) {
    failed = true;
    self.postMessage({ type: "error", text: error instanceof Error ? error.message : String(error) });
  } finally {
    self.postMessage({ type: "done", failed });
  }
});