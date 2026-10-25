# User workflows

Customer → many jobs → optional quotations/bookings → independent invoice snapshots. Eric can skip stages. Dashboard provides quick actions for customers, quotes, bookings and invoices. No financial analytics or scheduling calendar is included.

Customer search matches name, phone, email, company, customer ID and linked quote numbers. A blank customer is displayed by ID. Customer and job profiles link to their related documents and payments. Duplicate customer names are safe because relationships use UUIDs, not names.

Document editors use four steps: customer/job; editable scope; costs/GST; review/terms. Scope items can be added, moved, duplicated, removed or split from pasted lines. Cost rows can be added, duplicated and removed. Labour uses total worker-hours; material units remain editable. Costs recalculate instantly. New fixed prices may use the row sum or an explicit overall amount, with a disclosed fixed-price adjustment. Cost-plus supports percentage/fixed fees and estimated/actual labels.

Save Draft persists to Supabase. Autosave waits until a job is selected and reports failures. Switching views tries to save; closing a dirty live draft triggers the browser's leave warning. Preview drafts are ephemeral, with explicit discard confirmation. Issuing always requires a review confirmation and server approval validation. Downloads remain manual.

Quote **Create booking/invoice** reuses the full scope and charge inputs. Duplicate produces a new number on save. Booking confirmation does not automatically follow acceptance. To mark a job scheduled/completed/paid, edit Job details; statuses are independent so unusual job workflows remain possible. Document payment status remains derived even if an operator chooses an independent job status.

Unallocated job deposit is applied to the first eligible issued invoice, once. All later invoice balances remain independent. Record each actual receipt with date/method/reference. This version supports one initial deposit and one final receipt per invoice, including a partial final receipt; it does not implement instalment/refund bookkeeping or editing/deleting recorded receipts. Corrections require project-admin/accountant review that preserves the record trail.

Reminders show due soon (within seven days), due today and overdue. Fully settled, draft and void invoices are excluded. Customer deletion previews the linked-record counts, then requires acknowledgement plus exact ID. Linked customers are archived and kept searchable; they are excluded from new customer selectors.

Booking review includes an actual-deposit receipt action with date/method/reference. At issue, the operator may explicitly choose to update the job to Booking Confirmed; migration 004 performs both changes atomically.
