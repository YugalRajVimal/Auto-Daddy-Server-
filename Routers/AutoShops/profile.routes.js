
import express from "express";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import {
  completeAutoShopOwnerSignup,
  getBusinessProfile,
  getPersonalProfile,
  updateBusinessProfile,
  updateBusinessTemplateSlugs,
  updateMobileService,
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

/* Manual signup — step 2: fill in name, businessName, businessLogo, city
   after phone+OTP verification (see /api/auth/autoshopowner/signup). */
autoShopProfileRouter.put(
  "/complete-signup",
  upload.single("businessLogo"),
  completeAutoShopOwnerSignup
);

/* Personal profile */
autoShopProfileRouter.get("/personal", getPersonalProfile);
autoShopProfileRouter.put("/personal", upload.single("profilePhoto"), updatePersonalProfile);

/* Business profile */
autoShopProfileRouter.get("/business", getBusinessProfile);
autoShopProfileRouter.put("/business", upload.single("businessLogo"), updateBusinessProfile);

autoShopProfileRouter.patch("/business/template-slugs", updateBusinessTemplateSlugs);

/* Mobile service (road-side assistance) toggle + coverage distance */
autoShopProfileRouter.patch("/business/mobile-service", updateMobileService);

/* NEW: Open hours — weekly defaults + date-specific overrides */
autoShopProfileRouter.put("/business/open-hours/weekly", updateWeeklyOpenHours);
autoShopProfileRouter.put("/business/open-hours/special", upsertSpecialDayOpenHours);
autoShopProfileRouter.delete("/business/open-hours/special/:date", removeSpecialDayOpenHours);
autoShopProfileRouter.get("/business/open-hours", getOpenHours);

export default autoShopProfileRouter;