# Krishna's Construction business management portal

A private carpentry business application with a plain HTML/CSS/vanilla JavaScript frontend and Supabase Auth/PostgreSQL/private Storage. It includes customers, multiple jobs per customer, fixed/hourly/cost-plus quotes, booking confirmations, invoices, deposits/final receipts, payment reminders and branded A4 PDFs.

**No framework, npm installation or frontend build is required.** The database starts empty. No live Supabase project, authorised accounts, GitHub repository or production deployment has been created. Database writes are real Supabase operations when configured; preview mode never pretends to save.

## Preview immediately

Open `index.html` by double-clicking it. Select **Explore interface preview**. All screens and local sample PDFs are available without a server or build step. Keep the `js`, `css` and `assets` folders beside the HTML files.

Direct-file preview deliberately cannot authenticate or access private records, even if connection values have been entered. It uses no customer database or browser-storage substitute. Sample PDFs are clearly labelled SAMPLE / NOT FOR ISSUE. The official logo is embedded locally for PDF generation, so preview does not need a blocked file fetch or internet connection. Optional Google Fonts load only on HTTP/HTTPS; readable local font fallbacks work offline.

For secure connected use during development, double-click `Preview Portal.cmd`. It opens `http://127.0.0.1:4173` after the server is ready. Keep its terminal open; stop with Ctrl+C. It uses an available Node.js runtime, including this computer's bundled Codex runtime. This optional local server is not a build tool. Alternatively run:

```powershell
node scripts/serve.mjs
```

Use an HTTP/HTTPS address for connected features. Production is static GitHub Pages with HTTPS; no permanently running computer is needed.

## Set up the secure backend

Supabase handles passwords and stores private records separately from the public frontend. The account owner must complete these steps; do not share passwords or secret keys in chat or commit them.

1. Create a free account/project at [Supabase](https://supabase.com/). Select a Sydney region if available. Store its database password securely.
2. In the project's SQL Editor, run the complete migration files **once, in order**:
   - `supabase/migrations/001_workspace.sql`
   - `supabase/migrations/002_operations.sql`
   - `supabase/migrations/003_assets.sql`
   - `supabase/migrations/004_booking_confirmation.sql`
   - `supabase/migrations/005_invoice_prefix.sql`
3. Each migration is transactional. Resolve any error before continuing. For a project already using 001–003 from the earlier local build, apply only the new 004 and 005. Do not rerun existing schema migrations on live data.
4. Under Authentication, disable public signup and anonymous sign-in. Use administrator-provisioned email/password accounts. The app has no signup flow.
5. Set Auth Site URL to the eventual Pages URL. Allow the exact recovery URLs `https://YOUR-USERNAME.github.io/krishnas-construction-portal/index.html` and, during local development, `http://127.0.0.1:4173/index.html`.
6. Create Eric's account using his approved email, and your administrator account using your own email. Owners enter/manage their own strong unique passwords. Configure at least a 12-character password policy.
7. Copy those two Auth user UUIDs. Run this provisioning block **once** in SQL Editor, replacing the two UUID placeholders. It creates no customer/job records:

```sql
do $$
declare org uuid;
begin
  insert into public.organisations(name)
  values ('Krishna''s Construction') returning id into org;
  insert into public.organisation_members(organisation_id,user_id,role)
  values
    (org, 'ERIC_AUTH_USER_UUID'::uuid, 'owner'),
    (org, 'ADMIN_AUTH_USER_UUID'::uuid, 'administrator');
end $$;
```

Keep filled provisioning SQL private. Future employees can be added by the project owner with role `employee`. Browser users cannot grant themselves roles. Employees cannot change bank settings or artwork approvals.

8. Copy `js/config.example.js` to `js/config.js` (a blank local file is already supplied). Enter only your project URL and **public publishable** key from project API settings:

```js
window.KC_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  publishableKey: "YOUR-PUBLIC-PUBLISHABLE-KEY",
};
```

A legacy public `anon` key is also supported. Never enter a service-role key, `sb_secret_…`, database password, admin token or SMTP password. `js/config.js` is ignored by Git. Public URL/key values can safely be included in the published site only because all private access is authenticated and membership/RLS protected.

9. Start the HTTP preview, log in and complete Settings. The business/correspondence address supplied in chat is retained in ignored `private/CONFIGURATION_NOTES.md` for private entry. Bank details from reference invoices were not imported. Review business identity, ABN, GST registration and payment instructions.
10. Review/edit proposed quotation terms, validity period and invoice due period. Approve identity and terms before issuing. Upload a genuine signature only if wanted; approve the logo-based company mark before using it on customer documents.
11. Test recovery emails and exact redirects. Supabase's default email sender has recipient/rate restrictions; configure approved SMTP if needed. This is password recovery only, not automated customer email sending.

Authentication sessions are kept in memory, not localStorage. Refreshing generally requires signing in again. Saved records/drafts live in Supabase and remain available across authorised devices after sign-in.

## What to do in the portal

1. **Manage Customers:** add any known contact/company/address details; every descriptive field is optional. Blank records receive a unique server ID. Search by name, phone, email, customer ID or linked quote number. Open a customer to see linked jobs and documents.
2. **Jobs:** create multiple jobs under a customer. Set site, work description, dates and an independent status. A quote or booking is never required before invoicing.
3. **Generate Quotation:** choose customer/job and fixed, hourly or cost-plus pricing. Add, reorder, duplicate or paste scope items. Enter labour worker-hours, materials/units, other costs, discounts, tax treatment and a manually chosen deposit. Cost-plus supports percentage or fixed fees and estimated/actual labels. Fixed quotes can have an overall price plus a disclosed adjustment to the item breakdown.
4. **Save Draft:** drafts save to the database. Once a job is selected, edits also autosave with visible success/failure status. Navigation attempts to preserve unsaved work. No sensitive drafts are written to browser storage.
5. **Preview / issue:** draft PDFs are samples. Issuing checks approved settings, tax basis, mandatory invoice details and relevant deposit rules, then saves a snapshot. Quotes can be marked sent/accepted and duplicated under new numbers.
6. **Booking Confirmation:** create directly or from a quote. Enter optional dates, booked-by and special instructions. Requested and actually received deposits are separate. **Record actual deposit** opens a receipt form with amount/date/method/reference. When issuing, choose whether to mark the job Booking Confirmed; both changes commit together. Quote acceptance does not create a booking.
7. **Generate Invoice:** create directly or copy a quotation/booking. Review imported costs, changes and variations before issuing. Issuing allocates an unallocated job deposit once, to that invoice only. Later invoices cannot reuse it.
8. **Payments:** record one initial job deposit and one final receipt per applicable invoice, with actual dates/methods. Partial final receipts leave an outstanding balance. Paid state and PAID artwork are derived, never toggled manually. Overpayments are explicitly rejected for review.
9. **Payment Reminders:** see invoices due in the next seven days, today or overdue. Paid, void and draft invoices are excluded. Nothing is emailed automatically.
10. **PDFs:** preview/download sharp A4 quotation, booking, invoice and adjustment-note PDFs, then send manually. A short quotation has one scope/pricing page and a separate terms/validity/deposit/acceptance page. Longer content adds pages automatically. Quotation exclusions and assumptions appear with the terms.

Issued invoices/bookings are locked. Use void/correct and duplicate/reissue under a new number if no receipts or credits exist. Administrators can issue a separately numbered credit adjustment against an unpaid balance and download its adjustment note. Recorded receipts cannot be silently deleted/edited; refunds, receipt mistakes or extra instalments beyond the one-deposit/one-final model need administrator/accountant handling with retained records.

Customer deletion shows linked counts and requires acknowledgement plus typing the customer ID. A customer with linked jobs is archived, not cascade-deleted. Issued financial records are retained.

## Branding, signature and stamp

The official charcoal/gold/peach logo is in `assets/logo/krishnas-construction.png`. Its embedded copy in `logo-data.js` contains the same public image for direct-file PDF support. Change future business artwork through Settings so issued snapshots keep their original asset references.

PNG/JPEG uploads are limited to 2 MB and stored in a private organisation-scoped bucket. Signature/stamp assets are immutable UUID paths: replacing settings does not rewrite previously issued documents. No public signature URL is created. The company mark uses the official logo, a charcoal/gold rectangular frame and ABN; it is not a certification. The development signature is labelled SAMPLE SIGNATURE, never imitated handwriting.

## New GitHub repository and deployment

Nothing is published automatically. Create a new empty repository named `krishnas-construction-portal` in your intended GitHub account. The supplied connected GitHub tools cannot create repositories, so this owner step remains manual. Public source is compatible with free GitHub Pages; private-repository Pages availability depends on the account plan.

Review source before uploading. Never publish reference workbooks/PDFs, source invoice screenshots, private notes, signatures, real customer records, JSON backups or filled provisioning SQL. `.gitignore` excludes `private/`, `tmp/`, `dist/`, connection configuration, spreadsheets, PDFs and environment files. Public business identity and the supplied business logo are intentional frontend defaults; the street address and bank details are private settings.

For a developer using Git after the empty repository exists:

```powershell
git add .
git commit -m "Build private Krishna's Construction business portal"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/krishnas-construction-portal.git
git push -u origin main
```

Inspect any existing `origin` before replacing it. Complete GitHub authentication yourself; never embed a token in the remote URL.

1. Repository Settings → Pages → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables**: add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. These values become public browser configuration. Never enter a secret/service-role key.
3. After deployment approval, run **Publish approved portal** from Actions. It is manually triggered only, never triggered by a normal push.
4. The workflow copies the already runnable static files into a publication folder. Node is used only for safe packaging/configuration; there is no npm install, framework compilation or frontend build.
5. Confirm the Pages URL, update the Supabase Auth URL/redirect settings and run the live acceptance checklist. Relative asset paths support a repository subdirectory.

Optional developer export: `node scripts/prepare-pages.mjs` replaces the generated `dist/` folder with only HTML, browser scripts/styles and public assets. It refuses known secret/privileged keys. Do not serve the entire workspace directory as a public site.

## File layout and editing

```text
index.html, dashboard.html            Login gate and dashboard entry
customers.html, customer.html         Customer list and profile entry
jobs.html, job.html                   Job list and details entry
quotations.html, quote-editor.html    Quotation list/editor entry
bookings.html, booking-editor.html    Booking list/editor entry
invoices.html, invoice-editor.html    Invoice list/editor entry
reminders.html, settings.html        Reminder/settings entry
css/style.css                        Responsive theme and CSS variables
js/main.js                           Shared screen rendering/form interactions
js/auth.js                           Login/logout/recovery and memory sessions
js/database.js                       Authenticated database reads and RPC calls
js/customers.js, js/jobs.js           Customer search/save and job rules
js/quotes.js                         Draft/copy/scope and pricing save preflight
js/bookings.js                       Actual deposits and atomic confirmation
js/invoices.js                       Receipt linkage, balances and recording
js/calculations.js                   Decimal quantities and exact cents
js/pdf.js                            A4 templates, pagination and artwork
js/ui.js, js/startup.js               Safe components, dialogs and startup errors
js/config.example.js                 Non-secret connection example
assets/logo/, assets/placeholders/   Official logo and development guidance
supabase/migrations/                 Tables, RLS, operations and numbering
scripts/, tests/, docs/              Optional preview/export, tests and guides
```

All HTML entries use the same ordered classic scripts. Edit shared UI behaviour in `main.js`; edit business rules in the named feature files; edit colours/spacing in `css/style.css`. Each HTML `data-page` selects its entry screen after login/preview. Customer/job detail entries ask you to select a record if none is selected; private record details are never encoded in navigation URLs.

## Numbers and calculations

Separate database counters produce `KC-C`, `KC-J`, `KC-Q`, `KC-B`, `KC-INV` and `KC-CN` identifiers. A securely random UUID supplies only the initial starting point; subsequent values increment atomically. Voided numbers are retained and never recycled. Migration 005 preserves the invoice counter while changing its visible prefix to KC-INV.

To choose an initial number, the project owner may seed a counter before creating any records of that kind:

```sql
insert into public.document_sequences(organisation_id,kind,last_value)
values ('YOUR_ORGANISATION_UUID'::uuid,'Q',48270);
```

This makes the next quote number 48271. Counter kinds are C/J/Q/B/I/CN; I displays as INV. Never lower/reset an existing counter. This operation is intentionally unavailable to browser users.

Amounts use integer cents and decimal quantities with half-up rounding. The server recalculates every saved total from inputs; frontend totals are not trusted. Taxable exclusive prices add 10% GST; inclusive prices extract one eleventh. Nonstandard tax treatment needs an approved reason. Buyer identity/ABN is required when legally necessary, including invoices of $1,000 or more. See `docs/ACCOUNTING_REVIEW.md` for NSW deposit/contract and retention considerations.

## Tests and verification limits

Final verification results are in `docs/TEST_RESULTS.md`. A developer with Node can run:

```powershell
node --test tests/*.test.mjs
```

No npm command is needed to preview or use the application. Optional development test runtimes PGlite and Happy DOM were used in this workspace to exercise actual SQL migrations/roles and DOM handlers. They are not part of the frontend. Tests explicitly skip those suites if the optional runtimes are absent; skipped tests are not passed tests. Native calculation and PDF tests remain available without those runtimes.

Live Auth email delivery, actual Supabase network policies and real simultaneous multi-device use still require account-owner setup and the acceptance checklist. Browser measurements cover empty list/profile-entry states and editor screens, not a claim that every populated record state was tested on Eric's physical phone. Standard PDF fonts currently support WinAnsi text; non-Latin scripts need reviewed font support before customer issue.

## Backups and free-tier limits

Settings → Export records downloads an authenticated private JSON copy. Store it encrypted outside GitHub. Private artwork must be backed up separately. Use an authorised PostgreSQL/Supabase database export for complete audit/sequence/schema recovery and rehearse restores in a separate project. This version has no bulk JSON restore/import UI.

Free-plan limits checked 25 October 2026: 500 MB database, 1 GB file storage, 5 GB egress and 50,000 monthly active users; free projects may pause after one inactive week, with two active projects allowed. Review [current Supabase pricing](https://supabase.com/pricing) before relying on those limits. Managed daily backups are a paid feature, so agree on a manual backup routine. No promise of permanently unlimited free service is made.

The app uses the pinned Supabase JS SDK for connected access and a local MIT-licensed PDF-Lib copy. No paid AI service, automated customer email integration, Google Drive upload, financial analytics dashboard, scheduling calendar or e-commerce system is included.
