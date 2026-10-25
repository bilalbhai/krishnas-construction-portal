import { test } from "node:test";
import assert from "node:assert/strict";
import { connect } from "./classic.mjs";
test("Browser connection rejects secret and privileged legacy keys before networking", async () => {
  const original = globalThis.window;
  try {
    globalThis.window = {
      KC_CONFIG: {
        supabaseUrl: "https://example.supabase.co",
        publishableKey: "sb_secret_TEST_ONLY",
      },
    };
    await assert.rejects(connect(), /secret key/);
    const payload = Buffer.from(
      JSON.stringify({ role: "service_role" }),
    ).toString("base64url");
    window.KC_CONFIG.publishableKey = "eyJTESTONLY." + payload + ".TESTONLY";
    await assert.rejects(connect(), /public anon/);
    window.KC_CONFIG = {
      supabaseUrl: "http://untrusted.example",
      publishableKey: "TEST_ONLY",
    };
    await assert.rejects(connect(), /hosted Supabase/);
  } finally {
    globalThis.window = original;
  }
});
