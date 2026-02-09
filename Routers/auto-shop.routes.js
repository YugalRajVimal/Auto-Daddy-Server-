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

// Route to fetch all master services (with subservices) for the platform (for auto shop use)
autoShopRouter.get(
  "/services",
  jwtAuth,
  (req, res) => autoShopController.fetchServices(req, res)
);


// Route to get all services and subservices in the current auto shop's business profile
autoShopRouter.get(
  "/my-services",
  jwtAuth,
  (req, res) => autoShopController.getAllMyServices(req, res)
);


// Route to add services (and subservices) to current auto shop's business profile
autoShopRouter.post(
  "/my-services",
  jwtAuth,
  (req, res) => autoShopController.addToMyServices(req, res)
);

// Route to remove services (and/or subservices) from current auto shop's business profile
autoShopRouter.delete(
  "/my-services",
  jwtAuth,
  (req, res) => autoShopController.removeFromMyServices(req, res)
);

// Deal routes for auto-shop business profile

// Create a new deal and link it to the business profile
autoShopRouter.post(
  "/my-deals",
  jwtAuth,
  (req, res) => autoShopController.createDeal(req, res)
);

// Edit an existing deal (only if created by the current business profile)
autoShopRouter.put(
  "/my-deals/:id",
  jwtAuth,
  (req, res) => autoShopController.editDeal(req, res)
);

// Delete a deal by ID (only if created by the current business profile)
autoShopRouter.delete(
  "/my-deals/:id",
  jwtAuth,
  (req, res) => autoShopController.deleteDeal(req, res)
);

// Fetch all deals for the current business profile
autoShopRouter.get(
  "/my-deals",
  jwtAuth,
  (req, res) => autoShopController.fetchMyDeals(req, res)
);

// Route to fetch Job Card Page for the current business
autoShopRouter.get(
  "/job-card-page",
  jwtAuth,
  (req, res) => autoShopController.fetchJobCardPage(req, res)
);


// Route to create a new JobCard for the auto shop owner
autoShopRouter.post(
  "/job-cards",
  jwtAuth,
  businessAndTeamUploadMiddleware,
  (req, res) => {
    console.log(req.body);
    autoShopController.createJobCard(req, res);
  }
);

// Route to fetch all JobCards for the current AutoShop owner (business)
autoShopRouter.get(
  "/job-cards",
  jwtAuth,
  (req, res) => autoShopController.getAllJobCards(req, res)
);

// Route to fetch all payments for the current auto shop's business profile
autoShopRouter.get(
  "/payments",
  jwtAuth,
  (req, res) => autoShopController.getAllPayments(req, res)
);











export default autoShopRouter;
