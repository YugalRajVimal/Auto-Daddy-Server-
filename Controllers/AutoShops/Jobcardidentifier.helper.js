import { getJobCardPrefixForYear } from "../../Schema/Jobcardprefix.schema.js";
import JobCardCounter, { getNextJobCardNo, peekNextJobCardNo } from "../../Schema/Jobcardcounter.schema.js";


/**
 * Atomically reserves the next jobCardNo (via the existing counter) AND
 * resolves this business's current-year prefix, returning both the raw
 * numeric jobCardNo (kept for the existing unique index + sorting) and
 * the human-facing jobCardId string, e.g. { jobCardNo: 137, jobCardId: "ABC-137" }.
 *
 * Throws a { status, message } object (same shape used elsewhere in this
 * controller) if the shop owner hasn't set a prefix for the current year
 * yet — job card creation is blocked until they do, rather than silently
 * falling back to something like "JC-137". If you'd prefer a default
 * fallback instead of a hard block, see the commented alternative below.
 */
export async function getNextJobCardIdentifiers(businessId) {
  const year = new Date().getFullYear();

  const prefixDoc = await getJobCardPrefixForYear(businessId, year);
  if (!prefixDoc) {
    throw {
      status: 400,
      message: `No job card prefix set for ${year} yet. Set one first via PUT /jobcard-prefix (body: { "prefix": "ABC" }).`,
    };

    // --- Alternative: fall back to a default prefix instead of blocking ---
    // const fallbackPrefix = "JC";
    // const jobCardNo = await getNextJobCardNo(businessId);
    // return { jobCardNo, jobCardId: `${fallbackPrefix}-${jobCardNo}` };
  }

  const jobCardNo = await getNextJobCardNo(businessId);
  return { jobCardNo, jobCardId: `${prefixDoc.prefix}-${jobCardNo}` };
}

/**
 * Set (overwrite) the job card sequence for a business to a specific number.
 * Used for admin or migration tools only — not exposed to typical user flows.
 * 
 * @param {ObjectId} businessId - The business profile ID
 * @param {number} newSeq - The new value for the sequence (e.g., 100 will make the next jobCardNo = 101)
 * @returns {Promise<{ business: ObjectId, seq: number }>} The updated JobCardCounter document
 */
export async function setJobCardCounter(businessId, newSeq) {
  // Defensive number check; optional, can throw or sanitize
  if (!Number.isInteger(newSeq) || newSeq < 0) {
    throw new Error("newSeq must be a non-negative integer");
  }
  const counter = await JobCardCounter.findOneAndUpdate(
    { business: businessId },
    { $set: { seq: newSeq } },
    { new: true, upsert: true }
  );
  return counter;
}



/**
 * Read-only preview of what the NEXT jobCardId will be, without
 * incrementing the counter. Used by getJobCardPageDetails so the UI can
 * show "Next Job Card: ABC-138" before the owner actually creates it.
 * Returns jobCardId: null if no prefix is set yet for the current year,
 * so the frontend can prompt the owner to set one instead of erroring.
 */
export async function peekNextJobCardIdentifiers(businessId) {
  const year = new Date().getFullYear();

  const [prefixDoc, nextSeq] = await Promise.all([
    getJobCardPrefixForYear(businessId, year),
    peekNextJobCardNo(businessId),
  ]);

  return {
    jobCardNo: nextSeq,
    jobCardId: prefixDoc ? `${prefixDoc.prefix}-${nextSeq}` : null,
    prefixSet: !!prefixDoc,
    year,
  };
}