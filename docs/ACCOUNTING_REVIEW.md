# Accounting and NSW review

Sources checked 25 October 2026. Obtain Eric's/accountant's review before live issue; no claim is made that sample removals documents are compliant templates.

- Taxable supplies use 10% GST. Exclusive entry adds GST to net charges; inclusive entry extracts one eleventh. Discount is applied before GST. Per-row cents are rounded half-up, and GST is rounded at document total. Nonstandard GST requires a recorded approved reason. Mixed tax rates within a single document are outside this version; use reviewed separate documents as appropriate.
- ABN remains visible when GST is zero. TAX INVOICE is used for the configured GST-registered business's taxable documents; GST-free/other documents use INVOICE. Buyer identity/company or ABN is required at issue for totals of $1,000 or more. Scope/cost descriptions and issue date are mandatory for real issue. Empty customer fields remain permissible in the CRM.
- Deposits requested are not receipt records. Payments reduce receivables, not the invoice's GST basis. Handling security deposits, special GST timing or instalment invoices requires accountant direction; the application does not file BAS or recognise revenue.
- Credit adjustments reduce only the unpaid balance, record a reason and compute the corresponding GST component for a uniform taxable supply. No credit can create a negative receivable. Refunds and mixed-treatment adjustments require accountant handling. A paid stamp requires actual receipts, not only a credit write-off.
- NSW residential building work may require a written contract above $5,000 and a fuller contract above $20,000. A quotation/booking PDF does not replace the required contract. The app asks for contract context and blocks a requested deposit over 10% where the NSW residential context is selected. Eric must check applicability and any exemptions, plus licence/insurance obligations, for the actual work. Nothing in the application asserts verified insurance or licensing.
- Retain most business/tax records for at least five years, with any longer applicable retention considered. The UI does not permanently delete customer records with linked jobs or financial history. Archiving is operational, not a statutory erasure process.

Primary sources:

- [ATO legislation reference: tax invoice particulars and buyer identity threshold](https://www.ato.gov.au/law/view/document?LocID=%22PAC%2F19990055%2F29-70%282%29%22)
- [Australian Government: how to invoice, mandatory details and retention](https://business.gov.au/finance/payments-and-invoicing/how-to-invoice)
- [NSW Government: residential building contracts and deposits](https://www.nsw.gov.au/housing-and-construction/building-or-renovating-a-home/preparing/contracts)
- [SIRA: home building compensation requirements for builders/tradies](https://www.sira.nsw.gov.au/home-building-compensation/home-building-compensation-for-builders-and-tradies)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Supabase: current pricing and free-plan limits](https://supabase.com/pricing)
