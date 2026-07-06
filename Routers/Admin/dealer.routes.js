import express from "express";
import { dealerImageUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/dealerImageUpload.middleware.js";
import DealerController from "../../Controllers/Admin/dealer.controller.js";

const dealerRouter = express.Router();
const dealerController = new DealerController();

dealerRouter.post(
  "/",
  dealerImageUploadMiddleware,
  (req, res) => dealerController.addDealer(req, res)
);

dealerRouter.patch(
  "/:id",
  dealerImageUploadMiddleware,
  (req, res) => dealerController.editDealer(req, res)
);

dealerRouter.get("/", (req, res) => dealerController.fetchDealers(req, res));
dealerRouter.get("/:id", (req, res) => dealerController.fetchDealerById(req, res));
dealerRouter.delete("/:id", (req, res) => dealerController.deleteDealer(req, res));

export default dealerRouter;