import { getJobCardPrefixForYear, setJobCardPrefix } from "../../Schema/Jobcardprefix.schema.js";
import { User } from "../../Schema/user.schema.js";


/* Helper: resolve the caller's businessProfile id from DB (req.user only
   ever has { id, role, ... } from jwtAuth — never businessProfile). Same
   pattern as jobCard.controller.js. */
async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

const PREFIX_REGEX = /^[A-Za-z0-9]{1,10}$/;

/* =========================================================
   SET / UPDATE JOB CARD PREFIX FOR A YEAR
   Route: PUT /jobcard-prefix
   Body: { prefix: "ABC", year?: 2026 }  // year defaults to current year
   Overwrites the existing prefix for that year if one is already set —
   e.g. an owner who set "ABC" in January can still change it to "XYZ"
   in June; already-created job cards keep their original jobCardId
   (it's stored on the JobCard doc itself, not recomputed later).
   ========================================================= */
export const setPrefix = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { prefix, year } = req.body;

    if (!prefix || typeof prefix !== "string" || !prefix.trim()) {
      return res.status(400).json({ success: false, message: "prefix is required" });
    }
    if (!PREFIX_REGEX.test(prefix.trim())) {
      return res.status(400).json({
        success: false,
        message: "prefix must be 1-10 alphanumeric characters (letters/numbers only, no spaces or symbols)",
      });
    }

    let targetYear = new Date().getFullYear();
    if (year !== undefined) {
      targetYear = Number(year);
      if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) {
        return res.status(400).json({ success: false, message: "Invalid year" });
      }
    }

    const doc = await setJobCardPrefix(businessId, prefix, targetYear);

    return res.status(200).json({
      success: true,
      message: `Job card prefix for ${targetYear} set to "${doc.prefix}"`,
      data: { year: doc.year, prefix: doc.prefix },
    });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to set job card prefix",
      error: error.message,
    });
  }
};

/* =========================================================
   GET JOB CARD PREFIX FOR A YEAR
   Route: GET /jobcard-prefix?year=2026  (year optional, defaults to current)
   ========================================================= */
export const getPrefix = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    let targetYear = new Date().getFullYear();
    if (req.query.year !== undefined) {
      targetYear = Number(req.query.year);
      if (!Number.isInteger(targetYear)) {
        return res.status(400).json({ success: false, message: "Invalid year" });
      }
    }

    const doc = await getJobCardPrefixForYear(businessId, targetYear);

    return res.status(200).json({
      success: true,
      data: doc
        ? { year: doc.year, prefix: doc.prefix }
        : { year: targetYear, prefix: null }, // no prefix set for this year yet
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job card prefix",
      error: error.message,
    });
  }
};



/* =========================================================
   GET FULL PREFIX HISTORY FOR THIS BUSINESS
   Route: GET /jobcard-prefix/all
   ========================================================= */
export const getAllPrefixes = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const docs = await JobCardPrefix.find({ business: businessId }).sort({ year: -1 });

    return res.status(200).json({
      success: true,
      data: docs.map((d) => ({ year: d.year, prefix: d.prefix })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job card prefix history",
      error: error.message,
    });
  }
};