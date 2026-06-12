// Routers/subadmin.routes.js
import express from "express";
import SubAdminController from "../Controllers/Admin/subadmin.controller.js";
import { adminOrSubAdminAuth, requireAdmin } from "../middlewares/Auth/permission.middleware.js";

const subAdminRouter = express.Router();
const ctrl = new SubAdminController();

// ─── SubAdmin self-login (password-based, not OTP) ───────────────────────────
// POST /api/auth/subadmin/login
// (Add this in authRouter too — see instructions below)
subAdminRouter.post("/login", (req, res) => ctrl.login(req, res));

export default subAdminRouter;


// ─── Admin-only SubAdmin management routes ────────────────────────────────────
// Mount these under adminRouter with: adminRouter.use("/subadmins", subAdminManagementRouter)

export const subAdminManagementRouter = express.Router();

// All routes below require admin auth + main-admin role
subAdminManagementRouter.use(adminOrSubAdminAuth, requireAdmin);

// GET  /admin/subadmins          — list all
subAdminManagementRouter.get("/", (req, res) => ctrl.getAll(req, res));

// POST /admin/subadmins          — create
subAdminManagementRouter.post("/", (req, res) => ctrl.create(req, res));

// GET  /admin/subadmins/:id      — get single
subAdminManagementRouter.get("/:id", (req, res) => ctrl.getOne(req, res));

// PUT  /admin/subadmins/:id      — update details
subAdminManagementRouter.put("/:id", (req, res) => ctrl.update(req, res));

// PATCH /admin/subadmins/:id/permissions — update permissions
subAdminManagementRouter.patch("/:id/permissions", (req, res) => ctrl.updatePermissions(req, res));

// PATCH /admin/subadmins/:id/status — activate/deactivate
subAdminManagementRouter.patch("/:id/status", (req, res) => ctrl.toggleStatus(req, res));

// PATCH /admin/subadmins/:id/reset-password — reset password
subAdminManagementRouter.patch("/:id/reset-password", (req, res) => ctrl.resetPassword(req, res));

// DELETE /admin/subadmins/:id    — soft delete
subAdminManagementRouter.delete("/:id", (req, res) => ctrl.remove(req, res));

// GET /admin/subadmins/:id/activity — activity logs
subAdminManagementRouter.get("/:id/activity", (req, res) => ctrl.getActivity(req, res));