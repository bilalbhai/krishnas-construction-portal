// Jobs stay independent of document stages; one customer may have many jobs.
(function (KC) {
  "use strict";
  const statuses = [
    "New Lead",
    "Quotation Prepared",
    "Quotation Sent",
    "Accepted",
    "Booking Confirmed",
    "Scheduled",
    "In Progress",
    "Completed",
    "Invoiced",
    "Partially Paid",
    "Paid",
    "Cancelled",
  ];
  async function save(payload) {
    if (!statuses.includes(payload.p_status))
      throw Error("Choose a valid job status.");
    const { start_date, end_date } = payload.p_data;
    if (start_date && end_date && end_date < start_date)
      throw Error("Completion cannot precede the start date.");
    return KC.database.rpc("save_job", payload);
  }
  function upcoming(jobs, today = KC.calculations.localDate()) {
    return jobs
      .filter(
        (job) =>
          job.data.start_date &&
          job.data.start_date >= today &&
          !["Completed", "Paid", "Cancelled"].includes(job.status),
      )
      .sort((a, b) => a.data.start_date.localeCompare(b.data.start_date));
  }
  KC.jobs = { statuses, save, upcoming };
})((globalThis.KC = globalThis.KC || {}));
