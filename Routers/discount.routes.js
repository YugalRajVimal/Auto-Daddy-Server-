import express from "express";

import jwtAuth from "../middlewares/Auth/auth.middleware.js";
import DiscountController from "../Controllers/Discount/discount.controller.js";

const discountRouter = express.Router();

const discountController = new DiscountController();

// Route to fetch all discounts
discountRouter.get("/", jwtAuth, (req, res) => {
  discountController.fetchAllDisocunts(req, res);
});

export default discountRouter;
