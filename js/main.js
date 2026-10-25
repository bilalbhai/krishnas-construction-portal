// Plain browser script: no build step or module loader is required.
(function (KC) {
  "use strict";
  // Shared screen rendering and form orchestration. Domain rules live in the feature files.
  const { connect, db } = KC.auth;
  const { rpc, rows, loadWorkspace } = KC.database;
  const {
    money,
    cents,
    calculate,
    balance,
    paymentStatus,
    reminder,
    localDate,
  } = KC.calculations;
  const {
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
  } = KC.ui;
  const { makePDF } = KC.pdf;
  const app = document.querySelector("#app");
  const pageForRoute = {
    dashboard: "dashboard.html",
    customers: "customers.html",
    jobs: "jobs.html",
    quotes: "quotations.html",
    bookings: "bookings.html",
    invoices: "invoices.html",
    reminders: "reminders.html",
    settings: "settings.html",
  };
  function enterWorkspace() {
    const page = document.body.dataset.page || "dashboard";
    const kind = {
      "quote-editor": "quote",
      "booking-editor": "booking",
      "invoice-editor": "invoice",
    }[page];
    if (kind) {
      newEditor(kind);
      return;
    }
    route =
      { customer: "customers", job: "jobs", quotations: "quotes" }[page] ||
      page;
    if (
      ![
        "dashboard",
        "customers",
        "jobs",
        "quotes",
        "bookings",
        "invoices",
        "reminders",
        "settings",
      ].includes(route)
    )
      route = "dashboard";
    render();
  }

  let client = null,
    user = null,
    preview = false,
    state = {
      members: [],
      customers: [],
      jobs: [],
      documents: [],
      payments: [],
      settings: {},
      credits: [],
    },
    route = "dashboard",
    current = null,
    editor = null,
    step = 0,
    dirty = false,
    saveTimer = null,
    settingsRevision = 0,
    autosaveQueue = Promise.resolve();
  const statuses = KC.jobs.statuses;
  const nav = [
    ["dashboard", "Dashboard"],
    ["customers", "Customers"],
    ["jobs", "Jobs"],
    ["quotes", "Quotations"],
    ["bookings", "Bookings"],
    ["invoices", "Invoices"],
    ["reminders", "Payment Reminders"],
  ];
  const kindRoute = {
      quote: "quotes",
      booking: "bookings",
      invoice: "invoices",
    },
    kindName = {
      quote: "Quotation",
      booking: "Booking Confirmation",
      invoice: "Invoice",
    };
  const defaultSettings = {
    business_name: "Krishna's Construction",
    owner_name: "Eric Krishna",
    phone: "+61 431 101 188",
    email: "erickrishna@outlook.com",
    abn: "49 112 073 632",
    address: "",
    gst_registered: true,
    quote_valid_days: "",
    invoice_due_days: "",
    quote_terms:
      "Proposed terms for review:\nOnly the work described in this quotation is included.\nExclusions and material assumptions are listed in the scope.\nVariations must be agreed in writing before the additional work proceeds.\nDates are subject to agreed access, material availability and weather.\nDeposit and payment arrangements are as stated in the quotation.\nThis quotation does not replace any statutory building contract required for the work.",
    invoice_terms: "",
    bank_name: "",
    bsb: "",
    account_number: "",
    payment_instructions: "",
    identity_approved: false,
    terms_approved: false,
    stamp_approved: false,
    signature_approved: false,
  };
  const customer = (id) => state.customers.find((x) => x.id === id),
    job = (id) => state.jobs.find((x) => x.id === id),
    doc = (id) => state.documents.find((x) => x.id === id);
  const displayCustomer = KC.customers.label;
  const paymentsFor = (d) => KC.invoices.receiptsFor(d, state.payments);
  const admin = () =>
    preview ||
    state.members.some(
      (m) =>
        m.user_id === user?.id && ["owner", "administrator"].includes(m.role),
    );
  function labelRoute() {
    return route === "document"
      ? kindName[current?.kind] || "Document"
      : route === "customer"
        ? "Customer profile"
        : route === "job"
          ? "Job details"
          : route === "editor"
            ? kindName[editor?.kind] || "Document"
            : nav.find((n) => n[0] === route)?.[1] || "Settings";
  }
  const action = (label, attrs = "", cls = "") =>
    `<button class="${cls}" ${attrs}>${label}</button>`;
  function head(title, subtitle = "", actions = "") {
    return `<div class="page-head"><div><div class="eyebrow">Your business, organised</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${actions}</div>`;
  }
  function shell(content) {
    app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><img src="assets/logo/krishnas-construction.png" alt="Krishna's Construction logo"><div><strong>KRISHNA'S<br>CONSTRUCTION</strong><small>Private workspace</small></div></div><div class="nav-label">Workspace</div><nav>${nav.map(([key, name]) => `<a class="nav-link ${route === key ? "active" : ""}" href="${pageForRoute[key]}" data-nav="${key}">${icon(key)}${name}</a>`).join("")}</nav><div class="side-bottom"><a href="settings.html" data-nav="settings" class="nav-link ${route === "settings" ? "active" : ""}">${icon("settings")}Settings</a><button class="nav-link text-button" data-action="logout">${icon("logout")}${preview ? "Exit preview" : "Log out"}</button><div class="side-note">${icon("lock")}${preview ? "Interface preview" : "Private & secure workspace"}</div></div></aside><main class="main"><header class="topbar"><button class="mobile-toggle" aria-label="Open navigation" data-action="menu">${icon("menu")}</button><div class="breadcrumb"><span class="business-crumb">Krishna's Construction</span><span>/</span>${esc(labelRoute())}</div><div class="user"><div class="avatar">${preview ? "KC" : esc((user?.email || "KC").slice(0, 2).toUpperCase())}</div><div class="user-name"><strong>${preview ? "Workspace preview" : esc(user?.email || "Team member")}</strong><small>${preview ? "No database connected" : admin() ? "Owner / administrator" : "Team member"}</small></div></div></header><div class="content">${preview ? '<div class="notice">Interface preview · No database is connected. You can explore forms and sample PDFs; saving and issuing require your secure Supabase setup.</div>' : ""}${content}<footer class="footer"><span>© ${new Date().getFullYear()} Krishna's Construction</span><span>${icon("lock")}Built for the way you work.</span></footer></div></main></div>`;
  }
  function dashboard() {
    const cards = [
      [
        "customers",
        "Manage Customers",
        "Keep customer details and job history in one place.",
        "View customers",
        "customers",
      ],
      [
        "quotes",
        "Generate Quotation",
        "Turn your scope of works into a professional quote.",
        "Start a quotation",
        "new-quote",
      ],
      [
        "bookings",
        "Booking Confirmation",
        "Confirm the dates, details and deposit for a job.",
        "Create a booking",
        "new-booking",
      ],
      [
        "invoices",
        "Generate Invoice",
        "Prepare an invoice and keep track of payments.",
        "Create an invoice",
        "new-invoice",
      ],
    ];
    const upcoming = state.jobs
      .filter(
        (j) =>
          j.data.start_date &&
          j.data.start_date >= localDate() &&
          !["Completed", "Paid", "Cancelled"].includes(j.status),
      )
      .sort((a, b) => a.data.start_date.localeCompare(b.data.start_date))
      .slice(0, 3);
    const recent = state.documents
      .filter((d) => d.kind === "quote")
      .slice(0, 3);
    shell(
      head(
        "Welcome to Krishna's Construction",
        "Your paperwork, made simple.",
        `<div class="date-chip">${icon("calendar")} ${esc(new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Australia/Sydney" }).format(new Date()))}</div>`,
      ) +
        `<section class="welcome"><div><div class="eyebrow">Less paperwork. More craftsmanship.</div><h2>What would you like to do today?</h2><p>From the first conversation to the final payment.<br>Everything you need to keep the job moving.</p></div><svg class="hero-art" viewBox="0 0 180 120" fill="none" stroke="#8a956f" stroke-width="1.2"><path d="M10 106h160M23 106V54l46 15v37M69 106V15l56 35v56M23 54l102 34M69 69l88-29v66M125 50l32-10M78 106V37l38 24v45"/><path d="M5 111h165M11 116h160" stroke-dasharray="3 5"/></svg></section><div class="section-heading"><h2>Your quick actions</h2><small>A good day's work starts here</small></div><section class="action-grid">${cards.map(([ic, t, p, l, a]) => `<button class="action-card" data-action="${a}"><div class="card-icon">${icon(ic)}</div><h3>${t}</h3><p>${p}</p><span class="card-footer">${l}${icon("arrow")}</span></button>`).join("")}</section><div class="two-col"><section><div class="section-heading"><h2>Recent quotations</h2><a class="small muted" href="quotations.html" data-nav="quotes">View all →</a></div><div class="panel">${recent.length ? documentRecords(recent) : empty("Your next project starts here", "Your saved quotations will appear here.", action("Create your first quote", 'data-action="new-quote"'), "quotes")}</div></section><section><div class="section-heading"><h2>Upcoming jobs</h2><a class="small muted" href="jobs.html" data-nav="jobs">View all →</a></div><div class="panel">${upcoming.length ? jobRecords(upcoming) : empty("A little room for your next job", "Scheduled jobs will appear here.", "", "calendar")}</div></section></div>${state.documents.some((d) => reminder(d, paymentsFor(d))) ? `<div class="notice">You have invoices needing attention. <a href="reminders.html" data-nav="reminders">Review payment reminders →</a></div>` : ""}`,
    );
  }
  function customerRecords(list) {
    return `<div class="records">${list.map((c) => `<div class="record"><button class="record-link" data-customer="${c.id}"><strong>${esc(displayCustomer(c))}</strong><p>${esc(c.number)} · ${esc(c.data.phone || c.data.email || "Contact details not provided")}</p></button><div class="meta">${c.archived ? badge("Archived") : ""}${action(icon("arrow"), `data-customer="${c.id}" aria-label="Open customer"`, "text-button")}</div></div>`).join("")}</div>`;
  }
  function jobRecords(list) {
    return `<div class="records">${list.map((j) => `<div class="record"><button class="record-link" data-job="${j.id}"><strong>${esc(j.data.title || j.number)}</strong><p>${esc(displayCustomer(customer(j.customer_id)))} · ${esc(j.number)}${j.data.start_date ? " · " + esc(j.data.start_date) : ""}</p></button><div class="meta">${badge(j.status)}</div></div>`).join("")}</div>`;
  }
  function documentRecords(list) {
    return `<div class="records">${list
      .map((d) => {
        const c = customer(job(d.job_id)?.customer_id),
          s =
            d.kind === "invoice" ? paymentStatus(d, paymentsFor(d)) : d.status;
        return `<div class="record"><button class="record-link" data-doc="${d.id}"><strong>${esc(d.number)}</strong><p>${esc(d.body.title || displayCustomer(c))} · ${esc(displayCustomer(c))}</p></button><div class="meta">${money(d.totals.total_cents)}<small>${badge(s)}</small></div></div>`;
      })
      .join("")}</div>`;
  }
  function lists() {
    let title, sub, html, add;
    if (route === "customers") {
      title = "Customers";
      sub = "Familiar faces. Every detail in one place.";
      add = action(
        icon("plus") + " Add customer",
        'data-action="add-customer"',
        "primary",
      );
      html = state.customers.length
        ? customerRecords(state.customers)
        : empty(
            "Make your first connection",
            "Add a customer now. All contact fields are optional.",
            action("Add customer", 'data-action="add-customer"'),
            "customers",
          );
    } else if (route === "jobs") {
      title = "Jobs";
      sub = "A clear view of every job, from enquiry to completion.";
      add = action(
        icon("plus") + " New job",
        'data-action="add-job"',
        "primary",
      );
      html = state.jobs.length
        ? jobRecords(state.jobs)
        : empty(
            "Ready for the next job",
            "Create a customer, then add as many jobs as you need.",
            action("New job", 'data-action="add-job"'),
            "jobs",
          );
    } else {
      const kind =
        route === "quotes"
          ? "quote"
          : route === "bookings"
            ? "booking"
            : "invoice";
      title =
        route === "quotes"
          ? "Quotations"
          : route === "bookings"
            ? "Booking confirmations"
            : "Invoices";
      sub =
        kind === "quote"
          ? "Thoughtful scopes. Clear pricing. Professional first impressions."
          : kind === "booking"
            ? "Put the agreed details in writing."
            : "Keep the final details and payments together.";
      add = action(
        icon("plus") + ` New ${kindName[kind].toLowerCase()}`,
        `data-action="new-${kind}"`,
        "primary",
      );
      const list = state.documents.filter((d) => d.kind === kind);
      html = list.length
        ? documentRecords(list)
        : empty(
            `Your ${title.toLowerCase()} will live here`,
            "Start with an existing job or create one as you go.",
            action(
              `Create ${kindName[kind].toLowerCase()}`,
              `data-action="new-${kind}"`,
            ),
            route,
          );
    }
    shell(
      head(title, sub, add) +
        `<div class="toolbar"><input class="search" aria-label="Search records" placeholder="Search name, phone, email, ID or quote number…" id="search"><span class="small muted">${route === "customers" ? "Includes archived customers" : "All records"}</span></div><div class="panel" id="list-results">${html}</div>`,
    );
    document.querySelector("#search").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const matches = (c) =>
        KC.customers.matches(c, q, state.jobs, state.documents);
      const result =
        route === "customers"
          ? customerRecords(state.customers.filter(matches))
          : route === "jobs"
            ? jobRecords(
                state.jobs.filter((j) =>
                  [
                    j.number,
                    ...Object.values(j.data),
                    displayCustomer(customer(j.customer_id)),
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
                ),
              )
            : documentRecords(
                state.documents.filter(
                  (d) =>
                    kindRoute[d.kind] === route &&
                    [
                      d.number,
                      d.body.title,
                      displayCustomer(customer(job(d.job_id)?.customer_id)),
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(q),
                ),
              );
      document.querySelector("#list-results").innerHTML = result.includes(
        'class="record"',
      )
        ? result
        : empty(
            "No matching records",
            "Try another name, number or contact detail.",
            "",
            "search",
          );
    };
  }
  function details() {
    if (route === "customer") {
      const c = current,
        jobs = state.jobs.filter((j) => j.customer_id === c.id),
        docs = state.documents.filter((d) =>
          jobs.some((j) => j.id === d.job_id),
        );
      shell(
        head(
          displayCustomer(c),
          c.number,
          `<div class="actions">${action("Edit details", 'data-action="edit-customer"')}${admin() ? action(c.archived ? "Archived" : "Archive / delete", 'data-action="delete-customer"', "danger") : ""}</div>`,
        ) +
          `<div class="panel"><div class="panel-body">${detailsGrid(c.data)}</div></div><div class="section-heading"><h2>Jobs</h2>${action(icon("plus") + " Add job", 'data-action="add-job"')}</div><div class="panel">${jobs.length ? jobRecords(jobs) : empty("No jobs yet", "Each job gets its own scope, documents and payments.")}</div><div class="section-heading"><h2>Related documents</h2></div><div class="panel">${docs.length ? documentRecords(docs) : empty("No documents yet", "Create a quotation, booking or invoice from a linked job.")}</div>`,
      );
    } else {
      const j = current,
        c = customer(j.customer_id),
        docs = state.documents.filter((d) => d.job_id === j.id);
      shell(
        head(
          j.data.title || j.number,
          `${j.number} · ${displayCustomer(c)}`,
          action("Edit job", 'data-action="edit-job"'),
        ) +
          `<div class="toolbar">${badge(j.status)}<div class="actions">${["quote", "booking", "invoice"].map((k) => action("New " + kindName[k].toLowerCase(), `data-action="new-${k}"`)).join("")}</div></div><div class="panel"><div class="panel-body">${detailsGrid(j.data)}</div></div><div class="section-heading"><h2>Job documents</h2></div><div class="panel">${docs.length ? documentRecords(docs) : empty("Everything for this job, together", "Create your first document above.")}</div><div class="section-heading"><h2>Recorded receipts</h2>${action("Record deposit", 'data-action="job-deposit"')}</div><div class="panel"><div class="panel-body">${paymentHistory(state.payments.filter((p) => p.job_id === j.id))}</div></div>`,
      );
    }
  }
  function detailsGrid(data) {
    return `<dl class="detail-grid">${
      Object.entries(data)
        .filter(([k, v]) => v !== "" && v !== null)
        .map(
          ([k, v]) =>
            `<div><dt>${esc(k.replaceAll("_", " "))}</dt><dd>${esc(v)}</dd></div>`,
        )
        .join("") || '<p class="muted small">Details not provided.</p>'
    }</dl>`;
  }
  function customerForm(c = null, onDone = null) {
    const d = c?.data || {};
    const el = modal(
      `<h2>${c ? "Edit customer" : "Add customer"}</h2><p>Enter what you know. Every field is optional; a customer ID is created automatically.</p><form id="customer-form"><div class="fields">${field("Customer name", "name", d.name, "text", 'placeholder="Enter customer name"')}${field("Mobile", "phone", d.phone, "tel", 'placeholder="Enter mobile number"')}${field("Email", "email", d.email, "email", 'placeholder="Enter email address"')}${field("Company", "company", d.company)}${field("Company ABN", "abn", d.abn)}${field("Billing address", "billing_address", d.billing_address)}${field("Job site address", "site_address", d.site_address)}${area("Internal notes", "notes", d.notes, "full")}</div><div class="actions"><button type="button" data-close>Cancel</button><button class="primary">Save customer</button></div></form>`,
    );
    el.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        requireLive();
        const id = await KC.customers.save({
          p_id: c?.id || null,
          p_data: Object.fromEntries(new FormData(e.target)),
          p_revision: c?.revision || 0,
        });
        await refresh();
        el.close();
        toast("Customer saved.");
        if (onDone) onDone(id);
        else openCustomer(id);
      });
    };
  }
  function jobForm(j = null, onDone = null) {
    if (!state.customers.some((c) => !c.archived)) {
      if (preview) {
        toast("Connect your database to create customers and jobs.");
        return;
      }
      return customerForm(null, () => jobForm(null, onDone));
    }
    const d = j?.data || {},
      c = j?.customer_id || (route === "customer" ? current?.id : "");
    const el = modal(
      `<h2>${j ? "Edit job" : "New job"}</h2><form><div class="fields">${select("Customer", "customer_id", [["", "Select customer"], ...state.customers.filter((c) => !c.archived || c.id === j?.customer_id).map((c) => [c.id, displayCustomer(c) + " · " + c.number])], c, j ? "disabled" : "required")}${field("Job title", "title", d.title)}${area("Job description", "description", d.description, "full")}${field("Job site address", "site_address", d.site_address || customer(c)?.data.site_address)}${select("Job status", "status", statuses, j?.status || "New Lead")}${field("Estimated start", "start_date", d.start_date, "date")}${field("Expected completion", "end_date", d.end_date, "date")}${area("Internal notes / variations", "notes", d.notes, "full")}</div><div class="actions"><button type="button" data-close>Cancel</button><button class="primary">Save job</button></div></form>`,
    );
    el.querySelector("select[name=customer_id]").onchange = (e) => {
      el.querySelector("[name=site_address]").value =
        customer(e.target.value)?.data.site_address || "";
    };
    el.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        requireLive();
        const f = Object.fromEntries(new FormData(e.target));
        const id = await KC.jobs.save({
          p_id: j?.id || null,
          p_customer: j?.customer_id || f.customer_id,
          p_status: f.status,
          p_data: Object.fromEntries(
            Object.entries(f).filter(
              ([k]) => !["status", "customer_id"].includes(k),
            ),
          ),
          p_revision: j?.revision || 0,
        });
        await refresh();
        el.close();
        toast("Job saved.");
        if (onDone) onDone(id);
        else openJob(id);
      });
    };
  }
  function requireLive() {
    if (preview || !client || !user)
      throw Error(
        "Saving requires a connected Supabase project and an authorised login. No data has been saved.",
      );
  }
  async function refresh() {
    state = await loadWorkspace();
    settingsRevision = (await rows("business_settings"))[0]?.revision || 0;
  }
  function openCustomer(id) {
    current = customer(id);
    route = "customer";
    render();
  }
  function openJob(id) {
    current = job(id);
    route = "job";
    render();
  }
  function openDoc(id) {
    current = doc(id);
    route = "document";
    render();
  }
  function newEditor(kind, source = null) {
    const linkedJob = source
      ? job(source.job_id)
      : route === "job"
        ? current
        : null;
    editor = KC.quotes.createDraft(kind, {
      source,
      job: linkedJob,
      settings: { ...defaultSettings, ...state.settings },
    });
    step = 0;
    dirty = false;
    route = "editor";
    render();
  }
  const editorSteps = [
    "Customer & job",
    "Scope of works",
    "Costs & GST",
    "Review & document",
  ];
  function collectEditor() {
    const f = document.querySelector("#editor-form");
    if (!f || !editor) return;
    const data = new FormData(f);
    for (const [k, v] of data) {
      if (k.startsWith("b_")) {
        const key = k.slice(2);
        if (key.endsWith("_cents"))
          editor.body[key] =
            v === "" && key === "fixed_cents" ? null : cents(v || 0);
        else editor.body[key] = v;
      }
    }
    if (step === 0) {
      const jid = data.get("job_id");
      if (jid && jid !== editor.job_id) {
        editor.job_id = jid;
        editor.source_id = null;
        const j = job(jid);
        if (!editor.body.title) editor.body.title = j?.data.title || "";
        if (!editor.body.site_address)
          editor.body.site_address = j?.data.site_address || "";
        if (!editor.body.summary)
          editor.body.summary = j?.data.description || "";
      }
    }
    if (step === 1)
      editor.body.scope = [...f.querySelectorAll("[data-scope]")].map(
        (x) => x.value,
      );
    if (step === 2)
      editor.body.items = [...f.querySelectorAll(".line-row")].map((row) => ({
        category: row.querySelector("[data-key=category]").value,
        description: row.querySelector("[data-key=description]").value,
        quantity: row.querySelector("[data-key=quantity]").value || "0",
        unit: row.querySelector("[data-key=unit]").value,
        rate_cents: cents(
          row.querySelector("[data-key=rate_cents]").value || 0,
        ),
      }));
    if (step === 3) {
      editor.body.use_signature = f.querySelector(
        "[name=use_signature]",
      ).checked;
      editor.body.use_stamp = f.querySelector("[name=use_stamp]").checked;
    }
    dirty = true;
  }
  function editorPage() {
    const b = editor.body;
    let content = "";
    if (step === 0) {
      const selectedCustomer = job(editor.job_id)?.customer_id || "";
      content = `<div class="editor-section"><h2>01 / Start with a customer and job</h2><p class="hint">Use the same details across every document. You can create an invoice or booking directly.</p><div class="fields">${select("Customer", "customer_select", [["", "Select a customer"], ...state.customers.filter((c) => !c.archived).map((c) => [c.id, displayCustomer(c) + " · " + c.number])], selectedCustomer)}${select("Job", "job_id", [["", "Select a job"], ...state.jobs.filter((j) => !selectedCustomer || j.customer_id === selectedCustomer).map((j) => [j.id, (j.data.title || j.number) + " · " + j.number])], editor.job_id, editor.id ? "disabled" : "")}${field("Document title", "b_title", b.title)}${field("Job site address", "b_site_address", b.site_address)}${field("Document date", "b_date", b.date, "date")}${editor.kind === "invoice" ? field("Payment due date", "b_due_date", b.due_date, "date") : editor.kind === "quote" ? field("Quotation expiry", "b_expiry_date", b.expiry_date, "date") : field("Expected start", "b_start_date", b.start_date, "date")}${editor.kind === "booking" ? field("Expected completion", "b_end_date", b.end_date, "date") : ""}${select(
        "Contract context",
        "b_contract_context",
        [
          ["", "Select the type of work"],
          ["nsw-residential", "NSW residential building work"],
          ["commercial", "Commercial / subcontract work"],
          ["other", "Other — review applicable requirements"],
        ],
        b.contract_context,
      )}</div><div class="actions" style="margin-top:20px">${action("+ Add customer", 'data-action="editor-customer"')}${action("+ Add job", 'data-action="editor-job"')}</div><p class="hint" style="margin-top:22px">NSW residential jobs may need a separate statutory contract. Review job value, deposits, licensing and insurance before accepting work.</p></div>`;
    }
    if (step === 1)
      content = `<div class="editor-section"><h2>02 / Describe the craftsmanship</h2>${area("Job summary", "b_summary", b.summary)}<div class="section-heading"><h2>Scope of works</h2>${action("+ Add work item", 'data-action="add-scope"')}</div><div id="scope-rows">${(b.scope || []).map((s, i) => `<div class="scope-row"><span class="scope-number">${i + 1}.</span><textarea aria-label="Work item ${i + 1}" data-scope="${i}">${esc(s)}</textarea><span class="scope-actions">${action(icon("up"), `data-scope-action="up" data-index="${i}" aria-label="Move item up"`)}${action(icon("down"), `data-scope-action="down" data-index="${i}" aria-label="Move item down"`)}${action(icon("copy"), `data-scope-action="copy" data-index="${i}" aria-label="Duplicate item"`)}${action(icon("delete"), `data-scope-action="delete" data-index="${i}" aria-label="Remove item"`)}</span></div>`).join("")}</div>${action("Paste / split a scope", 'data-action="paste-scope"')}<div class="spacer"></div><div class="fields">${area("Exclusions", "b_exclusions", b.exclusions)}${area("Material assumptions", "b_assumptions", b.assumptions)}${area("Additional customer-visible notes", "b_notes", b.notes, "full")}</div></div>`;
    if (step === 2)
      content = `<div class="editor-section"><h2>03 / Clear, considered pricing</h2><div class="fields">${select(
        "Pricing method",
        "b_quote_type",
        [
          ["fixed", "Fixed price"],
          ["hourly", "Hourly labour / itemised charges"],
          ["cost-plus", "Cost-plus"],
        ],
        b.quote_type,
      )}${select(
        "Price entry",
        "b_price_mode",
        [
          ["exclusive", "GST exclusive"],
          ["inclusive", "GST inclusive"],
        ],
        b.price_mode,
      )}${select(
        "GST treatment",
        "b_tax",
        [
          ["taxable", "Taxable supply — 10% GST"],
          ["gst-free", "GST-free — approved basis required"],
          ["other", "Other approved treatment — basis required"],
        ],
        b.tax,
      )}${b.tax !== "taxable" ? field("Approved tax basis", "b_tax_reason", b.tax_reason) : ""}${b.quote_type === "fixed" ? field("Overall fixed price (blank = sum of rows)", "b_fixed_cents", b.fixed_cents === null ? "" : (b.fixed_cents / 100).toFixed(2), "number", 'min="0" step="0.01"') : ""}${
        b.quote_type === "cost-plus"
          ? select(
              "Cost-plus method",
              "b_fee_method",
              [
                ["percentage", "Percentage markup"],
                ["fixed", "Fixed management fee"],
              ],
              b.fee_method,
            ) +
            select(
              "Direct costs are",
              "b_cost_basis",
              [
                ["estimated", "Estimated costs"],
                ["actual", "Actual costs"],
              ],
              b.cost_basis,
            ) +
            (b.fee_method === "fixed"
              ? field(
                  "Management fee",
                  "b_fee_cents",
                  (b.fee_cents / 100).toFixed(2),
                  "number",
                  'min="0" step="0.01"',
                )
              : field(
                  "Markup percentage",
                  "b_markup_percent",
                  b.markup_percent,
                  "number",
                  'min="0" max="10000" step="0.0001"',
                ))
          : ""
      }</div><div class="section-heading"><h2>Labour, materials & other costs</h2>${action("+ Add cost row", 'data-action="add-line"')}</div><p class="hint">Enter labour quantity as total worker-hours. For example, 2 workers × 8 hours = 16 hours. Unit prices follow the GST entry choice above.</p>${b.items.map((i, n) => `<div class="line-row" data-line="${n}"><label class="field">Type<select data-key="category">${["labour", "materials", "additional", "variation"].map((c) => `<option ${i.category === c ? "selected" : ""} value="${c}">${c}</option>`).join("")}</select></label><label class="field line-description">Description<input data-key="description" value="${esc(i.description)}" aria-label="Cost description"></label><label class="field">Qty / hours<input data-key="quantity" type="number" min="0" step="0.0001" value="${esc(i.quantity)}"></label><label class="field">Unit<input data-key="unit" value="${esc(i.unit)}"></label><label class="field line-rate">Unit price $<input data-key="rate_cents" type="number" min="0" step="0.01" value="${(i.rate_cents / 100).toFixed(2)}"></label><div class="field line-amount">Amount<strong data-line-total="${n}">—</strong></div><div class="line-controls">${action(icon("copy"), `data-line-action="copy" data-index="${n}" aria-label="Duplicate row"`)}${action(icon("delete"), `data-line-action="delete" data-index="${n}" aria-label="Remove row"`)}</div></div>`).join("")}<div class="fields" style="margin-top:24px">${field("Discount $", "b_discount_cents", (b.discount_cents / 100).toFixed(2), "number", 'min="0" step="0.01"')}${field("Deposit requested $ (never marked paid automatically)", "b_deposit_cents", (b.deposit_cents / 100).toFixed(2), "number", 'min="0" step="0.01"')}</div><div id="live-totals"></div></div>`;
    if (step === 3) {
      let t;
      try {
        t = calculate(b);
      } catch (e) {
        t = null;
      }
      content = `<div class="editor-section"><h2>04 / The finishing details</h2><div class="notice">${editor.kind === "invoice" ? "Issue locks this invoice and saves a separate customer, business and financial snapshot." : editor.kind === "booking" ? "Confirming a booking does not mark its requested deposit as received. Record actual receipts separately." : "Cost-plus amounts remain estimates where selected. Proposed terms need approval before real issue."}</div>${area("Document terms", "b_terms", b.terms)}<div class="spacer"></div>${checkbox("Include approved genuine signature", "use_signature", b.use_signature)}${checkbox("Include approved company stamp", "use_stamp", b.use_stamp)}${editor.kind === "booking" ? field("Booked by", "b_booked_by", b.booked_by) + area("Special instructions", "b_special_instructions", b.special_instructions) + `<div class="section-heading"><h2>Deposit actually received: ${money(KC.bookings.depositReceived(state.payments, editor.job_id))}</h2></div>${paymentHistory(state.payments.filter((p) => p.job_id === editor.job_id && p.kind === "deposit"))}${action("Record actual deposit", 'data-action="editor-deposit"')}` : ""}${t ? totalsHTML(t) : '<p class="error-box">Review the cost entries before continuing.</p>'}<p class="small muted">Preview PDFs are labelled SAMPLE / NOT FOR ISSUE. Only an approved, issued document can be downloaded for customer use.</p></div>`;
    }
    shell(
      head(
        editor.id
          ? `Edit ${editor.number || kindName[editor.kind]}`
          : `New ${kindName[editor.kind].toLowerCase()}`,
        "One job. Every detail, carried through.",
      ) +
        `<div class="steps">${editorSteps.map((s, i) => action(`${i + 1} ${s}`, `data-step="${i}"`, `step ${step === i ? "current" : ""}`)).join("")}</div><form id="editor-form"><div class="panel">${content}</div><div class="editor-footer"><span class="save-status" id="save-status">${preview ? "Preview only" : dirty ? "Unsaved changes" : "Draft ready"}</span><div class="actions">${step > 0 ? action("Back", 'data-action="prev-step"') : ""}${action("Save draft", 'data-action="save-draft"')}${step < 3 ? action("Continue " + icon("arrow"), 'data-action="next-step"', "primary") : action(icon("download") + " Preview PDF", 'data-action="preview-editor"')}${step === 3 ? action("Issue document", 'data-action="issue-editor"', "primary") : ""}</div></div></form>`,
    );
    if (step === 0) {
      const fields = document.querySelector(".editor-section .fields");
      fields.insertAdjacentHTML(
        "beforebegin",
        '<label class="field" style="margin-bottom:20px">Find a customer<input id="editor-customer-search" type="search" placeholder="Name, phone, email, customer ID or quote number…"></label>',
      );
      const customerSelect = document.querySelector("[name=customer_select]");
      if (editor.id) customerSelect.disabled = true;
      document.querySelector("#editor-customer-search").oninput = (e) => {
        const q = e.target.value.toLowerCase();
        const matched = state.customers.filter(
          (c) =>
            !c.archived &&
            [
              c.number,
              ...Object.values(c.data),
              ...state.documents
                .filter((d) => job(d.job_id)?.customer_id === c.id)
                .map((d) => d.number),
            ]
              .join(" ")
              .toLowerCase()
              .includes(q),
        );
        customerSelect.innerHTML =
          '<option value="">Select a customer</option>' +
          matched
            .map(
              (c) =>
                `<option value="${c.id}" ${c.id === job(editor.job_id)?.customer_id ? "selected" : ""}>${esc(displayCustomer(c))} · ${esc(c.number)}</option>`,
            )
            .join("");
      };
    }
    document
      .querySelectorAll("#editor-form button")
      .forEach((b) => (b.type = "button"));
    document.querySelector("#editor-form").onsubmit = (e) => e.preventDefault();
    document.querySelector("#editor-form").addEventListener("input", () => {
      try {
        collectEditor();
        if (step === 2) updateTotals();
        queueAutosave();
      } catch (e) {
        setSaveStatus(e.message, true);
      }
    });
    document.querySelector("#editor-form").addEventListener("change", (e) => {
      try {
        collectEditor();
        if (["b_quote_type", "b_fee_method", "b_tax"].includes(e.target.name))
          editorPage();
        if (e.target.name === "customer_select") {
          const c = e.target.value;
          const sel = document.querySelector("[name=job_id]");
          if (editor.id) return;
          sel.innerHTML =
            '<option value="">Select a job</option>' +
            state.jobs
              .filter((j) => j.customer_id === c)
              .map(
                (j) =>
                  `<option value="${j.id}">${esc(j.data.title || j.number)}</option>`,
              )
              .join("");
          editor.job_id = "";
        }
        if (e.target.name === "job_id") {
          collectEditor();
          const selected = job(editor.job_id);
          editor.body.title = selected?.data.title || "";
          editor.body.site_address = selected?.data.site_address || "";
          editor.body.summary = selected?.data.description || "";
          editorPage();
        }
        queueAutosave();
      } catch (e) {
        toast(e.message, true);
      }
    });
    if (step === 2) updateTotals();
  }
  function totalsHTML(t, d = null) {
    const p = d ? paymentsFor(d) : [],
      b = d ? balance(t.total_cents, p, d.credit_cents) : null;
    return `<div class="totals">${[["Labour", t.labour], ["Materials", t.materials], ["Additional costs", t.additional], ["Variations", t.variation], ...(t.adjustment_cents ? [["Fixed price adjustment", t.adjustment_cents]] : []), ...(t.fee_cents ? [["Cost-plus fee", t.fee_cents]] : []), ...(t.discount_cents ? [["Discount", -t.discount_cents]] : []), ["Net amount (ex GST)", t.net_cents], ["GST component", t.gst_cents]].map(([l, v]) => `<div class="total-row"><span>${l}</span><span>${money(v)}</span></div>`).join("")}<div class="total-row grand"><span>${d?.body.quote_type === "cost-plus" && d.body.cost_basis === "estimated" ? "Estimated total" : "Total AUD"}</span><span>${money(t.total_cents)}</span></div>${d?.kind === "invoice" ? `<div class="total-row"><span>Credit adjustments</span><span>${money(d.credit_cents)}</span></div><div class="total-row"><span>Payments received</span><span>${money(b.paid)}</span></div><div class="total-row grand"><span>Balance due</span><span>${money(b.due)}</span></div>` : `<div class="total-row"><span>Deposit requested</span><span>${money(t.deposit_cents)}</span></div><div class="total-row"><span>Estimated balance after deposit</span><span>${money(t.total_cents - t.deposit_cents)}</span></div>`}</div>`;
  }
  function updateTotals() {
    try {
      const t = calculate(editor.body);
      document.querySelector("#live-totals").innerHTML = totalsHTML(t);
      t.items.forEach((i, n) => {
        const el = document.querySelector(`[data-line-total="${n}"]`);
        if (el) el.textContent = money(i.amount_cents);
      });
      editor.totals = t;
    } catch (e) {
      document.querySelector("#live-totals").innerHTML =
        `<p class="error-box">${esc(e.message)}</p>`;
      editor.totals = null;
    }
  }
  function setSaveStatus(s, error = false) {
    const el = document.querySelector("#save-status");
    if (el) {
      el.textContent = s;
      el.classList.toggle("error-box", error);
    }
  }
  function queueAutosave() {
    clearTimeout(saveTimer);
    if (preview) return;
    setSaveStatus("Unsaved changes");
    if (!editor.job_id) return;
    saveTimer = setTimeout(() => {
      autosaveQueue = autosaveQueue
        .then(() => saveDraft(false))
        .catch((e) => setSaveStatus("Not saved: " + e.message, true));
    }, 2200);
  }
  async function saveDraft(explicit = true) {
    requireLive();
    clearTimeout(saveTimer);
    const target = editor;
    if (!target.job_id)
      throw Error("Select or create a customer and job first.");
    calculate(target.body);
    setSaveStatus("Saving…");
    const body = structuredClone(target.body);
    const id = await KC[
      { quote: "quotes", booking: "bookings", invoice: "invoices" }[target.kind]
    ].save({
      p_id: target.id,
      p_kind: target.kind,
      p_job: target.job_id,
      p_source: target.source_id,
      p_body: body,
      p_revision: target.revision,
    });
    await refresh();
    const saved = doc(id);
    if (editor === target) {
      target.id = id;
      target.revision = saved.revision;
      target.number = saved.number;
      if (JSON.stringify(target.body) === JSON.stringify(body)) dirty = false;
      setSaveStatus(dirty ? "New changes pending" : "Saved securely");
    }
    if (explicit) toast("Draft saved securely.");
    return saved;
  }
  async function saveCurrent() {
    collectEditor();
    clearTimeout(saveTimer);
    await autosaveQueue;
    return saveDraft();
  }
  function paymentHistory(payments) {
    return payments.length
      ? `<div class="records">${payments.map((p) => `<div class="record"><div><strong>${p.kind === "deposit" ? "Initial deposit" : "Final payment"} · ${money(p.amount_cents)}</strong><p>${esc(p.paid_date)} · ${esc(p.method)}${p.reference ? " · " + esc(p.reference) : ""}</p></div><div class="meta"><small>${p.invoice_id ? esc(doc(p.invoice_id)?.number || "Allocated") : "Unallocated deposit"}</small></div></div>`).join("")}</div>`
      : '<p class="small muted">No receipts recorded. A requested deposit is not a payment.</p>';
  }
  function documentPage() {
    const d = current,
      b = d.body,
      j = job(d.job_id),
      snap = d.snapshot,
      c = snap?.customer || customer(j?.customer_id),
      p = paymentsFor(d),
      status = d.kind === "invoice" ? paymentStatus(d, p) : d.status;
    const locked = d.kind !== "quote" && d.status !== "draft";
    shell(
      head(
        d.number,
        `${kindName[d.kind]} · ${displayCustomer(c)}`,
        `<div class="actions">${!locked ? action("Edit", 'data-action="edit-document"') : ""}${action("Duplicate", 'data-action="duplicate-document"')}${action(icon("download") + " PDF", 'data-action="document-pdf"', "primary")}</div>`,
      ) +
        `<div class="toolbar">${badge(status)}<div class="actions">${d.status === "draft" ? action("Issue document", 'data-action="issue-document"', "gold") : ""}${d.kind === "quote" && d.status !== "draft" ? action("Mark sent", 'data-action="mark-sent"') + action("Mark accepted", 'data-action="mark-accepted"') : ""}${d.kind !== "invoice" ? action("Create invoice", 'data-action="from-invoice"') : ""}${d.kind === "quote" ? action("Create booking", 'data-action="from-booking"') : ""}${d.kind === "invoice" && d.status === "issued" ? action("Record payment", 'data-action="invoice-payment"') + (admin() ? action("Credit adjustment", 'data-action="credit"') : "") : ""}${d.status !== "void" && d.status !== "draft" && admin() ? action(d.kind === "invoice" ? "Void / correct" : "Cancel document", `data-action="void-document"`, "danger") : ""}</div></div><div class="panel document-view"><div class="panel-body"><div class="eyebrow">${esc(displayCustomer(c))} · ${esc(b.date)}</div><h2>${esc(b.title || "Untitled job")}</h2><p>${esc(b.site_address || "")}</p>${b.quote_type === "cost-plus" ? '<div class="notice">Cost-plus · ' + esc(b.cost_basis || "estimated") + " costs. This is not an unconditional fixed price.</div>" : ""}<p>${esc(b.summary)}</p><ol>${(b.scope || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>${[
          "exclusions",
          "assumptions",
          "notes",
        ]
          .filter((k) => b[k])
          .map((k) => `<h2>${esc(k)}</h2><p>${esc(b[k])}</p>`)
          .join(
            "",
          )}<div class="records">${d.totals.items.map((i) => `<div class="record"><div><strong>${esc(i.description || "Unlabelled cost")}</strong><p>${esc(i.category)} · ${esc(i.quantity)} ${esc(i.unit)} × ${money(i.rate_cents)}</p></div><span>${money(i.amount_cents)}</span></div>`).join("")}</div>${totalsHTML(d.totals, d)}<h2>Terms</h2><p>${esc(b.terms || "No additional terms supplied.")}</p>${d.kind === "booking" ? `<h2>Scheduled work</h2><p>${esc(b.start_date || "Start date not provided")} to ${esc(b.end_date || "completion date not provided")}</p>` : ""}</div></div>${
          d.kind === "invoice" || d.kind === "booking"
            ? `<div class="panel"><div class="panel-head"><h2>Receipts & adjustments</h2>${d.kind === "booking" ? action("Record deposit", 'data-action="booking-deposit"') : ""}</div><div class="panel-body">${paymentHistory(d.kind === "booking" ? state.payments.filter((p) => p.job_id === d.job_id && p.kind === "deposit") : p)}${state.credits
                .filter((c) => c.invoice_id === d.id)
                .map(
                  (c) =>
                    `<div class="record"><div><strong>${esc(c.number)} · Credit ${money(c.amount_cents)}</strong><p>${esc(c.reason)}</p></div>${action("Download adjustment", 'data-credit="' + c.id + '"')}</div>`,
                )
                .join("")}</div></div>`
            : ""
        }`,
    );
  }
  function paymentForm(jid, invoice = null) {
    const existing = state.payments.filter((p) => p.job_id === jid);
    const el = modal(
      `<h2>Record an actual receipt</h2><p>One initial deposit per job and one final payment per invoice. Payments are kept as financial records. Check the amount before recording.</p><form><div class="fields">${select("Receipt type", "kind", [["deposit", "Initial deposit"], ...(invoice ? [["final", "Final payment"]] : [])], invoice ? "final" : "deposit")}${field("Amount received $", "amount", "", "number", 'required min="0.01" step="0.01"')}${field("Payment date", "date", localDate(), "date", `required max="${localDate()}"`)}${select("Payment method", "method", ["Bank transfer", "Cash", "Card", "Other"])}${field("Reference / note", "reference", "")}</div><p class="small muted">${existing.length ? "Existing receipts: " + existing.map((p) => `${p.kind} ${money(p.amount_cents)}`).join(", ") : "No previous receipts for this job."}</p><div class="actions"><button type="button" data-close>Cancel</button><button class="primary">Record payment</button></div></form>`,
    );
    el.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        requireLive();
        const f = Object.fromEntries(new FormData(e.target));
        await KC.invoices.recordPayment({
          p_job: jid,
          p_invoice: invoice?.id || null,
          p_kind: f.kind,
          p_amount: cents(f.amount),
          p_date: f.date,
          p_method: f.method,
          p_reference: f.reference,
        });
        await refresh();
        el.close();
        if (invoice) current = doc(invoice.id);
        toast("Receipt recorded. Balance updated.");
        render();
      });
    };
  }
  function remindersPage() {
    const list = state.documents
      .map((d) => ({ d, r: reminder(d, paymentsFor(d)) }))
      .filter((x) => x.r)
      .sort((a, b) => a.d.body.due_date.localeCompare(b.d.body.due_date));
    shell(
      head("Payment reminders", "A quiet nudge to keep the paperwork moving.") +
        `<div class="panel">${list.length ? list.map(({ d, r }) => `<div class="record"><button class="record-link" data-doc="${d.id}"><strong>${esc(d.number)} · ${esc(displayCustomer(customer(job(d.job_id)?.customer_id)))}</strong><p>Due ${esc(d.body.due_date)}${r.label === "Overdue" ? " · " + r.days + " days overdue" : ""}</p></button><div class="meta">${money(balance(d.totals.total_cents, paymentsFor(d), d.credit_cents).due)}<small>${badge(r.label)}</small></div></div>`).join("") : empty("All clear for now", "Invoices due within 7 days, due today or overdue appear here.", "", "reminders")}</div>`,
    );
  }
  function settingsPage() {
    const s = { ...defaultSettings, ...state.settings };
    shell(
      head(
        "Business settings",
        "Your identity and document defaults, in one considered place.",
      ) +
        `<div class="notice">Approve business identity and terms before issuing documents. Financial settings are available to owners and administrators. Issued documents retain their original settings.</div><form id="settings-form"><div class="panel"><div class="editor-section"><h2>Business identity</h2><div class="fields">${field("Business name", "business_name", s.business_name)}${field("Owner", "owner_name", s.owner_name)}${field("Business email", "email", s.email, "email")}${field("Phone", "phone", s.phone, "tel")}${field("ABN", "abn", s.abn)}${field("Business / correspondence address", "address", s.address)}</div><div class="spacer"></div>${checkbox("GST registered", "gst_registered", s.gst_registered)}${checkbox("I have checked and approved the business identity and ABN", "identity_approved", s.identity_approved)}</div><div class="editor-section"><h2>Payment instructions</h2><div class="fields">${field("Account name", "bank_name", s.bank_name)}${field("BSB", "bsb", s.bsb)}${field("Account number", "account_number", s.account_number)}${area("Payment instructions", "payment_instructions", s.payment_instructions)}</div></div><div class="editor-section"><h2>Editable document defaults</h2><div class="fields">${field("Quote validity (days; blank = enter per quote)", "quote_valid_days", s.quote_valid_days, "number", 'min="0" max="3650"')}${field("Invoice payment period (days; blank = enter per invoice)", "invoice_due_days", s.invoice_due_days, "number", 'min="0" max="3650"')}${area("Quotation / booking terms — proposed until approved", "quote_terms", s.quote_terms, "full")}${area("Invoice terms", "invoice_terms", s.invoice_terms, "full")}</div><div class="spacer"></div>${checkbox("Eric has reviewed and approved these terms for use", "terms_approved", s.terms_approved)}</div><div class="editor-section"><h2>Document artwork</h2><p class="hint">PNG or JPEG, up to 2 MB. Genuine signatures stay in private storage. New uploads do not replace assets used in old documents.</p><div class="fields">${["logo", "signature", "stamp"].map((k) => `<label class="field">${k === "signature" ? "Genuine signature" : k === "stamp" ? "Company stamp (optional upload)" : "Business logo"}<input type="file" accept="image/png,image/jpeg" data-upload="${k}" ${!admin() ? "disabled" : ""}><small>${s[k + "_path"] ? "Private artwork uploaded." : k === "logo" ? "Official supplied logo used by default." : k === "signature" ? "No signature. Development PDFs show a labelled sample area only." : "A logo-based rectangular company mark is available for approval."}</small></label>`).join("")}${checkbox("Approve the genuine uploaded signature", "signature_approved", s.signature_approved)}${checkbox("Approve the logo-based company stamp for real documents", "stamp_approved", s.stamp_approved)}</div><div class="spacer"></div><img class="asset-preview" src="assets/logo/krishnas-construction.png" alt="Official logo / company mark preview"><p class="small muted">Company mark design: the official logo with company name and ABN in a charcoal rectangular frame. Preview a draft PDF to inspect it.</p></div></div><div class="editor-footer"><span class="small muted">${admin() ? "Authorised settings" : "Read-only for employees"}</span><div class="actions">${action("Export records", 'data-action="export"')}${action("Save settings", 'type="submit"', "primary")}</div></div></form>`,
    );
    document.querySelector("#settings-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        requireLive();
        if (!admin()) throw Error("Administrator access required.");
        const f = e.target,
          data = { ...s, ...Object.fromEntries(new FormData(f)) };
        for (const k of [
          "gst_registered",
          "identity_approved",
          "terms_approved",
          "signature_approved",
          "stamp_approved",
        ])
          data[k] = f.querySelector(`[name=${k}]`).checked;
        for (const input of f.querySelectorAll("[data-upload]")) {
          const file = input.files[0];
          if (!file) continue;
          if (
            !["image/png", "image/jpeg"].includes(file.type) ||
            file.size > 2097152
          )
            throw Error("Use PNG/JPEG images no larger than 2 MB.");
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (
            !(
              bytes[0] === 137 &&
              bytes[1] === 80 &&
              bytes[2] === 78 &&
              bytes[3] === 71
            ) &&
            !(bytes[0] === 255 && bytes[1] === 216)
          )
            throw Error("File contents do not match PNG/JPEG.");
          const image = await createImageBitmap(file);
          if (image.width > 6000 || image.height > 6000) {
            image.close();
            throw Error(
              "Artwork dimensions must be at most 6000 × 6000 pixels.",
            );
          }
          image.close();
          const org = state.members.find(
            (m) => m.user_id === user.id,
          ).organisation_id;
          const path = `${org}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
          const { error } = await db()
            .storage.from("business-assets")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (error) throw Error(error.message);
          data[input.dataset.upload + "_path"] = path;
        }
        await rpc("save_settings", {
          p_data: data,
          p_revision: settingsRevision,
        });
        await refresh();
        toast("Settings saved securely.");
        render();
      });
    };
    if (!admin())
      document
        .querySelectorAll(
          "#settings-form input,#settings-form textarea,#settings-form button[type=submit]",
        )
        .forEach((e) => (e.disabled = true));
  }
  async function pdfFor(d, sample = false, credit = null) {
    const j = job(d.job_id),
      c = customer(j?.customer_id),
      settings = d.snapshot?.settings || {
        ...defaultSettings,
        ...state.settings,
      };
    const b = await makePDF(d, {
      customer: d.snapshot?.customer || c,
      job: d.snapshot?.job || j,
      settings,
      payments: state.payments.filter((p) => p.job_id === d.job_id),
      credits: state.credits.filter((c) => c.invoice_id === d.id),
      sample: sample || d.status === "draft" || preview,
      credit,
      asset: async (path) => {
        const { data, error } = await db()
          .storage.from("business-assets")
          .download(path);
        if (error)
          throw Error("Cannot load private document artwork: " + error.message);
        return new Uint8Array(await data.arrayBuffer());
      },
    });
    return b;
  }
  async function showPDF(d, sample = false) {
    const blob = await pdfFor(d, sample);
    const url = URL.createObjectURL(blob);
    const el = modal(
      `<h2>${esc(d.number || "Document preview")}</h2><p>${sample || d.status === "draft" || preview ? "SAMPLE / NOT FOR ISSUE" : "Issued document"}</p><iframe title="A4 PDF preview" src="${url}"></iframe><div class="actions"><button data-close>Close</button><button id="download-pdf" class="primary">Download PDF</button></div>`,
      true,
    );
    el.querySelector("#download-pdf").onclick = () =>
      download(
        blob,
        `${d.number || "KC-draft"}${sample || d.status === "draft" || preview ? "-SAMPLE" : ""}.pdf`,
      );
    el.addEventListener("close", () => URL.revokeObjectURL(url), {
      once: true,
    });
  }
  async function navigate(next) {
    if (route === "editor" && dirty && !preview) {
      try {
        await saveCurrent();
      } catch (e) {
        if (
          !(await ask(
            "This draft could not be saved: " +
              e.message +
              "\nDiscard the unsaved changes and leave this form?",
          ))
        )
          return;
        dirty = false;
      }
    } else if (route === "editor" && dirty && preview) {
      if (!(await ask("Discard this unsaved preview draft?"))) return;
    }
    clearTimeout(saveTimer);
    dirty = false;
    route = next;
    current = null;
    render();
  }
  function render() {
    if (route === "dashboard") dashboard();
    else if (
      ["customers", "jobs", "quotes", "bookings", "invoices"].includes(route)
    )
      lists();
    else if (["customer", "job"].includes(route)) details();
    else if (route === "editor") editorPage();
    else if (route === "document") documentPage();
    else if (route === "reminders") remindersPage();
    else if (route === "settings") settingsPage();
  }
  app.addEventListener("click", (e) => {
    const el = e.target.closest("button,a");
    if (!el) return;
    if (el.dataset.nav) {
      e.preventDefault();
      navigate(el.dataset.nav);
      return;
    }
    if (el.dataset.customer) return openCustomer(el.dataset.customer);
    if (el.dataset.job) return openJob(el.dataset.job);
    if (el.dataset.doc) return openDoc(el.dataset.doc);
    if (el.dataset.credit) {
      const credit = state.credits.find((c) => c.id === el.dataset.credit);
      return busy(el, async () =>
        download(await pdfFor(current, false, credit), credit.number + ".pdf"),
      );
    }
    if (el.dataset.step !== undefined) {
      try {
        collectEditor();
        step = Number(el.dataset.step);
        render();
      } catch (err) {
        toast(err.message, true);
      }
      return;
    }
    if (el.dataset.scopeAction) {
      try {
        collectEditor();
        const n = Number(el.dataset.index),
          s = editor.body.scope;
        if (el.dataset.scopeAction === "copy") s.splice(n + 1, 0, s[n]);
        if (el.dataset.scopeAction === "delete") s.splice(n, 1);
        if (el.dataset.scopeAction === "up" && n > 0)
          [s[n - 1], s[n]] = [s[n], s[n - 1]];
        if (el.dataset.scopeAction === "down" && n < s.length - 1)
          [s[n + 1], s[n]] = [s[n], s[n + 1]];
        render();
        queueAutosave();
      } catch (err) {
        toast(err.message, true);
      }
      return;
    }
    if (el.dataset.lineAction) {
      try {
        collectEditor();
        const n = Number(el.dataset.index);
        if (el.dataset.lineAction === "copy")
          editor.body.items.splice(
            n + 1,
            0,
            structuredClone(editor.body.items[n]),
          );
        else editor.body.items.splice(n, 1);
        render();
        queueAutosave();
      } catch (err) {
        toast(err.message, true);
      }
      return;
    }
    if (!el.dataset.action) return;
    busy(el, async () => {
      const a = el.dataset.action;
      if (a === "menu") {
        document.querySelector(".shell").classList.toggle("nav-open");
        return;
      }
      if (a === "logout") {
        if (
          dirty &&
          !(await ask("Leave the workspace? Unsaved changes will be lost."))
        )
          return;
        clearTimeout(saveTimer);
        if (!preview && client) await KC.auth.signOut();
        user = null;
        preview = false;
        state = {
          members: [],
          customers: [],
          jobs: [],
          documents: [],
          payments: [],
          settings: {},
          credits: [],
        };
        editor = null;
        dirty = false;
        login();
        return;
      }
      if (a === "customers") return navigate("customers");
      if (a.startsWith("new-")) {
        if (route === "editor" && dirty) await saveCurrent();
        return newEditor(a.slice(4));
      }
      if (a === "add-customer") return customerForm();
      if (a === "edit-customer") return customerForm(current);
      if (a === "add-job") return jobForm();
      if (a === "edit-job") return jobForm(current);
      if (a === "editor-customer") {
        collectEditor();
        return customerForm(null, () => render());
      }
      if (a === "editor-job") {
        collectEditor();
        return jobForm(null, (id) => {
          editor.job_id = id;
          render();
        });
      }
      if (a === "next-step" || a === "prev-step") {
        collectEditor();
        step += a === "next-step" ? 1 : -1;
        render();
        return;
      }
      if (a === "add-scope") {
        collectEditor();
        editor.body.scope.push("");
        render();
        return;
      }
      if (a === "paste-scope") {
        collectEditor();
        const d = modal(
          `<h2>Paste your scope</h2><p>Split on new lines or bullet characters. Review and edit every item before issuing.</p><form>${area("Scope text", "scope")}<div class="actions"><button type="button" data-close>Cancel</button><button class="primary">Add work items</button></div></form>`,
        );
        d.querySelector("form").onsubmit = (e) => {
          e.preventDefault();
          editor.body.scope.push(
            ...new FormData(e.target)
              .get("scope")
              .split(/\n|[•●]/)
              .map((s) => s.trim().replace(/^(?:[-*]|\d+[.)])\s*/, ""))
              .filter(Boolean),
          );
          dirty = true;
          d.close();
          render();
          queueAutosave();
        };
        return;
      }
      if (a === "add-line") {
        collectEditor();
        editor.body.items.push({
          category: "labour",
          description: "",
          quantity: "1",
          unit: "hours",
          rate_cents: 0,
        });
        render();
        return;
      }
      if (a === "save-draft") {
        await saveCurrent();
        return;
      }
      if (a === "preview-editor") {
        collectEditor();
        const t = calculate(editor.body);
        return showPDF(
          {
            ...editor,
            number: editor.number || "DRAFT",
            status: "draft",
            totals: t,
          },
          true,
        );
      }
      if (a === "issue-editor") {
        const d = await saveCurrent();
        return confirmIssue(d);
      }
      if (a === "edit-document") {
        editor = structuredClone(current);
        step = 0;
        dirty = false;
        route = "editor";
        render();
        return;
      }
      if (a === "duplicate-document") {
        const source = current;
        newEditor(source.kind, source);
        toast(
          "New draft copied. It will receive a new document number when saved.",
        );
        return;
      }
      if (a === "from-invoice" || a === "from-booking")
        return newEditor(a.slice(5), current);
      if (a === "document-pdf") return showPDF(current);
      if (a === "issue-document") return confirmIssue(current);
      if (a === "mark-sent" || a === "mark-accepted") {
        requireLive();
        await rpc("set_document_status", {
          p_id: current.id,
          p_status: a === "mark-sent" ? "sent" : "accepted",
        });
        const id = current.id;
        await refresh();
        openDoc(id);
        return;
      }
      if (a === "editor-deposit") {
        collectEditor();
        if (!editor.job_id)
          throw Error(
            "Select or create a job before recording an actual deposit.",
          );
        return paymentForm(editor.job_id);
      }
      if (a === "job-deposit") return paymentForm(current.id);
      if (a === "booking-deposit") return paymentForm(current.job_id);
      if (a === "invoice-payment") return paymentForm(current.job_id, current);
      if (a === "delete-customer") return deleteCustomer();
      if (a === "void-document") return voidDocument();
      if (a === "credit") return creditForm();
      if (a === "export") {
        requireLive();
        if (
          !(await ask(
            "Download a private backup containing customer details and financial records? Store it securely, outside GitHub.",
          ))
        )
          return;
        download(
          new Blob(
            [
              JSON.stringify(
                { exported_at: new Date().toISOString(), ...state },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
          "KC-private-backup-" + localDate() + ".json",
        );
      }
    });
  });
  document.querySelector("#modal").addEventListener("click", (e) => {
    if (e.target.closest("[data-close]"))
      document.querySelector("#modal").close();
  });
  function confirmIssue(d) {
    const el = modal(
      `<h2>Issue ${esc(d.number)}?</h2><p>Review the scope, customer details, tax treatment, amounts and terms. Issuing saves the business and customer details with this document. Issued invoices and bookings are locked.</p><p>For NSW residential work, this document does not replace a required statutory building contract.</p>${d.kind === "booking" ? checkbox("Also mark this job Booking Confirmed", "confirm_job_status", false) : ""}<div class="actions"><button data-close>Back</button><button id="issue-confirm" class="primary">Confirm and issue</button></div>`,
    );
    el.querySelector("#issue-confirm").onclick = (e) =>
      busy(e.target, async () => {
        requireLive();
        if (d.kind === "booking")
          await KC.bookings.confirm(
            d,
            el.querySelector("[name=confirm_job_status]").checked,
          );
        else
          await rpc("issue_document", { p_id: d.id, p_revision: d.revision });
        dirty = false;
        await refresh();
        el.close();
        openDoc(d.id);
        toast("Document issued. It is ready to download.");
      });
  }
  async function deleteCustomer() {
    requireLive();
    const c = current,
      impact = await KC.customers.impact(c.id),
      linked = impact.jobs > 0;
    const el = modal(
      `<h2>${linked ? "Archive customer" : "Delete customer"}?</h2><p>${esc(displayCustomer(c))} · ${esc(c.number)}</p><p>Affected records: ${impact.jobs} jobs, ${impact.documents} documents, ${impact.issued} issued documents and ${impact.payments} receipts.</p><p>${linked ? "Linked records are retained. Archiving hides the customer from new-work selectors while preserving access to existing records. Financial records generally need to be kept for at least five years; review any longer applicable obligations." : "Permanent deletion cannot be undone. No linked jobs or financial records will be removed."}</p><form>${checkbox("I understand the effect on this customer record", "ack", false)}${field("Type customer ID to confirm", "confirmation", "", "text", "required")}<div class="actions"><button type="button" data-close>Cancel</button><button class="danger">${linked ? "Archive" : "Permanently delete"}</button></div></form>`,
    );
    el.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        if (!e.target.ack.checked)
          throw Error("Confirm you understand before continuing.");
        await KC.customers.remove({
          p_id: c.id,
          p_confirmation: e.target.confirmation.value,
          p_archive: linked,
        });
        await refresh();
        el.close();
        route = "customers";
        render();
        toast(
          linked ? "Customer archived. Records retained." : "Customer deleted.",
        );
      });
    };
  }
  function voidDocument() {
    const d = current;
    const el = modal(
      `<h2>${d.kind === "invoice" ? "Void / correct invoice" : "Cancel document"}</h2><p>The original record and document number are retained. A corrected invoice must be duplicated and issued with a new number. Invoices with receipts or credits cannot be voided here.</p><form>${area("Reason", "reason")}<div class="actions"><button type="button" data-close>Back</button><button class="danger">Confirm ${d.kind === "invoice" ? "void" : "cancellation"}</button></div></form>`,
    );
    el.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        requireLive();
        await rpc("set_document_status", {
          p_id: d.id,
          p_status: d.kind === "invoice" ? "void" : "cancelled",
          p_reason: new FormData(e.target).get("reason"),
        });
        await refresh();
        el.close();
        openDoc(d.id);
      });
    };
  }
  function creditForm() {
    const d = current;
    const el = modal(
      `<h2>Issue credit adjustment</h2><p>A credit reduces the unpaid invoice balance and records the reason and GST adjustment. Credits needing a refund require accountant review.</p><form>${field("Credit including GST $", "amount", "", "number", 'required min="0.01" step="0.01"')}${area("Reason", "reason")}<div class="actions"><button type="button" data-close>Cancel</button><button class="primary">Issue credit</button></div></form>`,
    );
    el.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        requireLive();
        const f = new FormData(e.target);
        await KC.invoices.credit({
          p_invoice: d.id,
          p_amount: cents(f.get("amount")),
          p_reason: f.get("reason"),
        });
        await refresh();
        el.close();
        openDoc(d.id);
        toast("Credit adjustment recorded.");
      });
    };
  }
  function login(error = "") {
    app.innerHTML = `<main class="login"><section class="login-brand"><img src="assets/logo/krishnas-construction.png" alt="Krishna's Construction — Specialists in Carpentry"><p>Built with care.<br>Managed with confidence.</p></section><section class="login-form"><div class="login-box"><div class="eyebrow">Your private workspace</div><h1>Welcome back.</h1><p>Everything for your next job, in one place.<br>Sign in to get started.</p>${!client ? '<div class="notice">Local preview only. Private records require a configured Supabase connection on the local server or hosted website. You can explore the interface below.</div>' : ""}${error ? `<p class="error-box">${esc(error)}</p>` : ""}<form id="login-form">${field("Email address", "email", "", "email", 'autocomplete="username" required placeholder="you@example.com"')}${field("Password", "password", "", "password", 'autocomplete="current-password" required')}<button class="primary" ${!client ? "disabled" : ""}>Sign in ${icon("arrow")}</button></form><div class="actions"><button class="text-button" id="reset-password" ${!client ? "disabled" : ""}>Forgot password?</button>${!client ? '<button class="text-button" id="preview-workspace">Explore interface preview →</button>' : ""}</div><p class="login-foot">${icon("lock")} Invite-only access · Krishna's Construction<br>Contact your administrator if you need help signing in.</p></div></section></main>`;
    document.querySelector("#login-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        const f = new FormData(e.target);
        const data = await KC.auth.signIn(f.get("email"), f.get("password"));
        user = data.user;
        try {
          await refresh();
          enterWorkspace();
        } catch (err) {
          await KC.auth.signOut();
          user = null;
          login(err.message);
        }
      });
    };
    document
      .querySelector("#preview-workspace")
      ?.addEventListener("click", () => {
        preview = true;
        enterWorkspace();
      });
    document.querySelector("#reset-password").onclick = () => {
      const el = modal(
        `<h2>Reset your password</h2><p>Enter the email attached to your approved account. Your provider will email a recovery link if configured.</p><form>${field("Account email", "email", "", "email", "required")}<div class="actions"><button type="button" data-close>Cancel</button><button class="primary">Request reset</button></div></form>`,
      );
      el.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        busy(e.submitter, async () => {
          await KC.auth.resetPassword(
            new FormData(e.target).get("email"),
            new URL("index.html", location.href).href,
          );
          el.close();
          toast(
            "Recovery requested. Check your inbox if this is an approved account.",
          );
        });
      };
    };
  }
  function recovery() {
    const el = modal(
      `<h2>Choose a new password</h2><form>${field("New password", "password", "", "password", 'minlength="12" required autocomplete="new-password"')}${field("Confirm new password", "confirm", "", "password", 'minlength="12" required autocomplete="new-password"')}<button class="primary">Update password</button></form>`,
    );
    el.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        const f = new FormData(e.target);
        if (f.get("password") !== f.get("confirm"))
          throw Error("Passwords do not match.");
        await KC.auth.changePassword(f.get("password"));
        await KC.auth.signOut();
        el.close();
        login();
        toast("Password updated. Sign in with your new password.");
      });
    };
  }
  window.addEventListener("beforeunload", (e) => {
    if (dirty && !preview) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document.querySelector(".shell")?.classList.remove("nav-open");
  });
  async function start() {
    const recoveryLink = location.hash.includes("type=recovery");
    try {
      client = await connect();
      login();
      if (client) {
        client.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY") queueMicrotask(recovery);
          if (event === "SIGNED_OUT" && user) {
            user = null;
            clearTimeout(saveTimer);
            dirty = false;
            login();
          }
        });
        const { data } = await client.auth.getSession();
        if (data.session && recoveryLink) recovery();
      }
    } catch (e) {
      login(e.message);
    }
  }

  KC.main = { start };
})((globalThis.KC = globalThis.KC || {}));
