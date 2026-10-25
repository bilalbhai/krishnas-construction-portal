// Isolated PostgreSQL/WASM tests; no connection to any real Supabase project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
let available = true;
let databaseModule = "@electric-sql/pglite";
try {
  await import(databaseModule);
} catch {
  databaseModule = "../tmp/package/dist/index.js";
  try {
    await access(new URL(databaseModule, import.meta.url));
  } catch {
    available = false;
  }
}
test(
  "PostgreSQL migrations, RLS and full business workflow",
  { skip: !available, timeout: 120000 },
  async (t) => {
    const { PGlite } = await import(databaseModule);
    const db = new PGlite();
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant usage on schema public to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;`,
    );
    for (const file of [
      "001_workspace.sql",
      "002_operations.sql",
      "003_assets.sql",
      "004_booking_confirmation.sql",
      "005_invoice_prefix.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const owner = "11111111-1111-4111-8111-111111111111",
      employee = "22222222-2222-4222-8222-222222222222",
      outsider = "33333333-3333-4333-8333-333333333333",
      org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.exec(
      `insert into auth.users values('${owner}'),('${employee}'),('${outsider}');insert into organisations(id,name) values('${org}','TEST ONLY');insert into organisation_members(organisation_id,user_id,role) values('${org}','${owner}','owner'),('${org}','${employee}','employee');`,
    );
    async function role(id, fn) {
      await db.exec(
        `set role authenticated;set request.jwt.claim.sub='${id}';`,
      );
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
      }
    }
    const call = async (name, args) => {
      const placeholders = args.map((_, i) => "$" + (i + 1)).join(",");
      const r = await db.query(
        `select public.${name}(${placeholders}) as result`,
        args.map((x) => (x && typeof x === "object" ? JSON.stringify(x) : x)),
      );
      return r.rows[0].result;
    };
    const q = async (sql, args = []) => (await db.query(sql, args)).rows;
    let cid, jid, qid, iid, bid;
    const b = {
      title: "TEST ONLY timber repairs",
      summary: "TEST ONLY",
      scope: ["TEST ONLY replace timber"],
      items: [
        {
          category: "labour",
          description: "TEST ONLY labour",
          quantity: "8",
          rate_cents: 5000,
          unit: "hours",
        },
        {
          category: "materials",
          description: "TEST ONLY materials",
          quantity: "2.5",
          rate_cents: 1000,
          unit: "m",
        },
      ],
      quote_type: "hourly",
      price_mode: "exclusive",
      tax: "taxable",
      deposit_cents: 4000,
      discount_cents: 0,
      date: "2026-10-25",
      due_date: "2026-11-08",
      contract_context: "nsw-residential",
      terms: "TEST ONLY terms",
      use_signature: false,
      use_stamp: false,
    };
    await t.test(
      "Empty optional customers, duplicate names and multiple jobs",
      () =>
        role(owner, async () => {
          cid = await call("save_customer", [null, {}, 0]);
          assert.ok(cid);
          const second = await call("save_customer", [
            null,
            { name: "TEST ONLY duplicate" },
            0,
          ]);
          await call("save_customer", [
            cid,
            { name: "TEST ONLY duplicate", notes: "A&B <safe> O'Brien" },
            1,
          ]);
          jid = await call("save_job", [
            null,
            cid,
            { title: "TEST ONLY" },
            "New Lead",
            0,
          ]);
          await call("save_job", [null, cid, {}, "In Progress", 0]);
          assert.equal((await q("select * from customers")).length, 2);
          assert.ok(second);
        }),
    );
    await t.test(
      "Anonymous and outsider denied; direct mutation and role escalation denied",
      async () => {
        await db.exec("set role anon");
        await assert.rejects(q("select * from customers"), /permission denied/);
        await assert.rejects(
          call("save_customer", [null, {}, 0]),
          /permission denied/,
        );
        await db.exec("reset role");
        await role(outsider, async () => {
          assert.equal((await q("select * from customers")).length, 0);
          await assert.rejects(
            call("save_customer", [null, {}, 0]),
            /membership/,
          );
        });
        await role(employee, async () => {
          await assert.rejects(
            db.exec("update organisation_members set role='owner'"),
            /permission denied/,
          );
          await assert.rejects(
            call("save_settings", [{}, 0]),
            /owner\/administrator/,
          );
          await assert.rejects(
            db.exec(
              "insert into customers(organisation_id,number) values('" +
                org +
                "','bad')",
            ),
            /permission denied/,
          );
        });
      },
    );
    await t.test(
      "Settings approvals, quotes, price recalculation and booking",
      () =>
        role(owner, async () => {
          qid = await call("save_document", [
            null,
            "quote",
            jid,
            null,
            { ...b, total_cents: 1 },
            0,
          ]);
          let d = (await q("select * from documents where id=$1", [qid]))[0];
          assert.equal(d.totals.total_cents, 46750);
          await assert.rejects(call("issue_document", [qid, 1]), /identity/);
          await call("save_settings", [
            {
              business_name: "TEST ONLY business",
              abn: "TEST ONLY",
              gst_registered: true,
              identity_approved: true,
              terms_approved: true,
            },
            0,
          ]);
          await call("issue_document", [qid, 1]);
          await call("set_document_status", [qid, "sent", ""]);
          await call("set_document_status", [qid, "accepted", ""]);
          bid = await call("save_document", [null, "booking", jid, qid, b, 0]);
          await call("issue_document", [bid, 1]);
          await assert.rejects(
            call("save_document", [bid, "booking", jid, qid, b, 2]),
            /locked/,
          );
        }),
    );
    await t.test(
      "Deposit allocated exactly once, independent invoice and immutable snapshot",
      () =>
        role(owner, async () => {
          await call("record_payment", [
            jid,
            null,
            "deposit",
            4000,
            "2026-10-25",
            "Bank transfer",
            "TEST ONLY",
          ]);
          iid = await call("save_document", [null, "invoice", jid, qid, b, 0]);
          await call("issue_document", [iid, 1]);
          assert.equal(
            (await q("select * from payments where invoice_id=$1", [iid]))
              .length,
            1,
          );
          const initial = (
            await q("select * from documents where id=$1", [iid])
          )[0];
          await call("save_document", [
            qid,
            "quote",
            jid,
            null,
            { ...b, title: "TEST ONLY changed quote" },
            4,
          ]);
          const unchanged = (
            await q("select * from documents where id=$1", [iid])
          )[0];
          assert.deepEqual(unchanged.body, initial.body);
          await call("save_settings", [
            {
              business_name: "TEST ONLY updated",
              abn: "TEST ONLY",
              gst_registered: true,
              identity_approved: true,
              terms_approved: true,
            },
            1,
          ]);
          assert.equal(
            unchanged.snapshot.settings.business_name,
            "TEST ONLY business",
          );
          await assert.rejects(
            call("save_document", [iid, "invoice", jid, qid, b, 2]),
            /locked/,
          );
          await assert.rejects(
            call("record_payment", [
              jid,
              iid,
              "deposit",
              1000,
              "2026-10-25",
              "Cash",
              "",
            ]),
            /unique/,
          );
        }),
    );
    await t.test(
      "Partial, overpayment, credit adjustments and final settlement",
      () =>
        role(owner, async () => {
          await assert.rejects(
            call("record_payment", [
              jid,
              iid,
              "final",
              50000,
              "2026-10-25",
              "Cash",
              "",
            ]),
            /Overpayment/,
          );
          await call("record_payment", [
            jid,
            iid,
            "final",
            40000,
            "2026-10-25",
            "Cash",
            "TEST ONLY",
          ]);
          const credit = await call("create_credit", [
            iid,
            2750,
            "TEST ONLY agreed credit",
          ]);
          assert.ok(credit);
          const d = (await q("select * from documents where id=$1", [iid]))[0];
          assert.equal(d.credit_cents, 2750);
          assert.equal(d.totals.total_cents - d.credit_cents - 44000, 0);
          await assert.rejects(
            call("set_document_status", [iid, "void", "TEST ONLY correction"]),
            /financial entries/,
          );
        }),
    );
    await t.test(
      "Optimistic concurrency, independent numbering, safe deletion",
      () =>
        role(owner, async () => {
          await assert.rejects(call("save_customer", [cid, {}, 1]), /changed/);
          const impact = await call("customer_impact", [cid]);
          assert.equal(impact.jobs, 2);
          const c = (await q("select * from customers where id=$1", [cid]))[0];
          await assert.rejects(
            call("remove_customer", [cid, c.number, false]),
            /retained/,
          );
          await call("remove_customer", [cid, c.number, true]);
          assert.equal(
            (await q("select * from customers where id=$1", [cid]))[0].archived,
            true,
          );
          const ids = await Promise.all(
            Array.from({ length: 12 }, () =>
              call("save_customer", [null, {}, 0]),
            ),
          );
          const numbers = (
            await q("select number from customers where id=any($1::uuid[])", [
              ids,
            ])
          )
            .map((x) => Number(x.number.split("-").at(-1)))
            .sort((a, b) => a - b);
          assert.equal(new Set(numbers).size, 12);
          assert.equal(numbers.at(-1) - numbers[0], 11);
          const blank = await call("save_customer", [null, {}, 0]);
          const n = (
            await q("select number from customers where id=$1", [blank])
          )[0].number;
          await call("remove_customer", [blank, n, false]);
          assert.equal(
            (await q("select * from customers where id=$1", [blank])).length,
            0,
          );
        }),
    );
    await t.test("NSW deposit guard and buyer identity at $1,000", () =>
      role(owner, async () => {
        const c = await call("save_customer", [null, {}, 0]),
          j = await call("save_job", [null, c, {}, "New Lead", 0]);
        let id = await call("save_document", [
          null,
          "quote",
          j,
          null,
          { ...b, deposit_cents: 5000 },
          0,
        ]);
        await assert.rejects(call("issue_document", [id, 1]), /10%/);
        id = await call("save_document", [
          null,
          "invoice",
          j,
          null,
          {
            ...b,
            items: [
              {
                category: "labour",
                description: "TEST ONLY",
                quantity: "1",
                rate_cents: 100000,
              },
            ],
            deposit_cents: 0,
          },
          0,
        ]);
        await assert.rejects(call("issue_document", [id, 1]), /Buyer identity/);
      }),
    );
    await t.test(
      "Server and client money engines match across pricing modes",
      async () => {
        const { calculate } = await import("./classic.mjs");
        for (const type of ["hourly", "fixed", "cost-plus"])
          for (const tax of ["taxable", "gst-free"])
            for (const mode of ["inclusive", "exclusive"])
              for (const fee of ["percentage", "fixed"]) {
                const input = {
                  ...b,
                  quote_type: type,
                  tax,
                  price_mode: mode,
                  fee_method: fee,
                  fee_cents: 1234,
                  markup_percent: "12.3456",
                  fixed_cents: type === "fixed" ? 50001 : null,
                  discount_cents: 123,
                  deposit_cents: 0,
                };
                const server = await call("calculate_document", [input]);
                assert.deepEqual(server, calculate(input));
              }
      },
    );
    await t.test(
      "Cross-organisation customer/job references and private asset isolation",
      async () => {
        const otherOrg = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        await db.exec(
          `insert into organisations(id,name) values('${otherOrg}','TEST ONLY OTHER WORKSPACE');insert into organisation_members(organisation_id,user_id,role) values('${otherOrg}','${outsider}','owner');grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;`,
        );
        let otherCustomer, otherJob;
        await role(outsider, async () => {
          otherCustomer = await call("save_customer", [
            null,
            { name: "TEST ONLY OTHER TENANT" },
            0,
          ]);
          otherJob = await call("save_job", [
            null,
            otherCustomer,
            {},
            "New Lead",
            0,
          ]);
          await db.query(
            "insert into storage.objects(bucket_id,name) values($1,$2)",
            ["business-assets", otherOrg + "/private-signature.png"],
          );
        });
        await role(owner, async () => {
          assert.equal(
            (await q("select * from customers where id=$1", [otherCustomer]))
              .length,
            0,
          );
          await assert.rejects(
            call("save_job", [null, otherCustomer, {}, "New Lead", 0]),
            /active customer/,
          );
          await assert.rejects(
            call("save_document", [null, "invoice", otherJob, null, b, 0]),
            /workspace/,
          );
          assert.equal((await q("select * from storage.objects")).length, 0);
          await assert.rejects(
            db.query(
              "insert into storage.objects(bucket_id,name) values($1,$2)",
              ["business-assets", otherOrg + "/intruder.png"],
            ),
            /row-level security/,
          );
          await db.query(
            "insert into storage.objects(bucket_id,name) values($1,$2)",
            ["business-assets", org + "/approved-signature.png"],
          );
          assert.equal((await q("select * from storage.objects")).length, 1);
          await assert.rejects(
            db.exec("delete from storage.objects"),
            /permission denied/,
          );
        });
        await role(employee, async () => {
          assert.equal((await q("select * from storage.objects")).length, 1);
          await assert.rejects(
            db.query(
              "insert into storage.objects(bucket_id,name) values($1,$2)",
              ["business-assets", org + "/employee-upload.png"],
            ),
            /row-level security/,
          );
        });
      },
    );
    await t.test(
      "Malformed cost data is rejected at database boundary",
      async () => {
        await assert.rejects(
          call("calculate_document", [{ ...b, items: null }]),
          /cost rows/,
        );
        await assert.rejects(
          call("calculate_document", [{ ...b, discount_cents: 999999999 }]),
          /Discount/,
        );
        await assert.rejects(
          call("calculate_document", [
            {
              ...b,
              items: [{ category: "labour", quantity: "-1", rate_cents: 5000 }],
            },
          ]),
          /Quantity/,
        );
        await assert.rejects(
          call("calculate_document", [
            {
              ...b,
              items: [{ category: "labour", quantity: "1", rate_cents: -5000 }],
            },
          ]),
          /price/,
        );
      },
    );
    await t.test(
      "Booking confirmation optionally updates the job atomically and invoices use KC-INV",
      () =>
        role(owner, async () => {
          const c = await call("save_customer", [
            null,
            { name: "TEST ONLY booking customer" },
            0,
          ]);
          for (const updateJob of [false, true]) {
            const j = await call("save_job", [null, c, {}, "New Lead", 0]);
            const booking = await call("save_document", [
              null,
              "booking",
              j,
              null,
              b,
              0,
            ]);
            await call("confirm_booking", [booking, 1, updateJob]);
            const saved = (await q("select * from jobs where id=$1", [j]))[0];
            assert.equal(
              saved.status,
              updateJob ? "Booking Confirmed" : "New Lead",
            );
            assert.equal(
              (
                await q("select status from documents where id=$1", [booking])
              )[0].status,
              "issued",
            );
          }
          assert.match(
            (await q("select number from documents where id=$1", [iid]))[0]
              .number,
            /^KC-INV-/,
          );
        }),
    );
    await db.close();
  },
);
