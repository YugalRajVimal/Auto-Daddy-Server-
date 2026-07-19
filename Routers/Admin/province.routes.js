// import express from "express";
// import ProvincesController from "../../Controllers/Admin/provinces.controller.js";



// const provinceRouter = express.Router();
// const provinceController = new ProvincesController();

// // ─── Provinces & Cities ───────────────────────────────────────────────────────
// provinceRouter.post("/", (req, res) => provinceController.addProvince(req, res));
// provinceRouter.get("/", (req, res) => provinceController.fetchProvinces(req, res));
// provinceRouter.patch("/:provinceId", (req, res) => provinceController.editProvince(req, res));
// provinceRouter.delete("/:provinceId", (req, res) => provinceController.deleteProvince(req, res));

// provinceRouter.post("/:provinceId/cities", (req, res) => provinceController.addCity(req, res));
// provinceRouter.patch("/:provinceId/cities/:cityName", (req, res) => provinceController.editCity(req, res));
// provinceRouter.delete("/:provinceId/cities/:cityName", (req, res) => provinceController.deleteCity(req, res));

// export default provinceRouter;


// Routers/Admin/province.routes.js
// MODULE MAP: provinces -> location.provinces, cities -> location.cities

import express from "express";
import ProvincesController from "../../Controllers/Admin/provinces.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"

const provinceRouter = express.Router();
const provinceController = new ProvincesController();
provinceRouter.use(jwtAuth);

// ─── Provinces ─────────────────────────────────────────────────────────────
provinceRouter.post("/", requireNavPermission("location", "provinces", "create"), (req, res) => provinceController.addProvince(req, res));
provinceRouter.get("/", requireNavPermission("location", "provinces", "view"), (req, res) => provinceController.fetchProvinces(req, res));
provinceRouter.patch("/:provinceId", requireNavPermission("location", "provinces", "update"), (req, res) => provinceController.editProvince(req, res));
provinceRouter.delete("/:provinceId", requireNavPermission("location", "provinces", "delete"), (req, res) => provinceController.deleteProvince(req, res));

// ─── Cities (nested under a province) ──────────────────────────────────────
provinceRouter.post("/:provinceId/cities", requireNavPermission("location", "cities", "create"), (req, res) => provinceController.addCity(req, res));
provinceRouter.patch("/:provinceId/cities/:cityName", requireNavPermission("location", "cities", "update"), (req, res) => provinceController.editCity(req, res));
provinceRouter.delete("/:provinceId/cities/:cityName", requireNavPermission("location", "cities", "delete"), (req, res) => provinceController.deleteCity(req, res));

export default provinceRouter;