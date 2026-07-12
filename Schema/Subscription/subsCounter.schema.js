import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * Generic reusable counter, keyed by an arbitrary `name` string. Mirrors
 * the same atomic-increment pattern as JobCardCounter (Jobcardcounter.schema.js)
 * but isn't scoped to a business — used for global sequences like invoice
 * numbers. Add more `name` values as needed (e.g. "invoiceNo", "refundNo").
 */
const counterSchema = new Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const SubsCounter = mongoose.models.SubsCounter || mongoose.model("SubsCounter", counterSchema);

export default SubsCounter;

/**
 * Atomically increments and returns the next value in the named sequence.
 * Safe under concurrent requests (findOneAndUpdate is atomic at the DB level).
 */
export async function getNextSequence(name) {
  const counter = await SubsCounter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}