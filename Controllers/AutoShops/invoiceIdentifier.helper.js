
import InvoiceCounter from "../../Schema/Invoicecounter.schema.js";
import { getInvoicePrefixForYear } from "../../Schema/invoiceprefix.schema.js";

/**
 * generateInvoiceId
 * Returns the current sequence number for this business (or creates it as 1 if not present),
 * then increments the stored sequence number, so the next generated ID will be one higher.
 * The returned invoiceId is always based on the sequence ID about to be saved.
 *
 * Example: saved seq is 22.
 *   - This function returns ...-22.
 *   - It then increments and saves seq: 23.
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

  // Attempt to find the counter doc, or create with seq=1 if not found
  let counterDoc = await InvoiceCounter.findOne({ business: businessId });

  let currentSeq;
  if (!counterDoc) {
    // If doesn't exist, create as seq=1 (first invoice is ...-1)
    counterDoc = await InvoiceCounter.create({
      business: businessId,
      seq: 1,
    });
    currentSeq = 1;
  } else {
    // Already exists: get saved value, will increment after
    currentSeq = counterDoc.seq;
  }

  const invoiceId = `${prefixDoc.prefix}-${currentSeq}`;

  // Now increment stored sequence for next call
  await InvoiceCounter.updateOne(
    { business: businessId },
    { $inc: { seq: 1 } }
  );

  return invoiceId;
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