import { test } from "node:test";
import assert from "node:assert/strict";
import "./classic.mjs";
test("Customer search includes all requested identifiers without merging duplicate names", () => {
  const c = {
    id: "c1",
    number: "KC-C-12",
    data: {
      name: "TEST ONLY Duplicate",
      phone: "0400000000",
      email: "test@example.invalid",
    },
  };
  const jobs = [
    { id: "j1", customer_id: "c1" },
    { id: "j2", customer_id: "c2" },
  ];
  const docs = [
    { kind: "quote", job_id: "j1", number: "KC-Q-20" },
    { kind: "quote", job_id: "j2", number: "KC-Q-99" },
  ];
  for (const q of [
    "Duplicate",
    "0400000000",
    "test@example.invalid",
    "KC-C-12",
    "KC-Q-20",
  ])
    assert.equal(KC.customers.matches(c, q, jobs, docs), true);
  assert.equal(KC.customers.matches(c, "KC-Q-99", jobs, docs), false);
});
test("Duplicated quotes and imported invoices retain independent fixed/cost-plus inputs", () => {
  for (const quote_type of ["fixed", "hourly", "cost-plus"]) {
    const source = {
      id: "q1",
      job_id: "j1",
      kind: "quote",
      body: {
        quote_type,
        items: [{ category: "labour", quantity: "1", rate_cents: 1000 }],
        scope: ["TEST ONLY"],
        terms: "TEST ONLY approved terms",
        fixed_cents: 2000,
        markup_percent: "15",
        fee_method: "percentage",
      },
    };
    const draft = KC.quotes.createDraft("invoice", {
      source,
      date: "2026-10-25",
      settings: {
        invoice_due_days: "14",
        invoice_terms: "TEST ONLY invoice terms",
      },
    });
    assert.equal(draft.id, null);
    assert.equal(draft.body.quote_type, quote_type);
    assert.equal(draft.body.due_date, "2026-11-08");
    draft.body.items[0].rate_cents = 9000;
    draft.body.scope[0] = "Changed";
    assert.equal(source.body.items[0].rate_cents, 1000);
    assert.equal(source.body.scope[0], "TEST ONLY");
  }
  assert.deepEqual(
    KC.quotes.splitScope("• First task\n2. Second task\n- Third task"),
    ["First task", "Second task", "Third task"],
  );
});
test("Booking deposits and invoice balances use actual correctly linked receipts", () => {
  const payments = [
    { job_id: "j1", invoice_id: "i1", kind: "deposit", amount_cents: 1000 },
    { job_id: "j1", invoice_id: "i1", kind: "final", amount_cents: 3000 },
    { job_id: "j1", invoice_id: "i2", kind: "final", amount_cents: 8000 },
  ];
  assert.equal(KC.bookings.depositReceived(payments, "j1"), 1000);
  assert.deepEqual(
    KC.invoices.summary(
      { id: "i1", totals: { total_cents: 6000 }, credit_cents: 500 },
      payments,
    ),
    { paid: 4000, due: 1500, overpaid: 0 },
  );
});
