import express from "express";
import AutoShopController from "../Controllers/AutoShops/auto-shop.controller.js";



const autoShopRouter = express.Router();


const autoShopController = new AutoShopController();

// Route to get all auto shops
autoShopRouter.get("/", (req, res) => autoShopController.getAllAutoShops(req, res));


export default autoShopRouter;
