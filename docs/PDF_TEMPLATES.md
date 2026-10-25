# PDF templates

PDF-Lib generates selectable vector text and rules on exact A4 pages (595.28 × 841.89 points). The official raster logo stays sharp at document size. No HTML screenshot is used. Each page repeats business/document identity, page numbers and a footer.

Quotation: supplier identity/ABN, customer, site/job, editable scope, labour/material/additional/variation breakdown, fee/fixed adjustment/discount, GST/net/total, requested deposit and balance, expiry, terms and optional customer acceptance. Cost-plus identifies estimated vs actual amounts and the fee method. Long quotes paginate; terms move to a separate page where needed.

Booking: same customer/job/scope context plus agreed/estimated price, requested deposit, actual receipt details, scheduled dates, booked-by and instructions. It does not infer a payment from the requested amount.

Invoice: issued date/due date, saved customer/business identity, final independently editable charges, GST, total, credits, deposit/final receipts and amount due. A paid mark appears only on an issued, non-void invoice fully settled by receipts and with some payment actually received. A zero-value or credit-only settlement does not masquerade as a cash receipt. Paid date is the latest actual receipt date.

Credit adjustment: numbered adjustment note referencing the original invoice, supplier/customer identity, reason, GST adjustment and credit amount. It is downloaded separately and retained with the original invoice.

Draft/interface-preview PDFs always show SAMPLE / NOT FOR ISSUE. A requested development signature without a real asset is labelled SAMPLE SIGNATURE, never imitated handwriting. Artwork on issued documents requires database-side approval checks. The supplied logo forms the company mark, separate from the PAID stamp.

In-app PDF preview uses a blob iframe and a download button. Some mobile PDF viewers do not display embedded frames; downloading still uses the browser's native PDF/file facilities. Physical-device download/sharing must be acceptance-tested with Eric. No email is automatically sent. Standard PDF fonts currently replace unsupported non-Latin characters with `?`; review such names/scopes before issue.

Current quotation templates always begin validity/deposit/terms/acceptance on a separate page. Short quotes produce two pages; longer scopes add pages as needed. Exclusions and assumptions accompany the terms. The embedded official logo supports sample PDFs in direct-file previews without a file fetch.
