import express from "express";
import { brandLogoUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
import CarCompanyController from "../../Controllers/Admin/carCompany.controller.js";

const carCompanyRouter = express.Router();
const carCompanyController = new CarCompanyController();

// Car Company Routes
carCompanyRouter.post(
  "/",
  brandLogoUploadMiddleware,
  (req, res) => carCompanyController.addCarCompany(req, res)
);

carCompanyRouter.patch(
  "/:id",
  brandLogoUploadMiddleware,
  (req, res) => carCompanyController.editCarCompany(req, res)
);

carCompanyRouter.get("/", (req, res) => carCompanyController.fetchCarCompanies(req, res));

carCompanyRouter.delete("/:id", (req, res) => carCompanyController.deleteCarCompany(req, res));

export default carCompanyRouter;