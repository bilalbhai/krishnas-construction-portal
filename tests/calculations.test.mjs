import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  cents,
  balance,
  paymentStatus,
  reminder,
  localDate,
} from "./classic.mjs";
const body = (over = {}) => ({
  quote_type: "hourly",
  items: [
    {
      category: "labour",
      description: "TEST ONLY labour",
      quantity: "8",
      rate_cents: 5000,
    },
    {
      category: "materials",
      description: "TEST ONLY timber",
      quantity: "2.5",
      rate_cents: 1000,
    },
  ],
  tax: "taxable",
  price_mode: "exclusive",
  deposit_cents: 0,
  ...over,
});
test("Labour, fractional materials, GST-exclusive and cents", () => {
  const t = calculate(body());
  assert.equal(t.labour, 40000);
  assert.equal(t.materials, 2500);
  assert.equal(t.gst_cents, 4250);
  assert.equal(t.total_cents, 46750);
  assert.equal(cents("2295.00"), 229500);
  assert.equal(cents("0.10"), 10);
});
test("GST inclusive extracts 1/11", () => {
  const t = calculate(body({ price_mode: "inclusive" }));
  assert.equal(t.total_cents, 42500);
  assert.equal(t.gst_cents, 3864);
  assert.equal(t.net_cents, 38636);
});
test("Cost plus percentage and fixed management fee", () => {
  assert.equal(
    calculate(
      body({
        quote_type: "cost-plus",
        fee_method: "percentage",
        markup_percent: "15",
      }),
    ).total_cents,
    53763,
  );
  assert.equal(
    calculate(
      body({ quote_type: "cost-plus", fee_method: "fixed", fee_cents: 10000 }),
    ).total_cents,
    57750,
  );
});
test("Fixed overall price retains disclosed adjustment", () => {
  const t = calculate(body({ quote_type: "fixed", fixed_cents: 50000 }));
  assert.equal(t.adjustment_cents, 7500);
  assert.equal(t.total_cents, 55000);
});
test("Discounts, deposit and legitimate zero GST", () => {
  const t = calculate(
    body({ discount_cents: 2500, deposit_cents: 5000, tax: "gst-free" }),
  );
  assert.equal(t.gst_cents, 0);
  assert.equal(t.total_cents, 40000);
  assert.equal(t.deposit_cents, 5000);
  assert.deepEqual(
    balance(t.total_cents, [{ amount_cents: 5000 }, { amount_cents: 10000 }]),
    { paid: 15000, due: 25000, overpaid: 0 },
  );
});
test("Rounding uses half-up per line", () => {
  assert.equal(
    calculate(
      body({ items: [{ category: "labour", quantity: "0.5", rate_cents: 1 }] }),
    ).total_cents,
    1,
  );
});
test("Invalid amounts are rejected", () => {
  for (const v of ["-1", "NaN", "1.001", "1e2"]) assert.throws(() => cents(v));
  assert.throws(() => calculate(body({ discount_cents: 50000 })));
  assert.throws(() => calculate(body({ deposit_cents: 100000 })));
});
test("Credits, partial receipts, paid and overpayment handling", () => {
  const d = {
    kind: "invoice",
    status: "issued",
    body: { due_date: "2026-10-30" },
    totals: { total_cents: 11000 },
    credit_cents: 1000,
  };
  assert.equal(
    paymentStatus(d, [{ amount_cents: 5000 }], "2026-10-25"),
    "Partially Paid",
  );
  assert.equal(
    paymentStatus(d, [{ amount_cents: 10000 }], "2026-10-25"),
    "Paid",
  );
  assert.equal(balance(100, [{ amount_cents: 120 }]).overpaid, 20);
  assert.equal(paymentStatus({ ...d, status: "void" }, []), "void");
});
test("Reminders exclude settled/void/draft invoices and use Sydney date", () => {
  const d = {
    kind: "invoice",
    status: "issued",
    body: { due_date: "2026-10-25" },
    totals: { total_cents: 1000 },
  };
  assert.equal(reminder(d, [], "2026-10-25").label, "Due today");
  assert.equal(reminder(d, [], "2026-10-26").days, 1);
  assert.equal(reminder(d, [], "2026-10-20").label, "Due soon");
  assert.equal(reminder(d, [{ amount_cents: 1000 }]), null);
  assert.equal(reminder({ ...d, status: "draft" }), null);
  assert.equal(localDate(new Date("2026-10-24T16:00:00Z")), "2026-10-25");
});
