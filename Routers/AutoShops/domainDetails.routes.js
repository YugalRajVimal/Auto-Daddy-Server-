import express from "express";
import { addDomainDetails, editDomainDetails, getDomainDetails } from "../../Controllers/AutoShops/domainDetails.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const domainDetailsRouter = express.Router();

domainDetailsRouter.use(jwtAuth);


/**
 * GET /api/autoshops/domain-details/get
 * Gets all domain details for a business profile.
 */
domainDetailsRouter.get("/get", getDomainDetails);

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