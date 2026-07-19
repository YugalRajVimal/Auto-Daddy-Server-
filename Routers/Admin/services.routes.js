// // import express from "express";
// // import ServicesController from "../../Controllers/Admin/services.controller.js";

// // const servicesRouter = express.Router();
// // const servicesController = new ServicesController();

// // // Add a new service
// // servicesRouter.post("/", (req, res) => servicesController.addService(req, res));

// // // Edit (update) a service by ID
// // servicesRouter.put("/:id", (req, res) => servicesController.editService(req, res));

// // // Delete a service by ID
// // servicesRouter.delete("/:id", (req, res) => servicesController.deleteService(req, res));

// // // Fetch all services, with optional shopType filter
// // servicesRouter.get("/", (req, res) => servicesController.fetchServices(req, res));

// // export default servicesRouter;

// // Routers/Admin/services.routes.js
// // MODULE MAP: services.services (also covers services.subServices —
// // subServices is an embedded array field on the Services document,
// // created/edited/deleted through these SAME addService/editService calls,
// // not a separate collection or endpoint. There is no independent
// // create/update/delete for a sub-service outside of editing its parent
// // Service document, so a separate permission check isn't meaningful here;
// // services.services governs both.
// //
// // services.carBrands has no distinct backend endpoint — car brand/company
// // data is served by carCompany.routes.js (see carCompanies.carCompanies
// // mapping in that file).

// import express from "express";
// import ServicesController from "../../Controllers/Admin/services.controller.js";
// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
// import { requireNavPermission } from "../../middlewares/Auth/permission.middleware.js";

// const servicesRouter = express.Router();
// const servicesController = new ServicesController();
// servicesRouter.use(jwtAuth);

// servicesRouter.post("/", requireNavPermission("services", "services", "create"), (req, res) => servicesController.addService(req, res));
// servicesRouter.put("/:id", requireNavPermission("services", "services", "update"), (req, res) => servicesController.editService(req, res));
// servicesRouter.delete("/:id", requireNavPermission("services", "services", "delete"), (req, res) => servicesController.deleteService(req, res));
// servicesRouter.get("/", requireNavPermission("services", "services", "view"), (req, res) => servicesController.fetchServices(req, res));

// export default servicesRouter;

// Routers/Admin/services.routes.js
// MODULE MAP: services.services (also covers services.subServices —
// subServices is an embedded array field on the Services document,
// created/edited/deleted through these SAME addService/editService calls,
// not a separate collection or endpoint. There is no independent
// create/update/delete for a sub-service outside of editing its parent
// Service document, so a separate permission check isn't meaningful here;
// services.services governs both.
//
// services.carBrands has no distinct backend endpoint — car brand/company
// data is served by carCompany.routes.js (see carCompanies.carCompanies
// mapping in that file).

import express from "express";
import ServicesController from "../../Controllers/Admin/services.controller.js";
import { requireNavPermission, staffAuth } from "../../middlewares/Permission.middleware.js"
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";


const servicesRouter = express.Router();
const servicesController = new ServicesController();
servicesRouter.use(jwtAuth);

servicesRouter.post("/", requireNavPermission("services", "services", "create"), (req, res) => servicesController.addService(req, res));
servicesRouter.put("/:id", requireNavPermission("services", "services", "update"), (req, res) => servicesController.editService(req, res));
servicesRouter.delete("/:id", requireNavPermission("services", "services", "delete"), (req, res) => servicesController.deleteService(req, res));
servicesRouter.get("/", requireNavPermission("services", "services", "view"), (req, res) => servicesController.fetchServices(req, res));

export default servicesRouter;