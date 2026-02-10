import express from "express";
import AdminController from "../Controllers/Admin/admin.controller.js";


const adminRouter = express.Router();


const adminController = new AdminController();


adminRouter.get("/", (req, res) => {
  res.send("Welcome to Auto Daddy Admin APIs");
});

// Admin dashboard stats endpoint
adminRouter.get("/dashboard", (req, res) => adminController.getDashboardDetails(req, res));





// Service endpoints
adminRouter.post("/services", (req, res) => adminController.addService(req, res));
adminRouter.get("/services", (req, res) => adminController.fetchServices(req, res));
adminRouter.put("/services/:id", (req, res) => adminController.editService(req, res));
adminRouter.delete("/services/:id", (req, res) => adminController.deleteService(req, res));

// Get all car owners (with job cards & populated vehicles/shops)
adminRouter.get("/carowners", (req, res) => adminController.getAllCarOwners(req, res));

// Get all auto shop owners
adminRouter.get("/autoshopowners", (req, res) => adminController.getAllAutoShopOwners(req, res));



export default adminRouter;
