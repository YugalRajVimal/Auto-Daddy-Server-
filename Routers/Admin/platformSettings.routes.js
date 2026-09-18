import express from "express";
import { getSettings, updateSettings } from "../../Controllers/Admin/platformSettings.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js"; // swap for your admin-auth middleware if different

const platformSettingsRouter = express.Router();
platformSettingsRouter.use(jwtAuth);

platformSettingsRouter.get("/", getSettings);
platformSettingsRouter.patch("/", updateSettings);

export default platformSettingsRouter;

// Mount in your Admin router tree, e.g.:
// adminRouter.use("/platform-settings", platformSettingsRouter);
// -> Final base: {{BASE}}/api/admin/platform-settings