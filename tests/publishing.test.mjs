import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, mkdtemp, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const script = fileURLToPath(
  new URL("../scripts/prepare-pages.mjs", import.meta.url),
);
async function fixture() {
  const base = fileURLToPath(new URL("../tmp/", import.meta.url));
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, "publish-test-"));
  for (const name of ["js", "css", "assets", "private"])
    await mkdir(path.join(dir, name));
  await writeFile(path.join(dir, "index.html"), "<h1>TEST ONLY</h1>");
  await writeFile(
    path.join(dir, "js/config.example.js"),
    "window.KC_CONFIG = {};",
  );
  await writeFile(
    path.join(dir, "private/notes.txt"),
    "TEST ONLY PRIVATE FILE",
  );
  await writeFile(path.join(dir, ".nojekyll"), "");
  return dir;
}
function run(cwd, values) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      KC_REQUIRE_BACKEND: "true",
      ...values,
    },
  });
}
test("Hosting export injects public connection settings and excludes private files", async () => {
  const dir = await fixture();
  const result = run(dir, {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_TEST_ONLY",
  });
  assert.equal(result.status, 0, result.stderr);
  const output = await readFile(path.join(dir, "dist/js/config.js"), "utf8");
  assert.match(output, /https:\/\/example.supabase.co/);
  assert.match(output, /sb_publishable_TEST_ONLY/);
  await assert.rejects(access(path.join(dir, "dist/private/notes.txt")));
  await assert.rejects(access(path.join(dir, "js/config.js")));
});
test("Connected hosting export refuses missing, secret and privileged keys before producing output", async () => {
  const privileged =
    "eyJTESTONLY." +
    Buffer.from(JSON.stringify({ role: "service_role" })).toString(
      "base64url",
    ) +
    ".TESTONLY";
  for (const values of [
    {},
    { SUPABASE_URL: "https://example.supabase.co" },
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_secret_TEST_ONLY",
    },
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: privileged,
    },
  ]) {
    const dir = await fixture(),
      result = run(dir, values);
    assert.notEqual(result.status, 0);
    await assert.rejects(access(path.join(dir, "dist")));
  }
});
