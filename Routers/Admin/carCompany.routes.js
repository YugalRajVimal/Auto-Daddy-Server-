// import express from "express";
// import { brandLogoUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
// import CarCompanyController from "../../Controllers/Admin/carCompany.controller.js";

// const carCompanyRouter = express.Router();
// const carCompanyController = new CarCompanyController();

// // Car Company Routes
// carCompanyRouter.post(
//   "/",
//   brandLogoUploadMiddleware,
//   (req, res) => carCompanyController.addCarCompany(req, res)
// );

// carCompanyRouter.patch(
//   "/:id",
//   brandLogoUploadMiddleware,
//   (req, res) => carCompanyController.editCarCompany(req, res)
// );

// carCompanyRouter.get("/", (req, res) => carCompanyController.fetchCarCompanies(req, res));

// carCompanyRouter.delete("/:id", (req, res) => carCompanyController.deleteCarCompany(req, res));

// export default carCompanyRouter;

// Routers/Admin/carCompany.routes.js
// MODULE MAP: carCompanies.carCompanies

import express from "express";
import { brandLogoUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
import CarCompanyController from "../../Controllers/Admin/carCompany.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


const carCompanyRouter = express.Router();
const carCompanyController = new CarCompanyController();
carCompanyRouter.use(jwtAuth);

carCompanyRouter.post(
  "/",
  requireNavPermission("carCompanies", "carCompanies", "create"),
  brandLogoUploadMiddleware,
  (req, res) => carCompanyController.addCarCompany(req, res)
);

carCompanyRouter.patch(
  "/:id",
  requireNavPermission("carCompanies", "carCompanies", "update"),
  brandLogoUploadMiddleware,
  (req, res) => carCompanyController.editCarCompany(req, res)
);

carCompanyRouter.get(
  "/",
  requireNavPermission("carCompanies", "carCompanies", "view"),
  (req, res) => carCompanyController.fetchCarCompanies(req, res)
);

carCompanyRouter.delete(
  "/:id",
  requireNavPermission("carCompanies", "carCompanies", "delete"),
  (req, res) => carCompanyController.deleteCarCompany(req, res)
);

export default carCompanyRouter;