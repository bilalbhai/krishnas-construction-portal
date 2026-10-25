// Test the same no-build browser scripts, without introducing an app dependency.
import "../js/calculations.js";
import "../js/auth.js";
import "../js/database.js";
import "../js/ui.js";
import "../js/customers.js";
import "../js/jobs.js";
import "../js/quotes.js";
import "../js/bookings.js";
import "../js/invoices.js";
import "../assets/logo/logo-data.js";
import "../js/pdf.js";
export const { calculate, cents, balance, paymentStatus, reminder, localDate } =
  globalThis.KC.calculations;
export const { connect } = globalThis.KC.auth;
export const { makePDF } = globalThis.KC.pdf;
export const { toast } = globalThis.KC.ui;
