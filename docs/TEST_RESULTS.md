# Verification results — current delivery

Verified on 25 October 2026. All database fixtures and generated documents use explicit TEST ONLY values. No customer email was sent, no real customer document was issued, and no live Supabase or GitHub deployment was created.

## Automated tests

Command: `node --test tests/*.test.mjs`

**44 passed, 0 failed, 0 skipped.** The complete run took about 4.6 seconds. PDF tests were run again after the final page-spacing and PAID-mark refinements and passed. Application scripts also pass Node syntax checks. Optional test-only runtimes: PGlite 0.5.11 (PostgreSQL/WASM) and Happy DOM 20.0.8; neither ships to browsers and there is no npm requirement for the application.

| Area                       | Verified behaviour                                                                                                                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calculation engine         | Decimal labour/material quantities, separate subtotals, fixed overall adjustment, percentage/fixed cost-plus fees, inclusive/exclusive GST, discounts, requested deposits, balances and half-up rounding                                                                                  |
| Invalid financial data     | Negative/malformed quantities and prices, excess discounts/deposits, overpayments and invalid receipt types are rejected                                                                                                                                                                  |
| Real PostgreSQL operations | Applied migrations 001–005 to an isolated in-memory PostgreSQL database; created optional/blank customers, duplicate names, multiple jobs, quotes, bookings, invoices and receipt/credit records                                                                                          |
| Access controls            | Anonymous reads/RPCs denied; nonmembers denied; direct table mutation and role escalation denied; employee financial-settings changes denied; cross-organisation references rejected                                                                                                      |
| Private assets             | Same-organisation read access, owner/admin insert policy, employee insert denial, other-organisation isolation, no browser deletion                                                                                                                                                       |
| Financial history          | Frontend totals ignored in favour of server recalculation; invoice and settings snapshots remain independent of edited quotes/settings; issued invoices/bookings locked; deposits allocated only once; duplicate receipts blocked; financial void restrictions and credit settlement work |
| Booking confirmation       | Optional job status update commits with issue; leaving the checkbox unselected preserves the job's existing status; invoices use KC-INV                                                                                                                                                   |
| Numbering/deletion         | Twelve queued calls receive unique sequential numbers; stale revisions rejected; impact counts accurate; linked customers archived; customer without linked jobs can be permanently deleted after confirmation                                                                            |
| Australian document checks | Buyer identity/ABN required at $1,000; NSW residential requested-deposit guard; server/client calculations match across 24 pricing/tax/entry/fee combinations                                                                                                                             |
| Direct-file interface      | Executed the actual ordered classic scripts for all 14 HTML entries using isolated file-URL DOM environments. Every entry renders login/preview; no module loader is required. Even configured connection values cannot enable Auth/database access from file previews                    |
| Feature modules            | Search by contact/customer ID/linked quote number without merging duplicate names; draft duplication preserves independent fixed/hourly/cost-plus inputs; actual receipts and credits are linked to the correct invoice                                                                   |
| Actual form handlers       | Preview entry, scope duplication, live costs, clear refusal to save without a connection, in-page discard confirmation, Settings handler, optional customer form and navigation                                                                                                           |
| Configuration/startup      | Secret/privileged keys and invalid backend URL rejected before networking; file bootstrap starts locally; missing scripts produce an actionable error rather than an endless spinner                                                                                                      |
| PDF generation             | Exact A4 media boxes; short quotation has two pages; long scope paginates; booking/paid/unpaid variants; genuine browser PDF download; labels and totals preserved                                                                                                                        |

## Live browser checks

Using the local HTTP preview, opened all 14 entry pages, entered explicit interface preview, and measured each at **375, 768 and 1440 px**. The actual reported viewport was checked against the requested width. **42 measurements, no horizontal overflow.** Customer/job detail entry pages correctly request record selection when no record is selected; these checks cover their empty entry states, not fabricated populated profiles.

Filled a mobile quotation with a manually entered TEST ONLY scope and labour row. Eight hours at $50 gave $400 labour plus $40 GST. Switching to 15% cost-plus produced $460 net, $46 GST and **$506 total**. Editor controls and sticky actions were visually inspected at 375 px.

Previewed and actually downloaded a branded PDF through the browser to `Downloads/DRAFT-SAMPLE.pdf`, then copied it into ignored `tmp/pdfs/browser-downloaded-SAMPLE.pdf` for inspection. It has two A4 pages, the $506 total and SAMPLE / NOT FOR ISSUE labels. No backend write or real customer issue was simulated.

The browser automation tool permits HTTP/HTTPS navigation only; it refused file-URL navigation. Direct-file functionality was therefore checked with the real source scripts in isolated DOM tests, rather than claimed as a successful physical-browser file test. The server-hosted browser interface and PDF download were tested directly.

## PDF visual QA

Rendered every page of the five generated synthetic variants and the browser download with PDFium, then inspected page images. Text was extracted with pypdf for independent checks:

- Short quotation: 2 pages, scope/pricing followed by validity/deposit/terms/acceptance.
- Long quotation: 4 pages for 55 detailed work items, with additional pages added automatically.
- Booking: 2 pages in the long-terms fixture.
- Paid invoice: 2 pages, receipt-backed PAID mark present beside the financial summary and zero balance.
- Unpaid invoice: 2 pages, actual balance shown and no PAID mark.
- Browser-downloaded sample: 2 pages, correct sample labels and total.

Refined category/header spacing so headings are not covered by table backgrounds, kept group headings with the first row and wrapped long quantity/unit cells. The placeholder signature is visibly labelled, never represented as Eric's handwriting. Current rendered working files are under ignored `tmp/current-pdf-qa/`; they are not part of the public deployment.

## Publication/source checks

The static export copies only named HTML entries and browser assets into `dist/`. No source workbook, reference invoice, private street address, bank record, signature or private notes are included. No actual Supabase key, password or service credential is present in the delivered source. The frontend has no package manifest, framework install or compilation step. The GitHub Actions workflow is manually triggered only and does not run npm.

## Still needs real-project acceptance

- Owner-created Supabase project, Eric/admin accounts, membership provisioning and public connection values.
- Real Auth login/logout and recovery email delivery, rate limits and exact redirect behaviour.
- Actual managed Supabase REST/Storage service behaviour, including file MIME/size enforcement, beyond the tested SQL authorisation policies.
- Independent simultaneous network clients. PGlite queues calls on one connection; it does not reproduce distributed load.
- Real network failure/autosave/reload and multi-device persistence after configuration.
- GitHub repository creation and approved Pages deployment, followed by hosted Auth redirect checks.
- Eric's physical phone/tablet PDF sharing and genuine signature upload/approval.
- Approved bank details, business terms, company artwork and accounting/NSW contract review.
- Full non-Latin font support, refunds/additional instalments, bulk restore and an agreed tested backup routine.

Local test success is evidence for the implementation, not a claim that unconfigured external accounts are connected. Complete `CLIENT_APPROVAL_CHECKLIST.md` before live use.
