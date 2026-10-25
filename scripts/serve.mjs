import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
const localUrl = "http://127.0.0.1:4173";
function openBrowser() {
  if (process.argv.includes("--open") && process.platform === "win32") {
    const browser = spawn(
      "rundll32.exe",
      ["url.dll,FileProtocolHandler", localUrl],
      { windowsHide: true, detached: true, stdio: "ignore" },
    );
    browser.on("error", () =>
      console.log("Open this address in your browser: " + localUrl),
    );
    browser.unref();
  }
}
const root = process.cwd(),
  types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".md": "text/plain",
  };
const server = http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (
        !file.startsWith(root + path.sep) ||
        pathname.split("/").some((x) => x.startsWith(".")) ||
        (![
          "/index.html",
          "/",
          "/dashboard.html",
          "/customers.html",
          "/customer.html",
          "/jobs.html",
          "/job.html",
          "/quotations.html",
          "/quote-editor.html",
          "/bookings.html",
          "/booking-editor.html",
          "/invoices.html",
          "/invoice-editor.html",
          "/reminders.html",
          "/settings.html",
        ].includes(pathname) &&
          !/^\/(js|css|assets)\//.test(pathname)) ||
        ![".html", ".js", ".css", ".png", ".svg"].includes(path.extname(file))
      )
        throw Error();
      if (!(await stat(file)).isFile()) throw Error();
      res.setHeader("Content-Type", types[path.extname(file)]);
      res.setHeader("Cache-Control", "no-store");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(4173, "127.0.0.1", () => {
    console.log("Local: " + localUrl);
    openBrowser();
  });
server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    try {
      const response = await fetch(localUrl, {
        signal: AbortSignal.timeout(3000),
      });
      const html = await response.text();
      if (html.includes('name="kc-portal"')) {
        console.log("Your portal preview is already running: " + localUrl);
        openBrowser();
        return;
      }
    } catch {}
    console.error(
      "Port 4173 is already being used. Close the previous preview terminal and try again.",
    );
  } else console.error("Could not start preview: " + error.message);
  process.exitCode = 1;
});
