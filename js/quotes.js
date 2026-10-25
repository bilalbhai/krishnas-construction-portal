// Draft creation, copying and scope parsing are shared by all three document editors.
(function (KC) {
  "use strict";
  const defaultTerms = "1. Scope of work\nOur price covers only the work, materials and finishes expressly described in this document. Exclusions and assumptions form part of the scope.\n2. Variations\nChanges to the agreed scope, materials or site conditions must be documented and agreed in writing, including the effect on price and timing, before additional work proceeds.\n3. Site access and scheduling\nPlease provide safe, reasonable access to the work area at the agreed times. Start and completion dates are subject to confirmed access, material availability and weather. We will advise you of changes affecting the programme.\n4. Deposits and payments\nThe deposit requested and payment arrangements are shown in this document. A deposit is recorded as received only after payment has been confirmed. Any required building contract governs its payment schedule.\n5. Materials and concealed conditions\nMaterials and finishes will follow the agreed specification. Proposed substitutions and unforeseen conditions will be discussed with you before related changes are authorised.\n6. Acceptance and statutory rights\nPlease confirm acceptance in writing. Any legally required building contract and insurance must be arranged before work or payments proceed as required. This document does not replace that contract or limit statutory warranties or consumer rights.";
  const invoiceTerms = "Payment is due on the date stated on this invoice, in accordance with the agreed contract and payment schedule. Please use the invoice number as your payment reference. Only confirmed payments and credit adjustments are deducted from the balance. If any item requires clarification, please contact us promptly so we can assist. Nothing in this invoice limits your statutory warranties or consumer rights.";
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
        kind === "quote" ? addDays(date, 14) : "",
      terms:
        kind === "invoice"
          ? source?.kind === "invoice"
            ? source.body.terms
            : settings.invoice_terms || invoiceTerms
          : (source?.body.terms ?? settings.quote_terms ?? defaultTerms),
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
  KC.quotes = { createDraft, splitScope, save, addDays, defaultTerms, invoiceTerms };
})((globalThis.KC = globalThis.KC || {}));
