import express from "express";
import { addDomainDetails, editDomainDetails } from "../../Controllers/AutoShops/domainDetails.controller.js";

const domainDetailsRouter = express.Router();

/**
 * POST /api/autoshops/domain-details/add
 * Adds new domain details to a business profile.
 */
domainDetailsRouter.post("/add", addDomainDetails);

/**
 * PUT /api/autoshops/domain-details/edit
 * Edits existing domain details by index or domainName.
 */
domainDetailsRouter.put("/edit", editDomainDetails);

export default domainDetailsRouter;