// import express from "express";
// import {
//   createLead,
//   getLeads,
//   getLeadById,
//   editLead,
//   deleteLead,
// } from "../../Controllers/Admin/leads.controller.js";

// const leadsRouter = express.Router();

// // Create a new lead
// leadsRouter.post("/", createLead);

// // Get all leads
// leadsRouter.get("/", getLeads);

// // Get a single lead by ID
// leadsRouter.get("/:id", getLeadById);

// // Edit a lead
// leadsRouter.patch("/:id", editLead);

// // Delete a lead
// leadsRouter.delete("/:id", deleteLead);

// export default leadsRouter;

// routes for leads
import express from "express";

import {
  createLead,
  getLeads,
  getLeadById,
  editLead,
  deleteLead,
} from "../../Controllers/Admin/leads.controller.js";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";

const leadsRouter = express.Router();

leadsRouter.post("/", upload.single("leadImage"), createLead);
leadsRouter.get("/", getLeads);
leadsRouter.get("/:id", getLeadById);
leadsRouter.patch("/:id", upload.single("leadImage"), editLead);
leadsRouter.delete("/:id", deleteLead);

export default leadsRouter;