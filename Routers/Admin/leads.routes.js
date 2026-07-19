

import express from "express";

import {
  createLead,
  getLeads,
  getLeadById,
  editLead,
  deleteLead,
} from "../../Controllers/Admin/leads.controller.js";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


const leadsRouter = express.Router();
leadsRouter.use(jwtAuth);

import { getAssociatesStaffUser } from "../../Controllers/Admin/leads.controller.js";

// Endpoint to fetch all associates staff users (for assignment, autocomplete, etc.)
leadsRouter.get("/associates", requireNavPermission("leads", "allLeads", "view"), getAssociatesStaffUser);
leadsRouter.post("/", requireNavPermission("leads", "allLeads", "create"), upload.single("leadImage"), createLead);
leadsRouter.get("/", requireNavPermission("leads", "allLeads", "view"), getLeads);
leadsRouter.get("/:id", requireNavPermission("leads", "allLeads", "view"), getLeadById);
leadsRouter.patch("/:id", requireNavPermission("leads", "allLeads", "update"), upload.single("leadImage"), editLead);
leadsRouter.delete("/:id", requireNavPermission("leads", "allLeads", "delete"), deleteLead);

export default leadsRouter;