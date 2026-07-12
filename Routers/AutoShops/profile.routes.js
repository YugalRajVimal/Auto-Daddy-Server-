// import express from "express";
// import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
// import { getBusinessProfile, getPersonalProfile, updateBusinessProfile, updateBusinessTemplateSlugs, updatePersonalProfile } from "../../Controllers/AutoShops/profile.controller.js";


// const autoShopProfileRouter = express.Router();

// // All routes below require a logged-in autoshopowner
// autoShopProfileRouter.use(jwtAuth);

// /* Personal profile */
// autoShopProfileRouter.get("/personal", getPersonalProfile);
// autoShopProfileRouter.put("/personal", upload.single("profilePhoto"), updatePersonalProfile);

// /* Business profile */
// autoShopProfileRouter.get("/business", getBusinessProfile);
// autoShopProfileRouter.put("/business", upload.single("businessLogo"), updateBusinessProfile);

// /**
//  * Update the invoiceTemplateSlug and/or jobCardTemplateSlug for the current user's business profile.
//  * PATCH /api/autoshopowner/profile/business/template-slugs
//  * Body: { invoiceTemplateSlug?: string, jobCardTemplateSlug?: string }
//  * Returns success/failure.
//  */
// autoShopProfileRouter.patch(
//   "/business/template-slugs",
//   updateBusinessTemplateSlugs
// );




// export default autoShopProfileRouter;

// Mount in your app entry, e.g.:
// import profileRoutes from "./routes/profile.routes.js";
// app.use("/api/autoshopowner/profile", profileRoutes);


import express from "express";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import {
  getBusinessProfile,
  getPersonalProfile,
  updateBusinessProfile,
  updateBusinessTemplateSlugs,
  updatePersonalProfile,
} from "../../Controllers/AutoShops/profile.controller.js";
import {
  updateWeeklyOpenHours,
  upsertSpecialDayOpenHours,
  removeSpecialDayOpenHours,
  getOpenHours,
} from "../../Controllers/AutoShops/Openhours.controller.js";

const autoShopProfileRouter = express.Router();

autoShopProfileRouter.use(jwtAuth);

/* Personal profile */
autoShopProfileRouter.get("/personal", getPersonalProfile);
autoShopProfileRouter.put("/personal", upload.single("profilePhoto"), updatePersonalProfile);

/* Business profile */
autoShopProfileRouter.get("/business", getBusinessProfile);
autoShopProfileRouter.put("/business", upload.single("businessLogo"), updateBusinessProfile);

autoShopProfileRouter.patch("/business/template-slugs", updateBusinessTemplateSlugs);

/* NEW: Open hours — weekly defaults + date-specific overrides */
autoShopProfileRouter.put("/business/open-hours/weekly", updateWeeklyOpenHours);
autoShopProfileRouter.put("/business/open-hours/special", upsertSpecialDayOpenHours);
autoShopProfileRouter.delete("/business/open-hours/special/:date", removeSpecialDayOpenHours);
autoShopProfileRouter.get("/business/open-hours", getOpenHours);

export default autoShopProfileRouter;