// Plain browser script: no build step or module loader is required.
(function (KC) {
  "use strict";
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const paths = {
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    customers:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87",
    jobs: "M9 5V3h6v2 M3 5h18v15H3z M3 11c6 3 12 3 18 0 M10 12h4v3h-4z",
    quotes:
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h6",
    bookings: "M4 5h16v16H4z M16 3v4 M8 3v4 M4 10h16 M8 15l3 3 5-5",
    invoices: "M6 3h12v19l-3-2-3 2-3-2-3 2z M9 7h6 M9 11h6 M9 15h3",
    reminders: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
    logout: "M9 3H4v18h5 M9 12h12 M17 8l4 4-4 4",
    arrow: "M5 12h14 M14 7l5 5-5 5",
    plus: "M12 5v14 M5 12h14",
    lock: "M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    search: "M21 21l-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
    delete: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
    copy: "M8 8h13v13H8z M16 8V3H3v13h5",
    check: "M4 12l5 5L20 6",
    download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4",
    calendar: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16",
    up: "M6 15l6-6 6 6",
    down: "M6 9l6 6 6-6",
  };
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.quotes}"/></svg>`;
  function field(label, name, value = "", type = "text", extra = "") {
    return `<label class="field">${esc(label)}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
  }
  function area(label, name, value = "", extra = "") {
    return `<label class="field ${extra}">${esc(label)}<textarea name="${name}">${esc(value)}</textarea></label>`;
  }
  function select(label, name, options, value = "", extra = "") {
    return `<label class="field">${esc(label)}<select name="${name}" aria-label="${esc(label)}" ${extra}>${options
      .map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`;
      })
      .join("")}</select></label>`;
  }
  function checkbox(label, name, value) {
    return `<label class="checkbox"><input type="checkbox" name="${name}" ${value ? "checked" : ""}>${esc(label)}</label>`;
  }
  const badge = (status) =>
    `<span class="badge ${esc(status.toLowerCase().replaceAll(" ", "-"))}">${esc(status)}</span>`;
  function empty(title, description, action = "", name = "jobs") {
    return `<div class="empty">${icon(name)}<strong>${esc(title)}</strong><p>${esc(description)}</p>${action}</div>`;
  }
  function toast(message, error = false) {
    const el = document.querySelector("#toast");
    el.textContent = message;
    el.className = error ? "error" : "";
    el.style.display = "block";
    clearTimeout(toast.timer);
    toast.timer = setTimeout(
      () => (el.style.display = "none"),
      error ? 12000 : 5000,
    );
  }
  function modal(html, preview = false) {
    const d = document.querySelector("#modal");
    d.innerHTML = html;
    d.className = preview ? "preview" : "";
    if (!d.open) d.showModal();
    return d;
  }
  function ask(message) {
    return new Promise((resolve) => {
      const d = modal(
        `<h2>Please confirm</h2><p>${esc(message).replaceAll("\n", "<br>")}</p><div class="actions"><button data-close>Keep working</button><button id="confirm-choice" class="primary">Continue</button></div>`,
      );
      let confirmed = false;
      d.querySelector("#confirm-choice").onclick = () => {
        confirmed = true;
        d.close();
      };
      d.addEventListener("close", () => resolve(confirmed), { once: true });
    });
  }
  async function busy(button, fn) {
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      return await fn();
    } catch (e) {
      toast(e.message, true);
      return null;
    } finally {
      if (button) button.disabled = false;
    }
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  KC.ui = {
    esc,
    icon,
    field,
    area,
    select,
    checkbox,
    badge,
    empty,
    toast,
    modal,
    ask,
    busy,
    download,
  };
})((globalThis.KC = globalThis.KC || {}));
