import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * One doc per (business, year). Lets each shop owner choose their own
 * jobCardId prefix for a given calendar year (e.g. "ABC" for 2026), so
 * job card IDs are formatted as "ABC-1", "ABC-2", ... "ABC-137".
 *
 * The numeric part comes from JobCardCounter (Jobcardcounter.schema.js),
 * which is scoped to the business only — NOT to the year. This means the
 * sequence keeps climbing across years by default (e.g. "ABC-137" in 2026
 * can be followed by "XYZ-138" in 2027 if the owner picks a new prefix),
 * rather than resetting to 1 every January 1st.
 *
 * If you'd rather have the counter reset per year too (e.g. "XYZ-1" is
 * the first job card of 2027), scope JobCardCounter by { business, year }
 * instead of just { business } — see the note at the bottom of
 * jobCardIdentifier.helper.js for exactly what to change.
 */
const jobCardPrefixSchema = new Schema(
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

// One prefix per business per year — setJobCardPrefix() below relies on
// this for its upsert to behave as "create or overwrite this year's prefix".
jobCardPrefixSchema.index({ business: 1, year: 1 }, { unique: true });

const JobCardPrefix =
  mongoose.models.JobCardPrefix || mongoose.model("JobCardPrefix", jobCardPrefixSchema);

export default JobCardPrefix;

/**
 * Set (create or overwrite) the prefix for a business for a given year.
 * If year is omitted, defaults to the current calendar year.
 * Normalizes to uppercase, matching the schema's `uppercase: true`.
 */
export async function setJobCardPrefix(businessId, prefix, year) {
  const targetYear = year || new Date().getFullYear();
  const normalizedPrefix = String(prefix).trim().toUpperCase();

  const doc = await JobCardPrefix.findOneAndUpdate(
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
 * (block job card creation vs. fall back to a default, see
 * jobCardIdentifier.helper.js).
 */
export async function getJobCardPrefixForYear(businessId, year) {
  const targetYear = year || new Date().getFullYear();
  return JobCardPrefix.findOne({ business: businessId, year: targetYear });
}