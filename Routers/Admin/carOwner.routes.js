// import express from "express";


// import CarOwnerController from "../../Controllers/Admin/carOwners.controller.js";
// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
// import { onboardCarOwnerUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/onboardCustomerImageUpload.middleware.js";

// const carOwnerRouter = express.Router();
// const carOwnerController = new CarOwnerController();

// // Get all car owners (with job cards & populated vehicles/shops)
// carOwnerRouter.get(
//   "/",
//   (req, res) => carOwnerController.getAllCarOwners(req, res)
// );

// // Onboard (create) a new car owner from admin panel
// carOwnerRouter.post(
//   "/onboard",
//   jwtAuth,
//   onboardCarOwnerUploadMiddleware,
//   (req, res) => carOwnerController.onboardCarOwner(req, res)
// );

// // Edit/update a car owner (admin panel)
// carOwnerRouter.put(
//   "/edit",
//   jwtAuth,
//   onboardCarOwnerUploadMiddleware,
//   (req, res) => carOwnerController.editCustomer(req, res)
// );

// // Toggle car owner status (soft delete / restore)
// carOwnerRouter.put(
//   "/:userId/status/toggle",
//   jwtAuth,
//   (req, res) => carOwnerController.toggleStatus(req, res)
// );

// export default carOwnerRouter;

// Routers/Admin/carOwner.routes.js
// MODULE MAP: users.carOwners
//
// RESOLVED: the second jwtAuth stack flagged earlier was genuinely
// redundant now that jwtAuth (auth.middleware.js) handles StaffUser lookup
// directly — a single jwtAuth call already authenticates the staff user;
// removed the duplicate call.

import express from "express";

import CarOwnerController from "../../Controllers/Admin/carOwners.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { onboardCarOwnerUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/onboardCustomerImageUpload.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


const carOwnerRouter = express.Router();
const carOwnerController = new CarOwnerController();
carOwnerRouter.use(jwtAuth);

carOwnerRouter.get(
  "/",
  requireNavPermission("users", "carOwners", "view"),
  (req, res) => carOwnerController.getAllCarOwners(req, res)
);

carOwnerRouter.post(
  "/onboard",
  requireNavPermission("users", "carOwners", "create"),
  onboardCarOwnerUploadMiddleware,
  (req, res) => carOwnerController.onboardCarOwner(req, res)
);

carOwnerRouter.put(
  "/edit",
  requireNavPermission("users", "carOwners", "update"),
  onboardCarOwnerUploadMiddleware,
  (req, res) => carOwnerController.editCustomer(req, res)
);

carOwnerRouter.put(
  "/:userId/status/toggle",
  requireNavPermission("users", "carOwners", "update"),
  (req, res) => carOwnerController.toggleStatus(req, res)
);

export default carOwnerRouter;