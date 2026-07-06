import express from "express";
import ServicesController from "../../Controllers/Admin/services.controller.js";

const servicesRouter = express.Router();
const servicesController = new ServicesController();

// Add a new service
servicesRouter.post("/", (req, res) => servicesController.addService(req, res));

// Edit (update) a service by ID
servicesRouter.put("/:id", (req, res) => servicesController.editService(req, res));

// Delete a service by ID
servicesRouter.delete("/:id", (req, res) => servicesController.deleteService(req, res));

// Fetch all services, with optional shopType filter
servicesRouter.get("/", (req, res) => servicesController.fetchServices(req, res));

export default servicesRouter;