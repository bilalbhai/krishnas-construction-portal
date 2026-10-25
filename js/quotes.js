// Draft creation, copying and scope parsing are shared by all three document editors.
(function (KC) {
  "use strict";
  function addDays(date, days) {
    if (days === "" || days === undefined || days === null) return "";
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d.toISOString().slice(0, 10);
  }
  function createDraft(
    kind,
    {
      source = null,
      job = null,
      settings = {},
      date = KC.calculations.localDate(),
    } = {},
  ) {
    if (!["quote", "booking", "invoice"].includes(kind))
      throw Error("Unknown document type.");
    const body = source
      ? structuredClone(source.body)
      : {
          title: job?.data.title || "",
          site_address: job?.data.site_address || "",
          summary: job?.data.description || "",
          scope: [],
          exclusions: "",
          assumptions: "",
          notes: "",
          special_instructions: "",
          quote_type: "fixed",
          cost_basis: "estimated",
          fee_method: "percentage",
          markup_percent: "0",
          fee_cents: 0,
          fixed_cents: null,
          discount_cents: 0,
          deposit_cents: 0,
          tax: "taxable",
          tax_reason: "",
          price_mode: "exclusive",
          items: [],
          contract_context: "",
          use_signature: false,
          use_stamp: false,
        };
    Object.assign(body, {
      date,
      due_date:
        kind === "invoice" ? addDays(date, settings.invoice_due_days) : "",
      expiry_date:
        kind === "quote" ? addDays(date, settings.quote_valid_days) : "",
      terms:
        kind === "invoice"
          ? source?.kind === "invoice"
            ? source.body.terms
            : settings.invoice_terms || ""
          : (source?.body.terms ?? settings.quote_terms ?? ""),
    });
    return {
      id: null,
      revision: 0,
      kind,
      job_id: job?.id || source?.job_id || "",
      source_id: source?.id || null,
      body,
      totals: null,
    };
  }
  function splitScope(text) {
    return text
      .split(/\n|[•●]/)
      .map((s) => s.trim().replace(/^(?:[-*]|\d+[.)])\s*/, ""))
      .filter(Boolean);
  }
  function save(payload) {
    KC.calculations.calculate(payload.p_body);
    return KC.database.rpc("save_document", payload);
  }
  KC.quotes = { createDraft, splitScope, save, addDays };
})((globalThis.KC = globalThis.KC || {}));
