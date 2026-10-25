// Receipt state is derived from recorded money, never a manually checked PAID flag.
(function (KC) {
  "use strict";
  function receiptsFor(invoice, payments) {
    return payments.filter((payment) => payment.invoice_id === invoice.id);
  }
  function summary(invoice, payments) {
    return KC.calculations.balance(
      invoice.totals.total_cents,
      receiptsFor(invoice, payments),
      invoice.credit_cents || 0,
    );
  }
  function recordPayment(payload) {
    if (
      !["deposit", "final"].includes(payload.p_kind) ||
      !Number.isSafeInteger(payload.p_amount) ||
      payload.p_amount <= 0
    )
      throw Error("Enter a positive actual receipt amount.");
    if (!payload.p_date || payload.p_date > KC.calculations.localDate())
      throw Error("Enter an actual receipt date, not a future date.");
    return KC.database.rpc("record_payment", payload);
  }
  KC.invoices = {
    receiptsFor,
    summary,
    recordPayment,
    save: (payload) => KC.quotes.save(payload),
    credit: (payload) => KC.database.rpc("create_credit", payload),
  };
})((globalThis.KC = globalThis.KC || {}));
