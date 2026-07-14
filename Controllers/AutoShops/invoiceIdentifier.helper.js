
// ASSUMPTION: mirrors your existing JobCardCounter pattern (atomic $inc,
// scoped by business) — adjust the import path / field names if your
// actual InvoiceCounter schema differs. If this file doesn't exist yet,
// see the model stub at the bottom of this file's comment block.

import InvoiceCounter from "../../Schema/Invoicecounter.schema.js";
import { getInvoicePrefixForYear } from "../../Schema/invoiceprefix.schema.js";


/**
 * generateInvoiceId
 * Atomically reserves the next sequence number for this business (NOT
 * scoped by year — see the note in Invoiceprefix.schema.js about why),
 * and combines it with the business's prefix for the CURRENT calendar
 * year to produce e.g. "INV-137".
 *
 * Throws if no prefix has been set for the business for the current year
 * — callers (markStatus) should catch this and surface a clear 400/409,
 * since converting to invoice without a prefix configured is a setup
 * error, not a server error.
 */
export async function generateInvoiceId(businessId) {
  const prefixDoc = await getInvoicePrefixForYear(businessId);
  if (!prefixDoc) {
    const err = new Error(
      `No invoice prefix set for ${new Date().getFullYear()}. Set one via PUT /invoice-prefix before converting job cards to invoices.`
    );
    err.code = "INVOICE_PREFIX_NOT_SET";
    throw err;
  }

  // Atomic increment — safe under concurrent requests for the same business.
  const counterDoc = await InvoiceCounter.findOneAndUpdate(
    { business: businessId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return `${prefixDoc.prefix}-${counterDoc.seq}`;
}

/*
If InvoiceCounter.schema.js doesn't exist yet, here's the stub matching
your JobCardCounter pattern — drop this in at ../Schema/Invoicecounter.schema.js:

import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const invoiceCounterSchema = new Schema({
  business: { type: Types.ObjectId, ref: "BusinessProfile", required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.models.InvoiceCounter || mongoose.model("InvoiceCounter", invoiceCounterSchema);
*/