import express from "express";
import ProvincesController from "../../Controllers/Admin/provinces.controller.js";



const provinceRouter = express.Router();
const provinceController = new ProvincesController();

// ─── Provinces & Cities ───────────────────────────────────────────────────────
provinceRouter.post("/", (req, res) => provinceController.addProvince(req, res));
provinceRouter.get("/", (req, res) => provinceController.fetchProvinces(req, res));
provinceRouter.patch("/:provinceId", (req, res) => provinceController.editProvince(req, res));
provinceRouter.delete("/:provinceId", (req, res) => provinceController.deleteProvince(req, res));

provinceRouter.post("/:provinceId/cities", (req, res) => provinceController.addCity(req, res));
provinceRouter.patch("/:provinceId/cities/:cityName", (req, res) => provinceController.editCity(req, res));
provinceRouter.delete("/:provinceId/cities/:cityName", (req, res) => provinceController.deleteCity(req, res));

export default provinceRouter;