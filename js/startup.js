// Classic-script bootstrap: works from file:// as well as an HTTP/HTTPS host.
(function (KC) {
  "use strict";
  const root = document.querySelector("#app");
  function showError(message) {
    root.replaceChildren();
    const box = document.createElement("div");
    box.className = "loading";
    const title = document.createElement("h1");
    title.textContent = "Krishna's Construction";
    const text = document.createElement("p");
    text.textContent = message;
    const help = document.createElement("p");
    help.textContent =
      "Keep index.html, js, css and assets together. You can also double-click Preview Portal.cmd to open the local server.";
    box.append(title, text, help);
    root.append(box);
  }
  if (!KC.main?.start) {
    showError(
      "An application script could not load. Restore the complete project folder and refresh this page.",
    );
    return;
  }
  const timer = setTimeout(
    () =>
      showError(
        "The workspace connection is taking too long. Check your configuration and internet connection, then refresh.",
      ),
    15000,
  );
  KC.main
    .start()
    .then(() => {
      clearTimeout(timer);
      // File previews work fully offline; optional fonts must never block opening.
      if (location.protocol !== "file:") {
        const fonts = document.createElement("link");
        fonts.rel = "stylesheet";
        fonts.href =
          "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&display=swap";
        document.head.append(fonts);
      }
    })
    .catch((error) => {
      clearTimeout(timer);
      showError(error.message || "The workspace could not open.");
    });
})((globalThis.KC = globalThis.KC || {}));
