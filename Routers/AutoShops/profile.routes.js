import express from "express";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { getBusinessProfile, getPersonalProfile, updateBusinessProfile, updatePersonalProfile } from "../../Controllers/AutoShops/profile.controller.js";


const autoShopProfileRouter = express.Router();

// All routes below require a logged-in autoshopowner
autoShopProfileRouter.use(jwtAuth);

/* Personal profile */
autoShopProfileRouter.get("/personal", getPersonalProfile);
autoShopProfileRouter.put("/personal", upload.single("profilePhoto"), updatePersonalProfile);

/* Business profile */
autoShopProfileRouter.get("/business", getBusinessProfile);
autoShopProfileRouter.put("/business", upload.single("businessLogo"), updateBusinessProfile);



export default autoShopProfileRouter;

// Mount in your app entry, e.g.:
// import profileRoutes from "./routes/profile.routes.js";
// app.use("/api/autoshopowner/profile", profileRoutes);