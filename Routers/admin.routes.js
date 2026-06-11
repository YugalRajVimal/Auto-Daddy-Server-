import express from "express";
import AdminController from "../Controllers/Admin/admin.controller.js";
import { brandLogoUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
import { adsUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/adsUpload.middleware.js";


const adminRouter = express.Router();


const adminController = new AdminController();


adminRouter.get("/", (req, res) => {
  res.send("Welcome to Auto Daddy Admin APIs");
});

// Admin dashboard stats endpoint
adminRouter.get("/dashboard", (req, res) => adminController.getDashboardDetails(req, res));





// Service endpoints
adminRouter.post("/services", (req, res) => adminController.addService(req, res));
adminRouter.get("/services", (req, res) => adminController.fetchServices(req, res));
adminRouter.put("/services/:id", (req, res) => adminController.editService(req, res));
adminRouter.delete("/services/:id", (req, res) => adminController.deleteService(req, res));


// Get all car owners (with job cards & populated vehicles/shops)
adminRouter.get("/carowners", (req, res) => adminController.getAllCarOwners(req, res));

// Get all auto shop owners
adminRouter.get("/autoshopowners", (req, res) => adminController.getAllAutoShopOwners(req, res));

// Enable or disable an AutoShopOwner (and their linked businessProfile)
adminRouter.post("/autoshopowners/toggle-status", (req, res) => adminController.toggleAutoShopOwnerStatus(req, res));


// Vehicle Type endpoints
adminRouter.get("/vehicletypes", (req, res) => adminController.fetchVehicleTypes(req, res));
adminRouter.post("/vehicletypes", (req, res) => adminController.addVehicleType(req, res));
adminRouter.put("/vehicletypes/:id", (req, res) => adminController.updateVehicleType(req, res));
adminRouter.delete("/vehicletypes/:id", (req, res) => adminController.deleteVehicleType(req, res));


// Create a new website template
adminRouter.post(
  "/website-templates",
  (req, res) => adminController.createWebsiteTemplate(req, res)
);

// Edit an existing website template by ID
adminRouter.put(
  "/website-templates/:id",
  (req, res) => adminController.editWebsiteTemplate(req, res)
);

// Delete a website template by ID
adminRouter.delete(
  "/website-templates/:id",
  (req, res) => adminController.deleteWebsiteTemplate(req, res)
);

// Fetch all website templates
adminRouter.get(
  "/website-templates",
  (req, res) => adminController.fetchWebsiteTemplates(req, res)
);

// Dashboard Data endpoints

// Upsert dashboard data (create or update)
adminRouter.post(
  "/dashboard-data",
  (req, res) => adminController.upsertDashboardData(req, res)
);

// Fetch dashboard data
adminRouter.get(
  "/dashboard-data",
  (req, res) => adminController.fetchDashboardData(req, res)
);

// Edit dashboard data (partial update)
adminRouter.patch(
  "/dashboard-data",
  (req, res) => adminController.editDashboardData(req, res)
);

// Delete dashboard data
adminRouter.delete(
  "/dashboard-data",
  (req, res) => adminController.deleteDashboardData(req, res)
);

// Car Company CRUD endpoints



adminRouter.post(
  "/car-company",
  brandLogoUploadMiddleware,
  (req, res) => adminController.addCarCompany(req, res)
);

// Edit a car company by ID (with brandLogo image upload support)
adminRouter.patch(
  "/car-company/:id",
  brandLogoUploadMiddleware,
  (req, res) => adminController.editCarCompany(req, res)
);

// Fetch all car companies, or filter by companyName
adminRouter.get(
  "/car-company",
  (req, res) => adminController.fetchCarCompanies(req, res)
);



// Delete a car company by ID
adminRouter.delete(
  "/car-company/:id",
  (req, res) => adminController.deleteCarCompany(req, res)
);

// Fetch website page list for businesses, with subscription info
adminRouter.get(
  "/website-page",
  (req, res) => adminController.getWebsitePage(req, res)
);

// --- Cities CRUD Endpoints ---

// --- Provinces & Cities within Provinces ---
// Province CRUD

// Add a new province
adminRouter.post(
  "/provinces",
  (req, res) => adminController.addProvince(req, res)
);

// Fetch all provinces and their cities
adminRouter.get(
  "/provinces",
  (req, res) => adminController.fetchProvinces(req, res)
);

// Edit a province by ID
adminRouter.patch(
  "/provinces/:provinceId",
  (req, res) => adminController.editProvince(req, res)
);

// Delete a province by ID
adminRouter.delete(
  "/provinces/:provinceId",
  (req, res) => adminController.deleteProvince(req, res)
);

// --- Cities CRUD within province ---

// Add a city to a province
adminRouter.post(
  "/provinces/:provinceId/cities",
  (req, res) => adminController.addCity(req, res)
);

// Edit a city's name in a province (by city name, case-insensitive)
adminRouter.patch(
  "/provinces/:provinceId/cities/:cityName",
  (req, res) => adminController.editCity(req, res)
);

// Delete a city from a province (by city name, case-insensitive)
adminRouter.delete(
  "/provinces/:provinceId/cities/:cityName",
  (req, res) => adminController.deleteCity(req, res)
);


// -----------------------------
// Ads CRUD Endpoints



// ------------- BUSINESS PROFILE ADS (business-specific ads under a profile) -------------

// Get all ads for a specific business profile
adminRouter.get(
  "/business-profiles/:businessId/ads",
  (req, res) => adminController.getAllBusinessAds(req, res)
);

// Create (add) a new ad to a specific business profile (with image upload)
adminRouter.post(
  "/business-profiles/:businessId/ads",
  adsUploadMiddleware,
  (req, res) => adminController.createBusinessAd(req, res)
);

// Edit an ad in a business profile by adId (with optional image upload)
adminRouter.patch(
  "/business-profiles/:businessId/ads/:adId",
  adsUploadMiddleware,
  (req, res) => adminController.editBusinessAd(req, res)
);

// Delete an ad by adId from a specific business profile
adminRouter.delete(
  "/business-profiles/:businessId/ads/:adId",
  (req, res) => adminController.deleteBusinessAd(req, res)
);

// Get all currently running deals (whose offerEndsOnDate is in the future)
adminRouter.get(
  "/deals/running",
  (req, res) => adminController.getAllRunningDeals(req, res)
);




// Get job card payments details (with optional filtering/search)
// Route: GET /admin/job-cards/payments
adminRouter.get(
  "/job-cards/payments",
  (req, res) => adminController.getAllPaymentDetailsOfAllJobCards(req, res)
);


// Send a custom push notification to a specific user
// Route: POST /admin/notification/custom/send
adminRouter.post(
  "/notification/custom/send",
  (req, res) => adminController.sendCustomNotificationToUser(req, res)
);

// Route: GET /admin/invite-help
// Get all InviteHelp documents sent to Admin, populate user and businessProfile, optionally filter by serviceId
adminRouter.get(
  "/invite-help",
  (req, res) => adminController.getInviteHelpToAdmin(req, res)
);





export default adminRouter;
