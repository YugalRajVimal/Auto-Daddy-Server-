import express from "express";
import AutoShopController from "../Controllers/AutoShops/auto-shop.controller.js";



const autoShopRouter = express.Router();


const autoShopController = new AutoShopController();

// Route to get all auto shops
autoShopRouter.get("/", (req, res) => autoShopController.getAllAutoShops(req, res));

// Route to complete (create/update) business profile for autoshopowner (with multer support for uploads)
import jwtAuth from "../middlewares/Auth/auth.middleware.js";
import { upload } from "../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import { businessAndTeamUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/bussinessUpload.middleware.js";

//Profiles APIS
// Route to get the current autoshopowner's business profile (protected, requires JWT)
autoShopRouter.get(
  "/profile",
  jwtAuth,
  (req, res) => autoShopController.getProfile(req, res)
);

// Route to edit/update the current autoshopowner's user profile
autoShopRouter.put(
  "/edit-profile",
  jwtAuth,
  (req, res) => autoShopController.editProfile(req, res)
);



autoShopRouter.put(
  "/complete-business-profile",
  jwtAuth,
  businessAndTeamUploadMiddleware,
  (req, res) => autoShopController.completeBusinessProfile(req, res)
);


// Route to edit (update) the business profile for the autoshopowner (with multer support for uploads)
autoShopRouter.put(
  "/edit-business-profile",
  jwtAuth,
  businessAndTeamUploadMiddleware,
  (req, res) => autoShopController.editBusinessProfile(req, res)
);

// Team Members APIs

// Add a team member (with optional photo upload)
autoShopRouter.post(
  "/team-members",
  jwtAuth,
  businessAndTeamUploadMiddleware,
  (req, res) => autoShopController.addTeamMember(req, res)
);

// Fetch all team members
autoShopRouter.get(
  "/team-members",
  jwtAuth,
  (req, res) => autoShopController.fetchTeamMembers(req, res)
);

// Delete a team member by ID
autoShopRouter.delete(
  "/team-members/:memberId",
  jwtAuth,
  (req, res) => autoShopController.deleteTeamMember(req, res)
);

// Edit/update a team member by ID (with optional new photo)
autoShopRouter.put(
  "/team-members/:memberId",
  jwtAuth,
  upload.single("teamMemberPhoto"),
  (req, res) => autoShopController.editTeamMember(req, res)
);


// Route to search car owners by name, phone, or email (for auto shop owners/managers)
autoShopRouter.get(
  "/search-carowner",
  jwtAuth,
  (req, res) => autoShopController.searchCarOwner(req, res)
);

// Route to add a car owner to the autoshopowner's myCustomers list
autoShopRouter.post(
  "/my-customers",
  jwtAuth,
  (req, res) => autoShopController.addToMyCustomers(req, res)
);


// Route to fetch the autoshopowner's myCustomers (list of carowners)
autoShopRouter.get(
  "/my-customers",
  jwtAuth,
  (req, res) => autoShopController.fetchMyCustomers(req, res)
);

// Route to remove a car owner from the autoshopowner's myCustomers list
autoShopRouter.delete(
  "/my-customers",
  jwtAuth,
  (req, res) => autoShopController.removeFromMyCustomers(req, res)
);


// Route to onboard (create) a new car owner from the auto shop panel (by the autoshop owner)
autoShopRouter.post(
  "/onboard-carowner",
  jwtAuth,
  (req, res) => autoShopController.onboardCarOwner(req, res)
);

// Route to verify onboarded car owner with OTP (for auto shop flow)
autoShopRouter.post(
  "/verify-onboarded-carowner",jwtAuth,
  (req, res) => autoShopController.verifyOnboardedCarowner(req, res)
);








export default autoShopRouter;
