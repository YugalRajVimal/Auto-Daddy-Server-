import express from "express";
import { createDeal, editDeal, deleteDeal, fetchMyDeals } from "../../Controllers/AutoShops/deals.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";

const autoShopDealsRouter = express.Router();

// Create a new deal (service/part/salvage)
autoShopDealsRouter.post(
  "/create",
  jwtAuth,
  upload.single("dealImage"),
  createDeal
);

// Edit an existing deal for the business profile
autoShopDealsRouter.put(
  "/edit/:id",
  jwtAuth,
  upload.single("dealImage"),
  editDeal
);

// Delete a deal by ID (only if created by the current business profile)
autoShopDealsRouter.delete(
  "/delete/:id",
  jwtAuth,
  deleteDeal
);

// Fetch all deals for the current business profile
autoShopDealsRouter.get(
  "/my-deals",
  jwtAuth,
  fetchMyDeals
);

export default autoShopDealsRouter;