import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * One doc per business. `seq` is the last invoice number issued for that
 * business — incremented atomically so concurrent invoice creation
 * never collides, even under load.
 */
const invoiceCounterSchema = new Schema({
  business: { type: Types.ObjectId, ref: "BusinessProfile", required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const InvoiceCounter =
  mongoose.models.InvoiceCounter || mongoose.model("InvoiceCounter", invoiceCounterSchema);

export default InvoiceCounter;

/**
 * Atomically increments and returns the next invoice number for a business.
 * Safe under concurrent requests (findOneAndUpdate is atomic at the DB level).
 */
export async function getNextInvoiceNo(businessId) {
  const counter = await InvoiceCounter.findOneAndUpdate(
    { business: businessId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

/**
 * Read-only peek at what the NEXT invoice number will be, without incrementing.
 * Used to preview before actual invoice creation.
 */
export async function peekNextInvoiceNo(businessId) {
  const counter = await InvoiceCounter.findOne({ business: businessId });
  return (counter?.seq || 0) + 1;
}