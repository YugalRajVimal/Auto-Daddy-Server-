import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * One doc per business. `seq` is the next jobCardNo to issue for that
 * business. This value should always be the next jobCardNo, not the last issued.
 * No auto-incrementing should occur on fetch; increment is done only on explicit issue.
 */
const jobCardCounterSchema = new Schema({
  business: { type: Types.ObjectId, ref: "BusinessProfile", required: true, unique: true },
  seq: { type: Number, default: 1 }, // Default to 1: first jobCardNo will be 1
});

const JobCardCounter =
  mongoose.models.JobCardCounter || mongoose.model("JobCardCounter", jobCardCounterSchema);

export default JobCardCounter;

/**
 * Get the current next jobCardNo for a business WITHOUT incrementing it.
 * This simply returns the counter's seq value. If not set, starts at 1.
 */
export async function getNextJobCardNo(businessId) {
  let counter = await JobCardCounter.findOne({ business: businessId });
  if (!counter) {
    // If no doc exists, treat next as 1 (and create for future use)
    counter = await JobCardCounter.create({ business: businessId, seq: 1 });
  }
  return counter.seq;
}

/**
 * Alias for getting the next jobCardNo for previewing (without incrementing).
 * Returns the exact value currently stored for that business counter.
 */
export async function peekNextJobCardNo(businessId) {
  return await getNextJobCardNo(businessId);
}