import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import vm from "node:vm";
import { makePDF } from "./classic.mjs";
import { calculate } from "./classic.mjs";
test("A4 vector PDFs, long scopes, paid and draft variants", async () => {
  vm.runInThisContext(
    await readFile(
      new URL("../assets/pdf-lib.min.js", import.meta.url),
      "utf8",
    ),
  );
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      await readFile(
        new URL("../assets/logo/krishnas-construction.png", import.meta.url),
      ),
    );
  const body = {
    date: "2026-10-25",
    due_date: "2026-11-08",
    title: "TEST ONLY timber restoration",
    site_address: "TEST ONLY site",
    summary: "Synthetic document for testing. Not a real customer.",
    scope: Array.from(
      { length: 55 },
      (_, i) =>
        `${i + 1}: TEST ONLY repair and prepare timber, including weathered sections, seal junctions and finish to the agreed specification.`,
    ),
    items: [
      {
        category: "labour",
        description: "TEST ONLY labour",
        quantity: "16",
        unit: "hours",
        rate_cents: 5000,
      },
      {
        category: "materials",
        description: "TEST ONLY timber and paint",
        quantity: "2",
        unit: "each",
        rate_cents: 10000,
      },
    ],
    tax: "taxable",
    price_mode: "exclusive",
    quote_type: "hourly",
    deposit_cents: 5000,
    terms:
      "TEST ONLY terms\n" +
      "A long term that remains readable across page breaks. ".repeat(30),
    use_stamp: true,
    use_signature: true,
  };
  const base = {
    id: "test-doc",
    number: "KC-I-TEST",
    kind: "invoice",
    status: "issued",
    body,
    totals: calculate(body),
    credit_cents: 0,
  };
  const ctx = {
    settings: {
      business_name: "TEST ONLY Krishna's Construction",
      abn: "TEST ONLY",
      gst_registered: true,
    },
    customer: { number: "KC-C-TEST", data: { name: "TEST ONLY Customer" } },
    job: { number: "KC-J-TEST" },
    payments: [
      {
        invoice_id: "test-doc",
        kind: "final",
        amount_cents: 110000,
        paid_date: "2026-10-25",
      },
    ],
    sample: true,
  };
  await mkdir(new URL("../tmp/pdfs/", import.meta.url), { recursive: true });
  try {
    for (const [name, doc, context] of [
      ["long-quote", { ...base, kind: "quote" }, ctx],
      [
        "short-quote",
        {
          ...base,
          kind: "quote",
          body: {
            ...body,
            scope: ["TEST ONLY short scope"],
            terms: "TEST ONLY approved terms",
            use_stamp: false,
            use_signature: false,
          },
        },
        ctx,
      ],
      [
        "booking",
        {
          ...base,
          kind: "booking",
          body: {
            ...body,
            scope: [],
            start_date: "2026-11-01",
            end_date: "2026-11-02",
            use_signature: false,
          },
        },
        ctx,
      ],
      [
        "paid-invoice",
        {
          ...base,
          body: {
            ...body,
            scope: [],
            terms: "TEST ONLY",
            use_signature: false,
          },
        },
        { ...ctx, sample: false },
      ],
      [
        "unpaid-invoice",
        {
          ...base,
          body: {
            ...body,
            scope: [],
            terms: "TEST ONLY",
            use_signature: false,
            use_stamp: false,
          },
        },
        { ...ctx, payments: [], sample: false },
      ],
      [
        "credit-adjustment",
        { ...base, body: { ...body, scope: [], use_signature: false, use_stamp: false } },
        { ...ctx, sample: false, credit: { number: "KC-CN-TEST", created_at: "2026-10-25", reason: "TEST ONLY agreed adjustment", amount_cents: 1100, gst_cents: 100 } },
      ],
    ]) {
      const bytes = new Uint8Array(
        await (await makePDF(doc, context)).arrayBuffer(),
      );
      const parsed = await PDFLib.PDFDocument.load(bytes);
      assert.ok(parsed.getPageCount() >= 1);
      for (const page of parsed.getPages()) {
        assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1);
        assert.ok(Math.abs(page.getHeight() - 841.89) < 0.1);
      }
      if (name === "long-quote") assert.ok(parsed.getPageCount() >= 3);
      if (name === "short-quote")
        assert.equal(
          parsed.getPageCount(),
          2,
          "A short quotation has one content page and one terms page.",
        );
      await writeFile(
        new URL("../tmp/pdfs/" + name + ".pdf", import.meta.url),
        bytes,
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});
