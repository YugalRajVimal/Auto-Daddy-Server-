import express from "express";
import {
  createLead,
  getLeads,
  getLeadById,
  editLead,
  deleteLead,
} from "../../Controllers/Admin/leads.controller.js";

const leadsRouter = express.Router();

// Create a new lead
leadsRouter.post("/", createLead);

// Get all leads
leadsRouter.get("/", getLeads);

// Get a single lead by ID
leadsRouter.get("/:id", getLeadById);

// Edit a lead
leadsRouter.patch("/:id", editLead);

// Delete a lead
leadsRouter.delete("/:id", deleteLead);

export default leadsRouter;