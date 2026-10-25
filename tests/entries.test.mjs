// Execute every actual HTML entry's classic scripts, including file:// and auth gates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
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
const pages = [
  "index",
  "dashboard",
  "customers",
  "customer",
  "jobs",
  "job",
  "quotations",
  "quote-editor",
  "bookings",
  "booking-editor",
  "invoices",
  "invoice-editor",
  "reminders",
  "settings",
];
const sources = new Map();
async function source(path) {
  if (!sources.has(path))
    sources.set(
      path,
      await readFile(new URL("../" + path, import.meta.url), "utf8"),
    );
  return sources.get(path);
}
test(
  "Every named HTML page opens a real file preview and preserves the private authentication gate",
  { skip: !Window, timeout: 120000 },
  async (t) => {
    for (const name of pages)
      await t.test(name + ".html", async () => {
        const html = await source(name + ".html"),
          window = new Window({
            url: "file:///C:/portal/" + name + ".html",
            settings: {
              disableJavaScriptFileLoading: true,
              disableJavaScriptEvaluation: true,
              disableCSSFileLoading: true,
            },
          });
        window.document.write(html.replace(/<script[\s\S]*?<\/script>/g, ""));
        window.HTMLDialogElement.prototype.showModal = function () {
          this.open = true;
        };
        window.HTMLDialogElement.prototype.close = function () {
          this.open = false;
          this.dispatchEvent(new window.Event("close"));
        };
        const context = vm.createContext({
          window,
          document: window.document,
          location: window.location,
          FormData: window.FormData,
          URL,
          Blob,
          Intl,
          Date,
          Uint8Array,
          structuredClone,
          crypto: webcrypto,
          atob,
          btoa,
          setTimeout,
          clearTimeout,
          console,
        });
        try {
          for (const match of html.matchAll(/<script src="([^"]+)"/g)) {
            if (match[1] === "js/config.js") continue; // Optional owner configuration is not a test fixture.
            new vm.Script(await source(match[1]), {
              filename: match[1],
              importModuleDynamically: async () => {
                throw Error(
                  "Network/module imports are forbidden in a file preview",
                );
              },
            }).runInContext(context);
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
          assert.match(
            window.document.querySelector("h1").textContent,
            /Welcome back/,
          );
          assert.equal(
            window.document.querySelector("#login-form button").disabled,
            true,
          );
          window.document.querySelector("#preview-workspace").click();
          assert.doesNotMatch(
            window.document.querySelector("h1").textContent,
            /Opening|could not/,
          );
          if (name.endsWith("editor"))
            assert.match(
              window.document.querySelector("h1").textContent,
              /New/,
            );
          assert.equal(
            window.document.querySelectorAll("[type=module]").length,
            0,
          );
          // Even a configured key cannot activate private functions on file://.
          window.KC_CONFIG = {
            supabaseUrl: "https://example.supabase.co",
            publishableKey: "TEST_ONLY",
          };
          assert.equal(await context.KC.auth.connect(), null);
        } finally {
          clearTimeout(context.KC?.ui?.toast.timer);
          await window.happyDOM.abort();
          window.close();
        }
      });
  },
);
