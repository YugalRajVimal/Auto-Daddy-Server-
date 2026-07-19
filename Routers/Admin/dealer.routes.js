// import express from "express";
// import { dealerImageUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/dealerImageUpload.middleware.js";
// import DealerController from "../../Controllers/Admin/dealer.controller.js";

// const dealerRouter = express.Router();
// const dealerController = new DealerController();

// dealerRouter.post(
//   "/",
//   dealerImageUploadMiddleware,
//   (req, res) => dealerController.addDealer(req, res)
// );

// dealerRouter.patch(
//   "/:id",
//   dealerImageUploadMiddleware,
//   (req, res) => dealerController.editDealer(req, res)
// );

// dealerRouter.get("/", (req, res) => dealerController.fetchDealers(req, res));
// dealerRouter.get("/:id", (req, res) => dealerController.fetchDealerById(req, res));
// dealerRouter.delete("/:id", (req, res) => dealerController.deleteDealer(req, res));

// export default dealerRouter;

// Routers/Admin/dealer.routes.js
// MODULE MAP: users.dealers

import express from "express";
import { dealerImageUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/dealerImageUpload.middleware.js";
import DealerController from "../../Controllers/Admin/dealer.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


const dealerRouter = express.Router();
const dealerController = new DealerController();
dealerRouter.use(jwtAuth);

dealerRouter.post(
  "/",
  requireNavPermission("users", "dealers", "create"),
  dealerImageUploadMiddleware,
  (req, res) => dealerController.addDealer(req, res)
);

dealerRouter.patch(
  "/:id",
  requireNavPermission("users", "dealers", "update"),
  dealerImageUploadMiddleware,
  (req, res) => dealerController.editDealer(req, res)
);

dealerRouter.get("/", requireNavPermission("users", "dealers", "view"), (req, res) => dealerController.fetchDealers(req, res));
dealerRouter.get("/:id", requireNavPermission("users", "dealers", "view"), (req, res) => dealerController.fetchDealerById(req, res));
dealerRouter.delete("/:id", requireNavPermission("users", "dealers", "delete"), (req, res) => dealerController.deleteDealer(req, res));

export default dealerRouter;