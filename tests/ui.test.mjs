// DOM integration test of the actual app modules, without a fake database or auth success.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
let available = true,
  domModule = "happy-dom";
try {
  await import(domModule);
} catch {
  domModule = "../tmp/uitest/node_modules/happy-dom/lib/index.js";
  try {
    await access(new URL(domModule, import.meta.url));
  } catch {
    available = false;
  }
}
test(
  "Actual UI handlers: preview, scope, costs, confirmation and settings",
  { skip: !available },
  async () => {
    const { Window } = await import(domModule);
    const window = new Window({
      url: "http://localhost:4173",
      settings: {
        disableJavaScriptFileLoading: true,
        disableJavaScriptEvaluation: true,
        disableCSSFileLoading: true,
      },
    });
    window.document.write(
      (
        await readFile(new URL("../index.html", import.meta.url), "utf8")
      ).replace(/<script[\s\S]*?<\/script>/g, ""),
    );
    Object.assign(globalThis, {
      window,
      document: window.document,
      location: window.location,
      FormData: window.FormData,
    });
    window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new window.Event("close"));
    };
    const click = (s) => {
      const el = document.querySelector(s);
      assert.ok(el, "Missing " + s);
      el.click();
    };
    const input = (s, value) => {
      const el = document.querySelector(s);
      assert.ok(el, "Missing " + s);
      el.value = value;
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
    };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    try {
      await import("./classic.mjs");
      await import("../js/main.js");
      await globalThis.KC.main.start();
      assert.match(document.querySelector("h1").textContent, /Welcome back/);
      click("#preview-workspace");
      assert.match(
        document.querySelector("h1").textContent,
        /Welcome to Krishna/,
      );
      click("[data-action=new-quote]");
      await tick();
      assert.match(
        document.querySelector("h1").textContent,
        /New quotation/,
        document.querySelector("#toast").textContent,
      );
      input("[name=b_title]", "TEST ONLY UI quote");
      click('[data-step="1"]');
      await tick();
      click("[data-action=add-scope]");
      await tick();
      input("[data-scope]", "TEST ONLY repair timber");
      click("[data-scope-action=copy]");
      await tick();
      assert.equal(document.querySelectorAll("[data-scope]").length, 2);
      click('[data-step="2"]');
      await tick();
      click("[data-action=add-line]");
      await tick();
      input("[data-key=description]", "TEST ONLY labour");
      input("[data-key=quantity]", "8");
      input("[data-key=rate_cents]", "50");
      assert.match(
        document.querySelector("#live-totals").textContent,
        /\$440.00/,
      );
      click("[data-action=save-draft]");
      await tick();
      assert.match(
        document.querySelector("#toast").textContent,
        /requires a connected Supabase/,
      );
      click("[data-nav=settings]");
      await tick();
      assert.equal(document.querySelector("#modal").open, true);
      assert.match(
        document.querySelector("#modal").textContent,
        /Discard this unsaved preview draft/,
      );
      click("#confirm-choice");
      await tick();
      assert.match(
        document.querySelector("h1").textContent,
        /Business settings/,
      );
      document
        .querySelector("#settings-form")
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        );
      await tick();
      assert.match(
        document.querySelector("#toast").textContent,
        /requires a connected Supabase/,
      );
      click("[data-nav=customers]");
      await tick();
      click("[data-action=add-customer]");
      await tick();
      assert.match(
        document.querySelector("#modal").textContent,
        /Every field is optional/,
      );
      click("[data-close]");
      click("[data-nav=dashboard]");
      await tick();
      assert.match(
        document.querySelector("h1").textContent,
        /Welcome to Krishna/,
      );
    } finally {
      const { toast } = globalThis.KC.ui;
      clearTimeout(toast.timer);
      await window.happyDOM.abort();
      window.close();
    }
  },
);
