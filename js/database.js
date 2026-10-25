// Plain browser script: no build step or module loader is required.
(function (KC) {
  "use strict";
  const { db } = KC.auth;
  async function rpc(name, args = {}) {
    const { data, error } = await db().rpc(name, args);
    if (error) throw Error(error.message);
    return data;
  }
  async function rows(table) {
    let all = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await db()
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .range(start, start + 499);
      if (error) throw Error(error.message);
      all.push(...data);
      if (data.length < 500) break;
    }
    return all;
  }
  async function loadWorkspace() {
    const [members, customers, jobs, documents, payments, settings, credits] =
      await Promise.all(
        [
          "organisation_members",
          "customers",
          "jobs",
          "documents",
          "payments",
          "business_settings",
          "credit_notes",
        ].map(rows),
      );
    if (!members.length)
      throw Error(
        "Your account has no approved workspace membership. Ask the administrator to provision access.",
      );
    return {
      members,
      customers,
      jobs,
      documents,
      payments,
      settings: settings[0]?.data || {},
      credits,
    };
  }

  KC.database = { rpc, rows, loadWorkspace };
})((globalThis.KC = globalThis.KC || {}));
