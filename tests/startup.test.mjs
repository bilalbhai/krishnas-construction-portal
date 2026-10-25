import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
let Window;
try {
  ({ Window } = await import("happy-dom"));
} catch {
  try {
    ({ Window } = await import(
      "../tmp/uitest/node_modules/happy-dom/lib/index.js"
    ));
  } catch {}
}
const source = await readFile(
  new URL("../js/startup.js", import.meta.url),
  "utf8",
);
test(
  "Direct file bootstrap starts the local interface without a module import",
  { skip: !Window },
  async () => {
    const window = new Window({ url: "file:///C:/portal/index.html" });
    window.document.body.innerHTML = '<div id="app">Opening…</div>';
    let started = false,
      imported = false;
    const KC = {
      main: {
        start: async () => {
          started = true;
          window.document.querySelector("#app").textContent =
            "Local preview interface";
        },
      },
    };
    new vm.Script(source, {
      importModuleDynamically: async () => {
        imported = true;
        throw Error("No imports allowed");
      },
    }).runInNewContext({
      KC,
      document: window.document,
      location: window.location,
      setTimeout,
      clearTimeout,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(started, true);
    assert.equal(imported, false);
    assert.match(window.document.body.textContent, /Local preview interface/);
    assert.equal(window.document.querySelectorAll("link").length, 0);
    await window.happyDOM.abort();
    window.close();
  },
);
test(
  "Missing application script gives an actionable error instead of a loading spinner",
  { skip: !Window },
  async () => {
    const window = new Window({ url: "http://localhost:4173" });
    window.document.body.innerHTML = '<div id="app">Opening…</div>';
    new vm.Script(source).runInNewContext({
      document: window.document,
      location: window.location,
      setTimeout,
      clearTimeout,
    });
    assert.match(window.document.body.textContent, /script could not load/);
    assert.doesNotMatch(window.document.body.textContent, /Opening…/);
    await window.happyDOM.abort();
    window.close();
  },
);
