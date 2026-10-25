// Creates an optional publication folder; the app itself has no build step.
import { mkdir, copyFile, cp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
const workspace = path.resolve(process.cwd()),
  out = path.resolve(workspace, "dist");
// Only the exact generated dist directory inside this checkout may be replaced.
if (path.dirname(out) !== workspace || path.basename(out) !== "dist")
  throw Error("Unsafe output directory.");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of await readdir(workspace))
  if (name.endsWith(".html")) await copyFile(name, path.join(out, name));
for (const dir of ["js", "css", "assets"])
  await cp(dir, path.join(out, dir), { recursive: true });
try {
  const config = await readFile("js/config.js", "utf8");
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
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.log("No js/config.js: preview-only configuration.");
}
await copyFile(".nojekyll", path.join(out, ".nojekyll"));
console.log(
  "Static publication files prepared in dist. No build or npm installation is required.",
);
