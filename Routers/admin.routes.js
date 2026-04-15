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

// Vehicle Type endpoints
adminRouter.get("/vehicletypes", (req, res) => adminController.fetchVehicleTypes(req, res));
adminRouter.post("/vehicletypes", (req, res) => adminController.addVehicleType(req, res));
adminRouter.put("/vehicletypes/:id", (req, res) => adminController.updateVehicleType(req, res));
adminRouter.delete("/vehicletypes/:id", (req, res) => adminController.deleteVehicleType(req, res));


// Create a new website template
adminRouter.post(
  "/website-templates",
  (req, res) => adminController.createWebsiteTemplate(req, res)
);

// Edit an existing website template by ID
adminRouter.put(
  "/website-templates/:id",
  (req, res) => adminController.editWebsiteTemplate(req, res)
);

// Delete a website template by ID
adminRouter.delete(
  "/website-templates/:id",
  (req, res) => adminController.deleteWebsiteTemplate(req, res)
);

// Fetch all website templates
adminRouter.get(
  "/website-templates",
  (req, res) => adminController.fetchWebsiteTemplates(req, res)
);



export default adminRouter;
