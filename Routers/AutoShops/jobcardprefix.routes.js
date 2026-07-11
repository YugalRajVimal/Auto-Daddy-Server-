import express from "express";

import { setPrefix, getPrefix, getAllPrefixes } from "../../Controllers/AutoShops/jobCardPrefix.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const jobCardPrefixRouter = express.Router();

jobCardPrefixRouter.use(jwtAuth);

// Set/overwrite the prefix for a year (body: { prefix, year? })
jobCardPrefixRouter.put("/", setPrefix);

// Get the prefix for a year (?year=2026, defaults to current year)
jobCardPrefixRouter.get("/", getPrefix);

// Get full prefix history for this business (all years set so far)
jobCardPrefixRouter.get("/all", getAllPrefixes);

export default jobCardPrefixRouter;

// Mount, following the same pattern as jobCardRouter:
// autoShopNewRouter.use("/jobcard-prefix", jobCardPrefixRouter);
// -> Final base: {{BASE}}/api/autoshopowner/jobcard-prefix