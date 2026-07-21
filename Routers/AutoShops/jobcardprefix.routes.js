import express from "express";

// import { setPrefix, getPrefix, getAllPrefixes } from "../../Controllers/AutoShops/jobCardPrefix.controller.js";
import { getAllPrefixes, getPrefix, setPrefix } from "../../Controllers/AutoShops/Jobcardprefix.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { peekNextJobCardIdentifiers } from "../../Controllers/AutoShops/Jobcardidentifier.helper.js";

const jobCardPrefixRouter = express.Router();

jobCardPrefixRouter.use(jwtAuth);

// Set/overwrite the prefix for a year (body: { prefix, year? })
jobCardPrefixRouter.put("/", setPrefix);



// Get the prefix for a year (?year=2026, defaults to current year)
jobCardPrefixRouter.get("/", getPrefix);

// GET /next - returns { jobCardNo, jobCardId, prefixSet, year }
// For UI preview before job card creation
jobCardPrefixRouter.get("/next", async (req, res) => {
  try {
    // Assumes jwtAuth => req.user.id is present
    const user = req.user;

    // Defensive check for user (shouldn't ever hit, but good API hygiene)
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Fetch fresh user object to ensure up-to-date businessProfile field is present
    const { User } = await import("../../Controllers/AutoShops/Jobcard.controller.js");
    const freshUser = await User.findById(user.id).select("businessProfile");
    if (!freshUser || !freshUser.businessProfile) {
      return res.status(403).json({ success: false, message: "Business profile not found for user" });
    }
    // Use the fresh user.businessProfile below in the endpoint logic

    const businessProfileId = freshUser.businessProfile;
    if (!businessProfileId) {
      return res.status(403).json({ success: false, message: "Business profile not found for user" });
    }

    const data = await peekNextJobCardIdentifiers(businessProfileId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to preview next job card prefix/number",
      error: err?.message || err,
    });
  }
});


// Get full prefix history for this business (all years set so far)
jobCardPrefixRouter.get("/all", getAllPrefixes);

export default jobCardPrefixRouter;

// Mount, following the same pattern as jobCardRouter:
// autoShopNewRouter.use("/jobcard-prefix", jobCardPrefixRouter);
// -> Final base: {{BASE}}/api/autoshopowner/jobcard-prefix