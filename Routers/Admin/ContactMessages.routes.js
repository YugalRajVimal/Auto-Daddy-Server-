// import express from "express";

// import {
//   getContactMessages,
//   getContactMessageById,
//   updateContactMessageStatus,
//   deleteContactMessage,
// } from "../../Controllers/Admin/ ContactMessages.controller.js";
// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
// import { requireNavPermission } from "../../middlewares/Permission.middleware.js";

// const contactMessagesRouter = express.Router();
// contactMessagesRouter.use(jwtAuth);

// // Reuses the "leads" permission module (Website Messages lives under the
// // Leads nav item — see src/config/adminNav.ts / constants/permissionModules.js).
// contactMessagesRouter.get("/", requireNavPermission("leads", "websiteMessages", "view"), getContactMessages);
// contactMessagesRouter.get("/:id", requireNavPermission("leads", "websiteMessages", "view"), getContactMessageById);
// contactMessagesRouter.patch("/:id", requireNavPermission("leads", "websiteMessages", "update"), updateContactMessageStatus);
// contactMessagesRouter.delete("/:id", requireNavPermission("leads", "websiteMessages", "delete"), deleteContactMessage);

// export default contactMessagesRouter;

import express from "express";

import {
  getContactMessages,
  getContactMessageById,
  updateContactMessageStatus,
  deleteContactMessage,
} from "../../Controllers/Admin/ ContactMessages.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Auth/permission.middleware.js";

const contactMessagesRouter = express.Router();
contactMessagesRouter.use(jwtAuth);

// Reuses the "leads" permission module (Website Messages lives under the
// Leads nav item — see src/config/adminNav.ts / constants/permissionModules.js).
contactMessagesRouter.get("/", requireNavPermission("leads", "websiteMessages", "view"), getContactMessages);
contactMessagesRouter.get("/:id", requireNavPermission("leads", "websiteMessages", "view"), getContactMessageById);
contactMessagesRouter.patch("/:id", requireNavPermission("leads", "websiteMessages", "update"), updateContactMessageStatus);
contactMessagesRouter.delete("/:id", requireNavPermission("leads", "websiteMessages", "delete"), deleteContactMessage);

export default contactMessagesRouter;