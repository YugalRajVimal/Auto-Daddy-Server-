// import express from "express";
// import { createDeal, editDeal, deleteDeal, fetchMyDeals } from "../../Controllers/AutoShops/deals.controller.js";
// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
// import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";

// const autoShopDealsRouter = express.Router();

// // Create a new deal (service/part/salvage)
// autoShopDealsRouter.post(
//   "/create",
//   jwtAuth,
//   upload.single("dealImage"),
//   createDeal
// );

// // Edit an existing deal for the business profile
// autoShopDealsRouter.put(
//   "/edit/:id",
//   jwtAuth,
//   upload.single("dealImage"),
//   editDeal
// );

// // Delete a deal by ID (only if created by the current business profile)
// autoShopDealsRouter.delete(
//   "/delete/:id",
//   jwtAuth,
//   deleteDeal
// );

// // Fetch all deals for the current business profile
// autoShopDealsRouter.get(
//   "/my-deals",
//   jwtAuth,
//   fetchMyDeals
// );

// import { getAllDealers } from "../../Controllers/AutoShops/deals.controller.js";

// // Fetch all active dealers
// autoShopDealsRouter.get(
//   "/dealers",
//   jwtAuth,
//   getAllDealers
// );


// export default autoShopDealsRouter;

import express from "express";
import { createDeal, editDeal, deleteDeal, fetchMyDeals } from "../../Controllers/AutoShops/deals.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";

const autoShopDealsRouter = express.Router();

// Create a new deal (service/part/salvage)
// Up to 2 images: send the SAME field name "dealImage" twice in the
// multipart form (see updated curl examples).
autoShopDealsRouter.post(
  "/create",
  jwtAuth,
  upload.array("dealImage", 2),
  createDeal
);

// Edit an existing deal for the business profile
// If new "dealImage" files are sent (up to 2), they REPLACE the deal's
// existing images. Omit the field entirely to leave images untouched.
autoShopDealsRouter.put(
  "/edit/:id",
  jwtAuth,
  upload.array("dealImage", 2),
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

import { getAllDealers } from "../../Controllers/AutoShops/deals.controller.js";

// Fetch all active dealers
autoShopDealsRouter.get(
  "/dealers",
  jwtAuth,
  getAllDealers
);


export default autoShopDealsRouter;