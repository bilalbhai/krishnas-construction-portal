// Customer master records are optional descriptive fields plus a server-created ID.
(function (KC) {
  "use strict";
  const fields = [
    "name",
    "phone",
    "email",
    "company",
    "abn",
    "billing_address",
    "site_address",
    "notes",
  ];
  function label(customer) {
    return (
      customer?.data.name ||
      customer?.data.company ||
      customer?.number ||
      "New customer"
    );
  }
  function matches(customer, query, jobs = [], documents = []) {
    const jobIds = new Set(
      jobs
        .filter((job) => job.customer_id === customer.id)
        .map((job) => job.id),
    );
    const quoteNumbers = documents
      .filter((doc) => doc.kind === "quote" && jobIds.has(doc.job_id))
      .map((doc) => doc.number);
    return [customer.number, ...Object.values(customer.data), ...quoteNumbers]
      .join(" ")
      .toLocaleLowerCase("en-AU")
      .includes(query.toLocaleLowerCase("en-AU"));
  }
  async function save(payload) {
    payload = {
      ...payload,
      p_data: Object.fromEntries(
        fields.map((key) => [key, String(payload.p_data[key] ?? "").trim()]),
      ),
    };
    return KC.database.rpc("save_customer", payload);
  }
  KC.customers = {
    label,
    matches,
    save,
    impact: (id) => KC.database.rpc("customer_impact", { p_id: id }),
    remove: (payload) => KC.database.rpc("remove_customer", payload),
  };
})((globalThis.KC = globalThis.KC || {}));
