import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * One doc per (business, year). Lets each shop owner choose their own
 * invoiceId prefix for a given calendar year (e.g. "INV" for 2026), so
 * invoice IDs are formatted as "INV-1", "INV-2", ... "INV-137".
 *
 * The numeric part comes from InvoiceCounter (see Invoicecounter.schema.js),
 * which is scoped to the business only — NOT to the year. This means the
 * sequence keeps climbing across years by default (e.g. "INV-137" in 2026
 * can be followed by "NEW-138" in 2027 if the owner picks a new prefix),
 * rather than resetting to 1 every January 1st.
 *
 * If you'd rather have the counter reset per year too (e.g. "NEW-1" is
 * the first invoice of 2027), scope InvoiceCounter by { business, year }
 * instead of just { business } — see relevant docs for details.
 */
const invoicePrefixSchema = new Schema(
  {
    business: { type: Types.ObjectId, ref: "BusinessProfile", required: true },
    year: { type: Number, required: true }, // calendar year this prefix applies to
    prefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9]{1,10}$/, "Prefix must be 1-10 alphanumeric characters (A-Z, 0-9 only)"],
    },
  },
  { timestamps: true }
);

// One prefix per business per year — setInvoicePrefix() below relies on
// this for its upsert to behave as "create or overwrite this year's prefix".
invoicePrefixSchema.index({ business: 1, year: 1 }, { unique: true });

const InvoicePrefix =
  mongoose.models.InvoicePrefix || mongoose.model("InvoicePrefix", invoicePrefixSchema);

export default InvoicePrefix;

/**
 * Set (create or overwrite) the prefix for a business for a given year.
 * If year is omitted, defaults to the current calendar year.
 * Normalizes to uppercase, matching the schema's `uppercase: true`.
 */
export async function setInvoicePrefix(businessId, prefix, year) {
  const targetYear = year || new Date().getFullYear();
  const normalizedPrefix = String(prefix).trim().toUpperCase();

  const doc = await InvoicePrefix.findOneAndUpdate(
    { business: businessId, year: targetYear },
    { $set: { prefix: normalizedPrefix } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return doc;
}

/**
 * Get the prefix doc for a business for a given year (defaults to the
 * current year if omitted). Returns null if the shop owner hasn't set
 * a prefix for that year yet — callers decide how to handle that
 * (block invoice creation vs. fall back to a default, see
 * invoiceIdentifier.helper.js).
 */
export async function getInvoicePrefixForYear(businessId, year) {
  const targetYear = year || new Date().getFullYear();
  return InvoicePrefix.findOne({ business: businessId, year: targetYear });
}