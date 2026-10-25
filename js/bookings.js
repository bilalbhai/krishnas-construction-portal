// Confirming is explicit; accepting a quotation never creates a booking automatically.
(function (KC) {
  "use strict";
  function depositReceived(payments, jobId) {
    return payments
      .filter((p) => p.job_id === jobId && p.kind === "deposit")
      .reduce((sum, p) => sum + Number(p.amount_cents), 0);
  }
  function confirm(document, updateJob) {
    return KC.database.rpc("confirm_booking", {
      p_id: document.id,
      p_revision: document.revision,
      p_update_job: Boolean(updateJob),
    });
  }
  KC.bookings = {
    depositReceived,
    confirm,
    save: (payload) => KC.quotes.save(payload),
  };
})((globalThis.KC = globalThis.KC || {}));
