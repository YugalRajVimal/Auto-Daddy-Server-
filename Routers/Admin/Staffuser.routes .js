// Routers/staffUser.routes.js
import express from "express";
import StaffUserController from "../../Controllers/Admin/Staffuser.controller.js";
import { staffAuth, requireNavPermission, requireSuperAdmin } from "../../middlewares/Permission.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const ctrl = new StaffUserController();

// ─── Public: login (mount under /api/auth/staff) ──────────────────────────
export const staffAuthRouter = express.Router();
staffAuthRouter.post("/login", (req, res) => ctrl.login(req, res));

// ─── SuperAdmin-only: staff & permission management ───────────────────────
// Mount under /api/admin/staff-users
export const staffUserManagementRouter = express.Router();

staffUserManagementRouter.use(jwtAuth, requireSuperAdmin);

staffUserManagementRouter.get("/", (req, res) => ctrl.getAll(req, res));
staffUserManagementRouter.post("/", (req, res) => ctrl.create(req, res));
staffUserManagementRouter.get("/permission-modules", (req, res) => ctrl.getPermissionModules(req, res));
staffUserManagementRouter.get("/:id", (req, res) => ctrl.getOne(req, res));
staffUserManagementRouter.put("/:id", (req, res) => ctrl.update(req, res));
staffUserManagementRouter.patch("/:id/permissions", (req, res) => ctrl.updatePermissions(req, res));
staffUserManagementRouter.patch("/:id/status", (req, res) => ctrl.toggleStatus(req, res));
staffUserManagementRouter.patch("/:id/reset-password", (req, res) => ctrl.resetPassword(req, res));
staffUserManagementRouter.delete("/:id", (req, res) => ctrl.remove(req, res));
staffUserManagementRouter.get("/:id/activity", (req, res) => ctrl.getActivity(req, res));

export default staffUserManagementRouter;

// ─── Reference: how every OTHER admin route should be guarded from here on ─
//
// Every existing route in admin.routes.js (and its Admin/*.routes.js
// sub-routers) needs staffAuth + requireNavPermission added — none of it
// is wired in the current live file (bare handlers, no middleware).
//
// Pattern for a resource route:
//
//   import { staffAuth, requireNavPermission } from "../middlewares/Auth/permission.middleware.js";
//
//   router.get(
//     "/carowners",
//     staffAuth,
//     requireNavPermission("users", "carOwners", "view"),
//     (req, res) => ctrl.getAllCarOwners(req, res)
//   );
//   router.post(
//     "/carowners",
//     staffAuth,
//     requireNavPermission("users", "carOwners", "create"),
//     (req, res) => ctrl.createCarOwner(req, res)
//   );
//   router.put(
//     "/carowners/:id",
//     staffAuth,
//     requireNavPermission("users", "carOwners", "update"),
//     (req, res) => ctrl.updateCarOwner(req, res)
//   );
//   router.delete(
//     "/carowners/:id",
//     staffAuth,
//     requireNavPermission("users", "carOwners", "delete"),
//     (req, res) => ctrl.deleteCarOwner(req, res)
//   );
//
// Upload middlewares (brandLogoUploadMiddleware, adsUploadMiddleware, etc.)
// must always come AFTER staffAuth + requireNavPermission, never before —
// multer consumes req.body, so auth/permission checks that read req.body
// (they don't currently, but avoid the trap) must run first regardless.