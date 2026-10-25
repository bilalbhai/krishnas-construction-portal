// Creates an optional publication folder; the app itself has no build step.
import { mkdir, copyFile, cp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
const workspace = path.resolve(process.cwd()),
  out = path.resolve(workspace, "dist");
// Hosting providers supply public connection values through environment variables.
// A static browser cannot read host environment variables on its own, so write
// the two public values into the exported configuration file before publication.
const publicUrl = process.env.SUPABASE_URL?.trim();
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
if ((publicUrl && !publicKey) || (!publicUrl && publicKey))
  throw Error("Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
if (process.env.KC_REQUIRE_BACKEND === "true" && (!publicUrl || !publicKey))
  throw Error(
    "Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Netlify before deploying.",
  );
let config;
if (publicUrl && publicKey) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(publicUrl))
    throw Error(
      "SUPABASE_URL must be the base https://PROJECT.supabase.co URL.",
    );
  if (!publicKey.startsWith("sb_publishable_") && !publicKey.startsWith("eyJ"))
    throw Error("Use a public Supabase publishable key, never a secret key.");
  config =
    "window.KC_CONFIG = " +
    JSON.stringify({ supabaseUrl: publicUrl, publishableKey: publicKey }) +
    ";\n";
} else {
  try {
    config = await readFile("js/config.js", "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (config) {
  if (/sb_secret_/.test(config))
    throw Error("Refusing to publish a Supabase secret key.");
  for (const token of config.match(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  ) || []) {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    if (payload.role !== "anon")
      throw Error("Refusing to publish a privileged key.");
  }
}
// Only the exact generated dist directory inside this checkout may be replaced.
if (path.dirname(out) !== workspace || path.basename(out) !== "dist")
  throw Error("Unsafe output directory.");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of await readdir(workspace))
  if (name.endsWith(".html")) await copyFile(name, path.join(out, name));
for (const dir of ["js", "css", "assets"])
  await cp(dir, path.join(out, dir), { recursive: true });
if (config) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(out, "js/config.js"), config);
} else console.log("No js/config.js: preview-only configuration.");
await copyFile(".nojekyll", path.join(out, ".nojekyll"));
console.log(
  "Static publication files prepared in dist. No build or npm installation is required.",
);
