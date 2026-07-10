import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * One doc per business. `seq` is the last jobCardNo issued for that
 * business — incremented atomically so concurrent job card creation
 * never collides, even under load.
 */
const jobCardCounterSchema = new Schema({
  business: { type: Types.ObjectId, ref: "BusinessProfile", required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const JobCardCounter =
  mongoose.models.JobCardCounter || mongoose.model("JobCardCounter", jobCardCounterSchema);

export default JobCardCounter;

/**
 * Atomically increments and returns the next jobCardNo for a business.
 * Safe under concurrent requests (findOneAndUpdate is atomic at the DB level).
 */
export async function getNextJobCardNo(businessId) {
  const counter = await JobCardCounter.findOneAndUpdate(
    { business: businessId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

/**
 * Read-only peek at what the NEXT jobCardNo will be, without incrementing.
 * Used by getJobCardPageDetails so the UI can preview it before creation.
 */
export async function peekNextJobCardNo(businessId) {
  const counter = await JobCardCounter.findOne({ business: businessId });
  return (counter?.seq || 0) + 1;
}