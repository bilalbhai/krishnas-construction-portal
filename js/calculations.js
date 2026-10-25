// Plain browser script: no build step or module loader is required.
(function (KC) {
  "use strict";
  // Match PostgreSQL numeric ROUND (non-negative inputs): half a cent rounds up.
  function decimal(value, places = 4) {
    const s = String(value ?? 0).trim();
    if (!/^\d+(\.\d+)?$/.test(s))
      throw Error("Enter a positive number or zero.");
    const [a, b = ""] = s.split(".");
    if (b.length > places) throw Error(`Use at most ${places} decimal places.`);
    const n = BigInt(a) * 10n ** BigInt(places) + BigInt(b.padEnd(places, "0"));
    if (n > 100000000000000n) throw Error("Amount is too large.");
    return n;
  }
  const cents = (v) => Number(decimal(v, 2));
  const money = (v) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(Number(v || 0) / 100);
  const round = (n, d) => (n + d / 2n) / d;
  function calculate(body) {
    let categories = {
      labour: 0n,
      materials: 0n,
      additional: 0n,
      variation: 0n,
    };
    const items = (body.items || []).map((i) => {
      if (!(i.category in categories)) throw Error("Unknown cost category.");
      const rate = BigInt(i.rate_cents || 0);
      if (rate < 0n || rate > 100000000000n) throw Error("Invalid unit price.");
      const amount = round(decimal(i.quantity ?? 1) * rate, 10000n);
      categories[i.category] += amount;
      return { ...i, amount_cents: Number(amount) };
    });
    let direct = Object.values(categories).reduce((a, b) => a + b, 0n),
      base = direct,
      fee = 0n;
    if (
      body.quote_type === "fixed" &&
      body.fixed_cents !== null &&
      body.fixed_cents !== undefined
    ) {
      base = BigInt(body.fixed_cents);
      if (base < 0n) throw Error("Fixed price cannot be negative.");
    }
    if (body.quote_type === "cost-plus") {
      fee =
        body.fee_method === "fixed"
          ? BigInt(body.fee_cents || 0)
          : round(base * decimal(body.markup_percent || 0), 1000000n);
      if (fee < 0n) throw Error("Fee cannot be negative.");
      base += fee;
    }
    const discount = BigInt(body.discount_cents || 0);
    if (discount < 0n || discount > base)
      throw Error("Discount cannot exceed charges.");
    base -= discount;
    if (!["taxable", "gst-free", "other"].includes(body.tax || "taxable"))
      throw Error("Select a tax treatment.");
    let gst =
      body.tax === "taxable"
        ? round(base, body.price_mode === "inclusive" ? 11n : 10n)
        : 0n;
    const total =
      body.tax === "taxable" && body.price_mode !== "inclusive"
        ? base + gst
        : base;
    const deposit = BigInt(body.deposit_cents || 0);
    if (deposit < 0n || deposit > total)
      throw Error("Requested deposit cannot exceed total.");
    if (total > 100000000000n) throw Error("Document total is too large.");
    return {
      items,
      ...Object.fromEntries(
        Object.entries(categories).map(([k, v]) => [k, Number(v)]),
      ),
      direct_cents: Number(direct),
      adjustment_cents: Number(
        (body.quote_type === "fixed" ? base + discount : direct) - direct,
      ),
      fee_cents: Number(fee),
      discount_cents: Number(discount),
      net_cents: Number(total - gst),
      gst_cents: Number(gst),
      total_cents: Number(total),
      deposit_cents: Number(deposit),
    };
  }
  function balance(total, payments = [], credits = 0) {
    const paid = payments.reduce((s, p) => s + Number(p.amount_cents), 0);
    return {
      paid,
      due: Math.max(0, total - credits - paid),
      overpaid: Math.max(0, paid + credits - total),
    };
  }
  function paymentStatus(doc, payments = [], today = localDate()) {
    if (doc.status === "draft" || doc.status === "void") return doc.status;
    const b = balance(doc.totals.total_cents, payments, doc.credit_cents || 0);
    if (b.due === 0) return b.paid > 0 ? "Paid" : "Settled";
    if (doc.body.due_date && doc.body.due_date < today) return "Overdue";
    return b.paid ? "Partially Paid" : "Unpaid";
  }
  function localDate(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
  function reminder(doc, payments = [], today = localDate()) {
    if (
      doc.kind !== "invoice" ||
      ["draft", "void"].includes(doc.status) ||
      !doc.body.due_date ||
      !balance(doc.totals.total_cents, payments, doc.credit_cents || 0).due
    )
      return null;
    const days = Math.round(
      (Date.parse(doc.body.due_date) - Date.parse(today)) / 86400000,
    );
    return days < 0
      ? { label: "Overdue", days: -days }
      : days === 0
        ? { label: "Due today", days: 0 }
        : days <= 7
          ? { label: "Due soon", days }
          : null;
  }

  KC.calculations = {
    decimal,
    cents,
    money,
    calculate,
    balance,
    paymentStatus,
    localDate,
    reminder,
  };
})((globalThis.KC = globalThis.KC || {}));
