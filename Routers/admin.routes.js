import express from "express";
import AdminController from "../Controllers/Admin/admin.controller.js";


const adminRouter = express.Router();


const adminController = new AdminController();


adminRouter.get("/", (req, res) => {
  res.send("Welcome to Auto Daddy Admin APIs");
});




// Service endpoints
adminRouter.post("/services", (req, res) => adminController.addService(req, res));
adminRouter.get("/services", (req, res) => adminController.fetchServices(req, res));
adminRouter.put("/services/:id", (req, res) => adminController.editService(req, res));
adminRouter.delete("/services/:id", (req, res) => adminController.deleteService(req, res));


export default adminRouter;
