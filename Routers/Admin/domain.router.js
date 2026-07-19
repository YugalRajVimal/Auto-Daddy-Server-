// import express from "express";
// import {
//   addDomain,
//   editDomain,
//   getDomains,
//   getDomainById,
//   deleteDomain,
// } from "../../Controllers/Admin/domain.controller.js";

// const domainRouter = express.Router();

// domainRouter.post("/", addDomain);
// domainRouter.get("/", getDomains);
// domainRouter.get("/:id", getDomainById);
// domainRouter.patch("/:id", editDomain);
// domainRouter.delete("/:id", deleteDomain);

// export default domainRouter;

// Routers/Admin/domain.router.js
// MODULE MAP: domain.domainManager

import express from "express";
import {
  addDomain,
  editDomain,
  getDomains,
  getDomainById,
  deleteDomain,
} from "../../Controllers/Admin/domain.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


const domainRouter = express.Router();
domainRouter.use(jwtAuth);

domainRouter.post("/", requireNavPermission("domain", "domainManager", "create"), addDomain);
domainRouter.get("/", requireNavPermission("domain", "domainManager", "view"), getDomains);
domainRouter.get("/:id", requireNavPermission("domain", "domainManager", "view"), getDomainById);
domainRouter.patch("/:id", requireNavPermission("domain", "domainManager", "update"), editDomain);
domainRouter.delete("/:id", requireNavPermission("domain", "domainManager", "delete"), deleteDomain);

export default domainRouter;