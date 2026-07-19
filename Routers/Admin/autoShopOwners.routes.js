// import express from "express";
// const autoShopOwnersRouter = express.Router();


// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
// import AutoShopOwnerController from "../../Controllers/Admin/autoShopOwnerController.js";


// const autoShopOwnerController = new AutoShopOwnerController();
// // GET all auto shop owners
// autoShopOwnersRouter.get(
//   "/",
//   (req, res) => autoShopOwnerController.getAllAutoShopOwners(req, res)
// );

// // POST  — Create a new auto shop owner (Admin)
// // Body: { name, email, phone, countryCode, pincode, address? }
// autoShopOwnersRouter.post(
//   "/",
//   jwtAuth,
//   (req, res) => autoShopOwnerController.createAutoShopOwner(req, res)
// );

// // PUT  — Update an auto shop owner's profile (Admin)
// // Params: ownerId
// // Body (any subset): { name, email, phone, countryCode, pincode, address }
// autoShopOwnersRouter.put(
//   "/:ownerId",
//   jwtAuth,
//   (req, res) => autoShopOwnerController.updateAutoShopOwner(req, res)
// );

// // DELETE  — Soft-delete an auto shop owner (Admin)
// // Sets status="deleted", isDisabled=true, deactivates business profile
// // Params: ownerId
// autoShopOwnersRouter.delete(
//   "/:ownerId",
//   jwtAuth,
//   (req, res) => autoShopOwnerController.deleteAutoShopOwner(req, res)
// );

// // PUT  — Revive (restore) a soft-deleted auto shop owner (Admin)
// // Sets status="active", isDisabled=false, re-activates business profile
// // Params: ownerId
// // NOTE: This route MUST be declared BEFORE /:ownerId so Express does not treat "revive" as an ownerId value.
// autoShopOwnersRouter.put(
//   "/:ownerId/revive",
//   jwtAuth,
//   (req, res) => autoShopOwnerController.reviveAutoShopOwner(req, res)
// );

// // POST  — Enable / disable an auto shop owner + their business profile
// // Body: { userId: string, disable: boolean }
// autoShopOwnersRouter.post(
//   "/toggle-status",
//   (req, res) => autoShopOwnerController.toggleAutoShopOwnerStatus(req, res)
// );

// export default autoShopOwnersRouter;

// Routers/Admin/autoShopOwners.routes.js
// MODULE MAP: users.autoShopOwners
//
// RESOLVED: the second jwtAuth stack flagged earlier was genuinely
// redundant now that jwtAuth (auth.middleware.js) handles StaffUser lookup
// directly — a single jwtAuth call already authenticates the staff user;
// removed the duplicate call.

import express from "express";
const autoShopOwnersRouter = express.Router();

import AutoShopOwnerController from "../../Controllers/Admin/autoShopOwnerController.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


const autoShopOwnerController = new AutoShopOwnerController();
autoShopOwnersRouter.use(jwtAuth);

autoShopOwnersRouter.get(
  "/",
  requireNavPermission("users", "autoShopOwners", "view"),
  (req, res) => autoShopOwnerController.getAllAutoShopOwners(req, res)
);

autoShopOwnersRouter.post(
  "/",
  requireNavPermission("users", "autoShopOwners", "create"),
  (req, res) => autoShopOwnerController.createAutoShopOwner(req, res)
);

autoShopOwnersRouter.put(
  "/:ownerId",
  requireNavPermission("users", "autoShopOwners", "update"),
  (req, res) => autoShopOwnerController.updateAutoShopOwner(req, res)
);

autoShopOwnersRouter.delete(
  "/:ownerId",
  requireNavPermission("users", "autoShopOwners", "delete"),
  (req, res) => autoShopOwnerController.deleteAutoShopOwner(req, res)
);

// MUST stay before /:ownerId so Express doesn't treat "revive" as an ownerId.
autoShopOwnersRouter.put(
  "/:ownerId/revive",
  requireNavPermission("users", "autoShopOwners", "update"),
  (req, res) => autoShopOwnerController.reviveAutoShopOwner(req, res)
);

autoShopOwnersRouter.post(
  "/toggle-status",
  requireNavPermission("users", "autoShopOwners", "update"),
  (req, res) => autoShopOwnerController.toggleAutoShopOwnerStatus(req, res)
);

export default autoShopOwnersRouter;