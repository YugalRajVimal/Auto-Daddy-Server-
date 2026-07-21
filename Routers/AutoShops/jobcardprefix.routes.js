import express from "express";

// import { setPrefix, getPrefix, getAllPrefixes } from "../../Controllers/AutoShops/jobCardPrefix.controller.js";
import { getAllPrefixes, getPrefix, setPrefix } from "../../Controllers/AutoShops/Jobcardprefix.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { peekNextJobCardIdentifiers, setJobCardCounter } from "../../Controllers/AutoShops/Jobcardidentifier.helper.js";
import { User } from "../../Schema/user.schema.js";
import mongoose from "mongoose";

const jobCardPrefixRouter = express.Router();

jobCardPrefixRouter.use(jwtAuth);

// Set/overwrite the prefix for a year (body: { prefix, year? })
jobCardPrefixRouter.put("/", setPrefix);



// Get the prefix for a year (?year=2026, defaults to current year)
jobCardPrefixRouter.get("/", getPrefix);

// GET /next - returns { jobCardNo, jobCardId, prefixSet, year }
jobCardPrefixRouter.get("/next", async (req, res) => {
    try {
      const user = req.user;
      if (!user || !user.id) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }
  
      const freshUser = await User.findById(user.id).select("businessProfile");
      if (!freshUser || !freshUser.businessProfile) {
        return res.status(403).json({ success: false, message: "Business profile not found for user" });
      }
  
      const data = await peekNextJobCardIdentifiers(freshUser.businessProfile);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to preview next job card prefix/number",
        error: err?.message || err,
      });
    }
  });
  
  // PUT /seq - Set (overwrite) job card sequence for a business (admin/migration only)
  jobCardPrefixRouter.put("/seq", async (req, res) => {
    try {
      const user = req.user;
      if (!user || !user.id) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }
    
  
      const { newSeq, businessProfileId } = req.body;
  
      if (!businessProfileId || !mongoose.Types.ObjectId.isValid(businessProfileId)) {
        return res.status(400).json({ success: false, message: "Valid businessProfileId is required" });
      }
      if (!Number.isInteger(newSeq) || newSeq < 0) {
        return res.status(400).json({
          success: false,
          message: "newSeq must be a non-negative integer",
        });
      }
  
      const updated = await setJobCardCounter(businessProfileId, newSeq);
  
      return res.status(200).json({
        success: true,
        data: { business: updated.business, seq: updated.seq },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to set job card sequence",
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