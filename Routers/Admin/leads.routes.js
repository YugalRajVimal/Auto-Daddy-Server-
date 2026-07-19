// // import express from "express";
// // import {
// //   createLead,
// //   getLeads,
// //   getLeadById,
// //   editLead,
// //   deleteLead,
// // } from "../../Controllers/Admin/leads.controller.js";

// // const leadsRouter = express.Router();

// // // Create a new lead
// // leadsRouter.post("/", createLead);

// // // Get all leads
// // leadsRouter.get("/", getLeads);

// // // Get a single lead by ID
// // leadsRouter.get("/:id", getLeadById);

// // // Edit a lead
// // leadsRouter.patch("/:id", editLead);

// // // Delete a lead
// // leadsRouter.delete("/:id", deleteLead);

// // export default leadsRouter;

// // routes for leads
// import express from "express";

// import {
//   createLead,
//   getLeads,
//   getLeadById,
//   editLead,
//   deleteLead,
// } from "../../Controllers/Admin/leads.controller.js";
// import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";

// const leadsRouter = express.Router();

// leadsRouter.post("/", upload.single("leadImage"), createLead);
// leadsRouter.get("/", getLeads);
// leadsRouter.get("/:id", getLeadById);
// leadsRouter.patch("/:id", upload.single("leadImage"), editLead);
// leadsRouter.delete("/:id", deleteLead);

// export default leadsRouter;


// Routers/Admin/leads.routes.js
// MODULE MAP: leads.allLeads
//
// NOTE: Visited/Completed leads (leads.visitedLeads, leads.completedLeads)
// are frontend-only filtered views of the same underlying data — there's
// no separate backend endpoint for them, so there's nothing to gate
// differently here. If you want SubAdmins to view "All Leads" but not
// "Completed Leads" as genuinely different permissions, the controller
// would need a status query param check against a different permission
// key — flag if that's actually needed.

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

leadsRouter.post("/", requireNavPermission("leads", "allLeads", "create"), upload.single("leadImage"), createLead);
leadsRouter.get("/", requireNavPermission("leads", "allLeads", "view"), getLeads);
leadsRouter.get("/:id", requireNavPermission("leads", "allLeads", "view"), getLeadById);
leadsRouter.patch("/:id", requireNavPermission("leads", "allLeads", "update"), upload.single("leadImage"), editLead);
leadsRouter.delete("/:id", requireNavPermission("leads", "allLeads", "delete"), deleteLead);

export default leadsRouter;