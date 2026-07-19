// Routers/role.routes.js
import express from "express";
import RoleController from "../../Controllers/Admin/role.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireSuperAdmin } from "../../middlewares/Permission.middleware.js";

const ctrl = new RoleController();
const roleRouter = express.Router();

roleRouter.use(jwtAuth, requireSuperAdmin);

roleRouter.get("/", (req, res) => ctrl.getAll(req, res));
roleRouter.post("/", (req, res) => ctrl.create(req, res));
roleRouter.get("/:id", (req, res) => ctrl.getOne(req, res));
roleRouter.put("/:id", (req, res) => ctrl.update(req, res));
roleRouter.patch("/:id/permissions", (req, res) => ctrl.updatePermissions(req, res));
roleRouter.delete("/:id", (req, res) => ctrl.remove(req, res));

export default roleRouter;