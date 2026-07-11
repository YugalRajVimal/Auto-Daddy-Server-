import express from "express";

import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { vehicleUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/vehicleUpload.middleware.js";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import { carOwnerUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/carOwnerUploadMiddleware.js";
import HomeProfileController from "../../Controllers/CarOwner/homeProfile.controller.js";
import VehicleController from "../../Controllers/CarOwner/vehicle.controller.js";
import JobCardController from "../../Controllers/CarOwner/jobCard.controller.js";
import AutoShopController from "../../Controllers/CarOwner/autoShop.controller.js";
import DocumentController from "../../Controllers/CarOwner/document.controller.js";
import MiscController from "../../Controllers/CarOwner/misc.controller.js";

const userRouter = express.Router();

const homeProfileController = new HomeProfileController();
const vehicleController = new VehicleController();
const jobCardController = new JobCardController();
const autoShopController = new AutoShopController();
const documentController = new DocumentController();
const miscController = new MiscController();

// -------- HOME / PROFILE --------

// Route to get dashboard details (dashboard content + user profile + upcoming service)
userRouter.get("/dashboard", jwtAuth, (req, res) => { homeProfileController.getDashboardsDetails(req, res) });

// Route to complete user profile (for car owners)
userRouter.put("/complete-profile", jwtAuth, (req, res) => { homeProfileController.completeProfile(req, res) });
userRouter.get("/profile", jwtAuth, (req, res) => { homeProfileController.getProfileDetails(req, res) });
// Route to edit/update user profile (for car owners)
userRouter.put("/edit-profile", jwtAuth, upload.single('profilePhoto'), (req, res) => { homeProfileController.editProfile(req, res) });

// -------- AUTO SHOP FAVORITES / LISTING / RATING / DEALS --------

userRouter.post("/toggle-auto-shop-fav", jwtAuth, (req, res) => { autoShopController.toggleAutoShopFav(req, res) });
userRouter.get("/favorite-auto-shops", jwtAuth, (req, res) => { autoShopController.getFavAutoShops(req, res) });

// -------- VEHICLE CRUD ROUTES --------

// Route to fetch car companies (with optional companyName search)
userRouter.get("/car-companies", (req, res) => {
  vehicleController.fetchCarCompanies(req, res);
});

// Add a new vehicle
userRouter.post(
  "/vehicle",
  jwtAuth,
  vehicleUploadMiddleware,
  (req, res) => {
    vehicleController.addVehicle(req, res);
  }
);

// Edit/update a vehicle
userRouter.put(
  "/vehicle/:vehicleId",
  jwtAuth,
  vehicleUploadMiddleware,
  (req, res) => {
    vehicleController.editVehicle(req, res);
  }
);

// Fetch all vehicles for the authenticated user (car owner)
userRouter.get("/vehicles", jwtAuth, (req, res) => { vehicleController.fetchAllVehicles(req, res) });

// Delete a vehicle by ID for the authenticated user
userRouter.delete(
  "/vehicle",
  jwtAuth,
  (req, res) => {
    vehicleController.deleteVehicle(req, res);
  }
);

// Route to get all deals (public endpoint)
userRouter.get("/deals", jwtAuth, (req, res) => { autoShopController.getAllDeals(req, res) });

// Route to get all auto shops (public endpoint)
userRouter.get("/auto-shops", jwtAuth, (req, res) => { autoShopController.getAllAutoShops(req, res) });

// Route to rate an auto shop (POST: autoShopId, rating [1-5] in body)
userRouter.post("/rate-auto-shop", jwtAuth, (req, res) => {
  autoShopController.rateAutoShop(req, res);
});

// -------- JOB CARDS --------

// Fetch all job cards for the authenticated user (car owner)
userRouter.get("/job-cards", jwtAuth, (req, res) => { jobCardController.getAllJobCards(req, res) });

// Approve a job card (customer approves it)
userRouter.post("/job-cards/:jobCardId/approve", jwtAuth, (req, res) => {
  jobCardController.approveJobCard(req, res);
});

// Reject a job card (customer rejects it)
userRouter.post("/job-cards/:jobCardId/reject", jwtAuth, (req, res) => {
  jobCardController.rejectJobCard(req, res);
});

// Route to fetch Canadian cities (search or paginated)
userRouter.get("/cities", (req, res) => {
  miscController.fetchCities(req, res);
});

// ---- CAR OWNER DOCUMENTS ROUTES ----

// Upto 5 documents per user - Managed by addCarOwnerDocument controller

// Upload/add a car owner document (image as base64, name in body)
// Upload/add one or more car owner document(s) (images as base64, name(s) in body)
// Accepts up to 5 files per user, via .array middleware
// userRouter.post(
//   "/documents",
//   jwtAuth,
//   carOwnerUploadMiddleware ,
//   (req, res) => documentController.addCarOwnerDocument(req, res)
// );

// // Edit a car owner document's name by its index in the documents array
// userRouter.put(
//   "/documents/:docIdx",
//   jwtAuth,
//   (req, res) => documentController.editCarOwnerDocument(req, res)
// );

// // Delete a car owner document by index
// userRouter.delete(
//   "/documents/:docIdx",
//   jwtAuth,
//   (req, res) => documentController.deleteCarOwnerDocument(req, res)
// );

// // Get all car owner documents (names and base64 image) for the authenticated user
// userRouter.get(
//   "/documents",
//   jwtAuth,
//   (req, res) => documentController.getCarOwnerDocuments(req, res)
// );

// Toggle like/unlike for Thought of the Day (user)
userRouter.post(
  "/thought-of-the-day/toggle-like",
  jwtAuth,
  (req, res) => miscController.toggleThoughtOfTheDayLiked(req, res)
);

// Get odometerReading and dueOdometerReading for all vehicles owned by the user
userRouter.get(
  "/odometer-readings",
  jwtAuth,
  (req, res) => vehicleController.getVehiclesOdometerReadings(req, res)
);

// Edit/update odometerReading using vehicle plate number
userRouter.put(
  "/odometer",
  jwtAuth,
  (req, res) => vehicleController.editOdometerById(req, res)
);

// Discard a deal for the authenticated user
userRouter.post(
  "/discard-deal",
  jwtAuth,
  (req, res) => autoShopController.discardDeal(req, res)
);

// Upload documents for a vehicle (car owner) - any of 5 files per vehicle
userRouter.post(
  "/documents",
  jwtAuth,
  vehicleUploadMiddleware,
  (req, res) => documentController.uploadDocuments(req, res)
);

// Edit a specific car owner document (replace any images for that docIdx)
// userRouter.put(
//   "/documents/:vehicleId",
//   jwtAuth,
//   vehicleUploadMiddleware,
//   (req, res) => documentController.editDocument(req, res)
// );

// Get all uploaded vehicle documents for the authenticated user
userRouter.get(
  "/documents",
  jwtAuth,
  (req, res) => documentController.getUploadedDocuments(req, res)
);

// Connect to AutoShopOwner: Send push notification to shop owner for a connection request
userRouter.post(
  "/connect-autoshopowner",
  jwtAuth,
  (req, res) => autoShopController.connectToAutoShopOwner(req, res)
);

export default userRouter;