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

// Add a new city
adminRouter.post(
  "/cities",
  (req, res) => adminController.addCity(req, res)
);

// Fetch all cities
adminRouter.get(
  "/cities",
  (req, res) => adminController.fetchCities(req, res)
);

// Edit a city by ID
adminRouter.patch(
  "/cities/:id",
  (req, res) => adminController.editCity(req, res)
);

// Delete a city by ID
adminRouter.delete(
  "/cities/:id",
  (req, res) => adminController.deleteCity(req, res)
);


// -----------------------------
// Ads CRUD Endpoints



// Get all ads
adminRouter.get(
  "/ads",
  (req, res) => adminController.getAllAds(req, res)
);

// Create a new ad (with image upload)
adminRouter.post(
  "/ads",
  adsUploadMiddleware,
  (req, res) => adminController.createAd(req, res)
);

// Edit an ad by ID (with optional image upload)
adminRouter.patch(
  "/ads/:id",
  adsUploadMiddleware,
  (req, res) => adminController.editAd(req, res)
);

// Delete an ad by ID
adminRouter.delete(
  "/ads/:id",
  (req, res) => adminController.deleteAd(req, res)
);

// Get all currently running deals (whose offerEndsOnDate is in the future)
adminRouter.get(
  "/deals/running",
  (req, res) => adminController.getAllRunningDeals(req, res)
);








export default adminRouter;
