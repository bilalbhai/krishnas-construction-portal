# Reference files analysis

Reviewed 25 October 2026. The workbook and source PDFs belong to a removals business. No source customers, private addresses, bank accounts or invoice records were imported. Extracted working files are in ignored `tmp/`; they must never be committed.

## Workbook: Leads Database.xlsx

Every nonempty cell, formula and cached value was extracted using the OOXML ZIP/XML format. All five sheets were inspected. Counts below include populated cells/formula cells, not customers.

| Sheet                | Cells reviewed | Useful fields and behaviour                                                                                                                            | Carpentry replacement                                                                                                                                              |
| -------------------- | -------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Leads Database       |            625 | Quote number, customer name, phone, email, rate, follow-up status, notes; date values include both strings and Excel serials                           | Separate customer IDs, customer master contact fields, jobs with status and site; quote rates live on quote rows                                                   |
| Per hour quote       |             62 | Customer selection at J13; exact-match VLOOKUP for contacts and related job data; TODAY for quote date; blank fallback text                            | Authenticated customer/job selection and prefill; editable Sydney date; absent fields omitted rather than placeholder contact data                                 |
| Fixed Quote          |             61 | Same ID lookup; fixed rate; extra service description; scope/package list; booking and payment instructions                                            | Fixed overall amount with optional itemised costs, scope/exclusions/assumptions, configurable terms and requested deposit                                          |
| Booking Confirmation |             46 | Customer lookup, booking date, service date, time slot, deposit paid, payment mode, booked by                                                          | Distinct booking number; job dates, work description, requested vs received deposit, actual receipts and booked-by field                                           |
| Invoice              |             52 | Customer lookup, issue date, description, quantity/hours, hourly price, row totals, GST, subtotal, deposit, balance, bank instructions, signature area | Independent invoice snapshot, labour/material/variation rows, explicit GST treatment, due date, deposit allocation, final payment, credits and derived paid status |

### Reusable formula intent

- `VLOOKUP(..., FALSE)` reuses customer details by identifier. Replace wide-sheet lookups with foreign keys; preserve contacts once in the customer master.
- `TODAY()` supplies a document date. The app uses Australia/Sydney and freezes the date when the draft is saved/issued.
- Invoice I12 = G12 × E12 and I13 = E13 × G12 demonstrate quantity × unit rate. New calculation engines use decimal quantities and integer cents with half-up line rounding.
- I17 sums charges and GST; I19 subtracts the recorded deposit. New balances also account for the final receipt and credit notes, with overpayment rejection.
- Source I14/I15 use addition of fields rather than multiplication. Do not copy these as a universal line formula.
- Source I16 conditionally compares a GST label to numeric 10%; the example shows an “Included” label with zero GST. This is ambiguous and unsuitable as authoritative tax logic. New inclusive GST is extracted as one eleventh; exclusive GST is calculated at 10% for taxable supplies.

### Removed or replaced fields

Truck sizes, bedrooms, cubic metres, movers, moving call-out hours, pickup/drop-off routes, fuel levy, packing/wrapping packages, moving equipment perks and removals insurance statements are not copied. Replace with job site, carpentry scope, worker-hours, materials/units, equipment hire, subcontract costs, delivery, waste removal and variations where actually entered. Source cash discounts/card surcharges are not business defaults. The source fixed booking deposit is not imported.

## PDF references

- **Sample quote 1.pdf:** three pages (the third is blank), contact/ID/date and moving job details on page one; perks, booking process and payment instructions on page two. Reuse document hierarchy and customer linkage, not the branding, offers, insurance promises or pricing policies.
- **Sample Booking Confirmation.pdf:** one page; customer/ID/contact details, job description, scheduled service date/time, rate, deposit received, payment method and booked-by. New bookings preserve this useful confirmation role without moving-specific fields.
- **Sample Tax invoice Paid with stamo.pdf:** one page; supplier identity/ABN, billed-to details, line quantities/rates/amounts, deposit and amount due, payment instructions, signature/stamp. Its title/filename does not prove the displayed balance is settled. The new PAID mark is derived only from invoice receipts and outstanding balance.
- **WhatsApp invoice screenshot:** Krishna's Construction identity/logo, labour/material descriptions and quantities, issue/due dates, balance, contact and bank instructions. Its zero-tax presentation is not copied because GST registration was separately confirmed. The screenshot's bank account remains unapproved configuration. The screenshot is not used to imitate Eric's handwriting.

## Official logo and original text

The separately supplied 1440 × 1421 PNG is the official logo. Inspected directly and sampled for charcoal, gold and peach; copied into `assets/logo/krishnas-construction.png`. No new logo was invented.

The master prompt includes Eric's timber-repair scope example, the $2,295 labour/material amount and the $500 requested deposit for that particular job. No standalone original text quote was supplied. The embedded example is used only to guide the scope editor, never seeded as a real job or business-wide payment policy. The example does not establish a GST basis or quote expiry policy.

## Data ownership

Customer master: contact, company/ABN, billing address, default site, internal notes. Job: linked customer, title, description, site, dates, status and notes. Quote: pricing type, detailed scope/costs, GST, requested deposit, validity and terms. Booking: job/date arrangements and requested deposit, with received amount derived from receipts. Invoice: independent charge rows and issue snapshot, due date and tax basis. Payments: actual receipts and invoice allocation. Settings: approved identity, bank instructions and artwork. Issue snapshots protect prior documents when master details/settings change.

## Uncertainties and follow-up

No live Supabase/GitHub accounts, approved bank details, genuine signature, approved stamp or approved standard terms exist yet. Business address was supplied in chat and retained in ignored private notes for later settings entry. Quotation validity, invoice period and numbering starts remain configurable. Do not issue customer documents until account setup and client approvals are complete.
