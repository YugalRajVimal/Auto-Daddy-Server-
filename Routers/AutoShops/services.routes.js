import express from "express";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { addSubServices, addToMyServices, deleteSubService, editSubService, getAdminServicesWithShopType, getMyServices } from "../../Controllers/AutoShops/services.controller.js";


const autoShopServicesRouter = express.Router();

// All routes below require a logged-in autoshopowner
autoShopServicesRouter.use(jwtAuth);

/* Admin services */
autoShopServicesRouter.get("/", getAdminServicesWithShopType);
autoShopServicesRouter.get("/my", getMyServices);

autoShopServicesRouter.put("/add", addToMyServices);

// SubService endpoints
autoShopServicesRouter.post("/subservices/add", addSubServices);
autoShopServicesRouter.put("/subservices/edit", editSubService);
autoShopServicesRouter.delete("/subservices/delete", deleteSubService);




export default autoShopServicesRouter;

// Mount in your app entry, e.g.:
// import profileRoutes from "./routes/profile.routes.js";
// app.use("/api/autoshopowner/profile", profileRoutes);