// import express from "express";
// import AdminController from "../Controllers/Admin/admin.controller.js";
// import { brandLogoUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
// import { adsUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/adsUpload.middleware.js";
// import { subAdminManagementRouter } from "./subadmin.routes.js";
// import jwtAuth from "../middlewares/Auth/auth.middleware.js";
// import { onboardCarOwnerUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/onboardCustomerImageUpload.middleware.js";


// const adminRouter = express.Router();


// const adminController = new AdminController();



// // Mount subAdmin management routes under /admin/subadmins
// adminRouter.use("/subadmins", subAdminManagementRouter);



// adminRouter.get("/", (req, res) => {
//   res.send("Welcome to Auto Daddy Admin APIs");
// });

// // Admin dashboard stats endpoint
// adminRouter.get("/dashboard", (req, res) => adminController.getDashboardDetails(req, res));





// // Service endpoints
// adminRouter.post("/services", (req, res) => adminController.addService(req, res));
// adminRouter.get("/services", (req, res) => adminController.fetchServices(req, res));
// adminRouter.put("/services/:id", (req, res) => adminController.editService(req, res));
// adminRouter.delete("/services/:id", (req, res) => adminController.deleteService(req, res));


// // Get all car owners (with job cards & populated vehicles/shops)
// adminRouter.get("/carowners", (req, res) => adminController.getAllCarOwners(req, res));

// // Get all auto shop owners
// adminRouter.get("/autoshopowners", (req, res) => adminController.getAllAutoShopOwners(req, res));

// // Enable or disable an AutoShopOwner (and their linked businessProfile)
// adminRouter.post("/autoshopowners/toggle-status", (req, res) => adminController.toggleAutoShopOwnerStatus(req, res));


// // Vehicle Type endpoints
// adminRouter.get("/vehicletypes", (req, res) => adminController.fetchVehicleTypes(req, res));
// adminRouter.post("/vehicletypes", (req, res) => adminController.addVehicleType(req, res));
// adminRouter.put("/vehicletypes/:id", (req, res) => adminController.updateVehicleType(req, res));
// adminRouter.delete("/vehicletypes/:id", (req, res) => adminController.deleteVehicleType(req, res));


// // Create a new website template
// adminRouter.post(
//   "/website-templates",
//   (req, res) => adminController.createWebsiteTemplate(req, res)
// );

// // Edit an existing website template by ID
// adminRouter.put(
//   "/website-templates/:id",
//   (req, res) => adminController.editWebsiteTemplate(req, res)
// );

// // Delete a website template by ID
// adminRouter.delete(
//   "/website-templates/:id",
//   (req, res) => adminController.deleteWebsiteTemplate(req, res)
// );

// // Fetch all website templates
// adminRouter.get(
//   "/website-templates",
//   (req, res) => adminController.fetchWebsiteTemplates(req, res)
// );

// // Dashboard Data endpoints

// // Upsert dashboard data (create or update)
// adminRouter.post(
//   "/dashboard-data",
//   (req, res) => adminController.upsertDashboardData(req, res)
// );

// // Fetch dashboard data
// adminRouter.get(
//   "/dashboard-data",
//   (req, res) => adminController.fetchDashboardData(req, res)
// );

// // Edit dashboard data (partial update)
// adminRouter.patch(
//   "/dashboard-data",
//   (req, res) => adminController.editDashboardData(req, res)
// );

// // Delete dashboard data
// adminRouter.delete(
//   "/dashboard-data",
//   (req, res) => adminController.deleteDashboardData(req, res)
// );

// // Car Company CRUD endpoints



// adminRouter.post(
//   "/car-company",
//   brandLogoUploadMiddleware,
//   (req, res) => adminController.addCarCompany(req, res)
// );

// // Edit a car company by ID (with brandLogo image upload support)
// adminRouter.patch(
//   "/car-company/:id",
//   brandLogoUploadMiddleware,
//   (req, res) => adminController.editCarCompany(req, res)
// );

// // Fetch all car companies, or filter by companyName
// adminRouter.get(
//   "/car-company",
//   (req, res) => adminController.fetchCarCompanies(req, res)
// );



// // Delete a car company by ID
// adminRouter.delete(
//   "/car-company/:id",
//   (req, res) => adminController.deleteCarCompany(req, res)
// );

// // Fetch website page list for businesses, with subscription info
// adminRouter.get(
//   "/website-page",
//   (req, res) => adminController.getWebsitePage(req, res)
// );

// // --- Cities CRUD Endpoints ---

// // --- Provinces & Cities within Provinces ---
// // Province CRUD

// // Add a new province
// adminRouter.post(
//   "/provinces",
//   (req, res) => adminController.addProvince(req, res)
// );

// // Fetch all provinces and their cities
// adminRouter.get(
//   "/provinces",
//   (req, res) => adminController.fetchProvinces(req, res)
// );

// // Edit a province by ID
// adminRouter.patch(
//   "/provinces/:provinceId",
//   (req, res) => adminController.editProvince(req, res)
// );

// // Delete a province by ID
// adminRouter.delete(
//   "/provinces/:provinceId",
//   (req, res) => adminController.deleteProvince(req, res)
// );

// // --- Cities CRUD within province ---

// // Add a city to a province
// adminRouter.post(
//   "/provinces/:provinceId/cities",
//   (req, res) => adminController.addCity(req, res)
// );

// // Edit a city's name in a province (by city name, case-insensitive)
// adminRouter.patch(
//   "/provinces/:provinceId/cities/:cityName",
//   (req, res) => adminController.editCity(req, res)
// );

// // Delete a city from a province (by city name, case-insensitive)
// adminRouter.delete(
//   "/provinces/:provinceId/cities/:cityName",
//   (req, res) => adminController.deleteCity(req, res)
// );


// // -----------------------------
// // Ads CRUD Endpoints



// // ------------- BUSINESS PROFILE ADS (business-specific ads under a profile) -------------

// // Get all ads for a specific business profile
// adminRouter.get(
//   "/business-profiles/:businessId/ads",
//   (req, res) => adminController.getAllBusinessAds(req, res)
// );

// // Create (add) a new ad to a specific business profile (with image upload)
// adminRouter.post(
//   "/business-profiles/:businessId/ads",
//   adsUploadMiddleware,
//   (req, res) => adminController.createBusinessAd(req, res)
// );

// // Edit an ad in a business profile by adId (with optional image upload)
// adminRouter.patch(
//   "/business-profiles/:businessId/ads/:adId",
//   adsUploadMiddleware,
//   (req, res) => adminController.editBusinessAd(req, res)
// );

// // Delete an ad by adId from a specific business profile
// adminRouter.delete(
//   "/business-profiles/:businessId/ads/:adId",
//   (req, res) => adminController.deleteBusinessAd(req, res)
// );

// // Get all currently running deals (whose offerEndsOnDate is in the future)
// adminRouter.get(
//   "/deals/running",
//   (req, res) => adminController.getAllRunningDeals(req, res)
// );




// // Get job card payments details (with optional filtering/search)
// // Route: GET /admin/job-cards/payments
// adminRouter.get(
//   "/job-cards/payments",
//   (req, res) => adminController.getAllPaymentDetailsOfAllJobCards(req, res)
// );


// // Send a custom push notification to a specific user
// // Route: POST /admin/notification/custom/send
// adminRouter.post(
//   "/notification/custom/send",
//   (req, res) => adminController.sendCustomNotificationToUser(req, res)
// );

// // Route: GET /admin/invite-help
// // Get all InviteHelp documents sent to Admin, populate user and businessProfile, optionally filter by serviceId
// adminRouter.get(
//   "/invite-help",
//   (req, res) => adminController.getInviteHelpToAdmin(req, res)
// );



// adminRouter.post(
//   "/onboard-carowner",
//   jwtAuth,
//   onboardCarOwnerUploadMiddleware,
//   (req, res) => adminController.onboardCarOwner(req, res)
// );

// // Route to edit/update a car owner (customer) by autoshop owner
// adminRouter.put(
//   "/my-customers",
//   jwtAuth,
//   onboardCarOwnerUploadMiddleware,
//   (req, res) => adminController.editCustomer(req, res)
// );

// // Route to soft delete a car owner by userId (set status to "deleted")
// // Route: PUT /admin/car-owner/:userId/status/deleted
// // Toggle status of a car owner (customer) by userId between "deleted" and "active"
// // Route: PUT /admin/car-owner/:userId/status/toggle
// adminRouter.put(
//   "/car-owner/:userId/status/toggle",
//   jwtAuth,
//   (req, res) => adminController.toggleStatus(req, res)
// );





// export default adminRouter;


// // // Routers/admin.routes.js  — FIXED VERSION
// // //
// // // BUG FIXES applied vs the version you shared:
// // //
// // //  1. Upload middlewares (brandLogoUploadMiddleware, adsUploadMiddleware) are
// // //     now placed AFTER auth+permission middlewares, not before.
// // //     Multer must never run before auth — it consumes the request body,
// // //     so req.body is empty when your auth/permission middleware reads it.
// // //
// // //  2. /admin/subadmins is mounted WITHOUT an extra adminOrSubAdminAuth wrapper
// // //     because subAdminManagementRouter already applies its own auth internally
// // //     via router.use(adminOrSubAdminAuth, requireAdmin). Double-wrapping caused
// // //     the middleware chain to run auth twice and set req.user twice.
// // //
// // //  3. Notification route permission changed from ads→"add" to users→"view"
// // //     (sending notifications is a user-management action, not an ads action).

// // import express from "express";
// // import AdminController from "../Controllers/Admin/admin.controller.js";
// // import { brandLogoUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
// // import { adsUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/adsUpload.middleware.js";
// // import { subAdminManagementRouter } from "./subadmin.routes.js";
// // import { adminOrSubAdminAuth, requirePermission } from "../middlewares/Auth/permission.middleware.js";

// // const adminRouter = express.Router();
// // const adminController = new AdminController();

// // // ─── Sub Admin Management ─────────────────────────────────────────────────────
// // // NOTE: NO extra adminOrSubAdminAuth here — subAdminManagementRouter applies
// // // its own auth+requireAdmin internally. Adding it again causes double-auth.
// // adminRouter.use("/subadmins", subAdminManagementRouter);

// // // ─── Health check ─────────────────────────────────────────────────────────────
// // adminRouter.get("/", (req, res) => {
// //   res.send("Welcome to Auto Daddy Admin APIs");
// // });

// // // ─── Dashboard ────────────────────────────────────────────────────────────────
// // adminRouter.get(
// //   "/dashboard",
// //   adminOrSubAdminAuth,
// //   requirePermission("dashboard", "view"),
// //   (req, res) => adminController.getDashboardDetails(req, res)
// // );

// // // ─── Services ─────────────────────────────────────────────────────────────────
// // adminRouter.post(
// //   "/services",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "add"),
// //   (req, res) => adminController.addService(req, res)
// // );
// // adminRouter.get(
// //   "/services",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "view"),
// //   (req, res) => adminController.fetchServices(req, res)
// // );
// // adminRouter.put(
// //   "/services/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "edit"),
// //   (req, res) => adminController.editService(req, res)
// // );
// // adminRouter.delete(
// //   "/services/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "delete"),
// //   (req, res) => adminController.deleteService(req, res)
// // );

// // // ─── Users ────────────────────────────────────────────────────────────────────
// // adminRouter.get(
// //   "/carowners",
// //   adminOrSubAdminAuth,
// //   requirePermission("users", "view"),
// //   (req, res) => adminController.getAllCarOwners(req, res)
// // );
// // adminRouter.get(
// //   "/autoshopowners",
// //   adminOrSubAdminAuth,
// //   requirePermission("users", "view"),
// //   (req, res) => adminController.getAllAutoShopOwners(req, res)
// // );
// // adminRouter.post(
// //   "/autoshopowners/toggle-status",
// //   adminOrSubAdminAuth,
// //   requirePermission("users", "edit"),
// //   (req, res) => adminController.toggleAutoShopOwnerStatus(req, res)
// // );

// // // ─── Vehicle Types ────────────────────────────────────────────────────────────
// // adminRouter.get(
// //   "/vehicletypes",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "view"),
// //   (req, res) => adminController.fetchVehicleTypes(req, res)
// // );
// // adminRouter.post(
// //   "/vehicletypes",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "add"),
// //   (req, res) => adminController.addVehicleType(req, res)
// // );
// // adminRouter.put(
// //   "/vehicletypes/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "edit"),
// //   (req, res) => adminController.updateVehicleType(req, res)
// // );
// // adminRouter.delete(
// //   "/vehicletypes/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("services", "delete"),
// //   (req, res) => adminController.deleteVehicleType(req, res)
// // );

// // // ─── Website Templates ────────────────────────────────────────────────────────
// // adminRouter.post(
// //   "/website-templates",
// //   adminOrSubAdminAuth,
// //   requirePermission("websiteTemplates", "add"),
// //   (req, res) => adminController.createWebsiteTemplate(req, res)
// // );
// // adminRouter.put(
// //   "/website-templates/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("websiteTemplates", "edit"),
// //   (req, res) => adminController.editWebsiteTemplate(req, res)
// // );
// // adminRouter.delete(
// //   "/website-templates/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("websiteTemplates", "delete"),
// //   (req, res) => adminController.deleteWebsiteTemplate(req, res)
// // );
// // adminRouter.get(
// //   "/website-templates",
// //   adminOrSubAdminAuth,
// //   requirePermission("websiteTemplates", "view"),
// //   (req, res) => adminController.fetchWebsiteTemplates(req, res)
// // );

// // // ─── Dashboard Data ───────────────────────────────────────────────────────────
// // adminRouter.post(
// //   "/dashboard-data",
// //   adminOrSubAdminAuth,
// //   requirePermission("dashboardData", "add"),
// //   (req, res) => adminController.upsertDashboardData(req, res)
// // );
// // adminRouter.get(
// //   "/dashboard-data",
// //   adminOrSubAdminAuth,
// //   requirePermission("dashboardData", "view"),
// //   (req, res) => adminController.fetchDashboardData(req, res)
// // );
// // adminRouter.patch(
// //   "/dashboard-data",
// //   adminOrSubAdminAuth,
// //   requirePermission("dashboardData", "edit"),
// //   (req, res) => adminController.editDashboardData(req, res)
// // );
// // adminRouter.delete(
// //   "/dashboard-data",
// //   adminOrSubAdminAuth,
// //   requirePermission("dashboardData", "delete"),
// //   (req, res) => adminController.deleteDashboardData(req, res)
// // );

// // // ─── Car Companies ────────────────────────────────────────────────────────────
// // // FIX: auth + permission BEFORE upload middleware (multer consumes req.body)
// // adminRouter.post(
// //   "/car-company",
// //   adminOrSubAdminAuth,
// //   requirePermission("carCompanies", "add"),
// //   brandLogoUploadMiddleware,                        // ← upload LAST, after auth
// //   (req, res) => adminController.addCarCompany(req, res)
// // );
// // adminRouter.patch(
// //   "/car-company/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("carCompanies", "edit"),
// //   brandLogoUploadMiddleware,                        // ← upload LAST, after auth
// //   (req, res) => adminController.editCarCompany(req, res)
// // );
// // adminRouter.get(
// //   "/car-company",
// //   adminOrSubAdminAuth,
// //   requirePermission("carCompanies", "view"),
// //   (req, res) => adminController.fetchCarCompanies(req, res)
// // );
// // adminRouter.delete(
// //   "/car-company/:id",
// //   adminOrSubAdminAuth,
// //   requirePermission("carCompanies", "delete"),
// //   (req, res) => adminController.deleteCarCompany(req, res)
// // );

// // // ─── Website Page ─────────────────────────────────────────────────────────────
// // adminRouter.get(
// //   "/website-page",
// //   adminOrSubAdminAuth,
// //   requirePermission("websiteTemplates", "view"),
// //   (req, res) => adminController.getWebsitePage(req, res)
// // );

// // // ─── Provinces ────────────────────────────────────────────────────────────────
// // adminRouter.post(
// //   "/provinces",
// //   adminOrSubAdminAuth,
// //   requirePermission("provinces", "add"),
// //   (req, res) => adminController.addProvince(req, res)
// // );
// // adminRouter.get(
// //   "/provinces",
// //   adminOrSubAdminAuth,
// //   requirePermission("provinces", "view"),
// //   (req, res) => adminController.fetchProvinces(req, res)
// // );
// // adminRouter.patch(
// //   "/provinces/:provinceId",
// //   adminOrSubAdminAuth,
// //   requirePermission("provinces", "edit"),
// //   (req, res) => adminController.editProvince(req, res)
// // );
// // adminRouter.delete(
// //   "/provinces/:provinceId",
// //   adminOrSubAdminAuth,
// //   requirePermission("provinces", "delete"),
// //   (req, res) => adminController.deleteProvince(req, res)
// // );

// // // ─── Cities ───────────────────────────────────────────────────────────────────
// // adminRouter.post(
// //   "/provinces/:provinceId/cities",
// //   adminOrSubAdminAuth,
// //   requirePermission("cities", "add"),
// //   (req, res) => adminController.addCity(req, res)
// // );
// // adminRouter.patch(
// //   "/provinces/:provinceId/cities/:cityName",
// //   adminOrSubAdminAuth,
// //   requirePermission("cities", "edit"),
// //   (req, res) => adminController.editCity(req, res)
// // );
// // adminRouter.delete(
// //   "/provinces/:provinceId/cities/:cityName",
// //   adminOrSubAdminAuth,
// //   requirePermission("cities", "delete"),
// //   (req, res) => adminController.deleteCity(req, res)
// // );

// // // ─── Business Ads ─────────────────────────────────────────────────────────────
// // // FIX: auth + permission BEFORE adsUploadMiddleware
// // adminRouter.get(
// //   "/business-profiles/:businessId/ads",
// //   adminOrSubAdminAuth,
// //   requirePermission("ads", "view"),
// //   (req, res) => adminController.getAllBusinessAds(req, res)
// // );
// // adminRouter.post(
// //   "/business-profiles/:businessId/ads",
// //   adminOrSubAdminAuth,
// //   requirePermission("ads", "add"),
// //   adsUploadMiddleware,                              // ← upload LAST, after auth
// //   (req, res) => adminController.createBusinessAd(req, res)
// // );
// // adminRouter.patch(
// //   "/business-profiles/:businessId/ads/:adId",
// //   adminOrSubAdminAuth,
// //   requirePermission("ads", "edit"),
// //   adsUploadMiddleware,                              // ← upload LAST, after auth
// //   (req, res) => adminController.editBusinessAd(req, res)
// // );
// // adminRouter.delete(
// //   "/business-profiles/:businessId/ads/:adId",
// //   adminOrSubAdminAuth,
// //   requirePermission("ads", "delete"),
// //   (req, res) => adminController.deleteBusinessAd(req, res)
// // );

// // // ─── Running Deals ────────────────────────────────────────────────────────────
// // adminRouter.get(
// //   "/deals/running",
// //   adminOrSubAdminAuth,
// //   requirePermission("runningDeals", "view"),
// //   (req, res) => adminController.getAllRunningDeals(req, res)
// // );

// // // ─── Wallet / Job Card Payments ───────────────────────────────────────────────
// // adminRouter.get(
// //   "/job-cards/payments",
// //   adminOrSubAdminAuth,
// //   requirePermission("wallet", "view"),
// //   (req, res) => adminController.getAllPaymentDetailsOfAllJobCards(req, res)
// // );

// // // ─── Notifications ────────────────────────────────────────────────────────────
// // // FIX: was incorrectly using ads→"add". Notifications are a user action.
// // adminRouter.post(
// //   "/notification/custom/send",
// //   adminOrSubAdminAuth,
// //   requirePermission("users", "edit"),
// //   (req, res) => adminController.sendCustomNotificationToUser(req, res)
// // );

// // // ─── Invite Help ──────────────────────────────────────────────────────────────
// // adminRouter.get(
// //   "/invite-help",
// //   adminOrSubAdminAuth,
// //   requirePermission("inviteHelp", "view"),
// //   (req, res) => adminController.getInviteHelpToAdmin(req, res)
// // );

// // export default adminRouter;

// =================================================================
//  COMPLETE UPDATED: Routers/admin.routes.js
//  (Full file — replaces your existing admin.routes.js)
// =================================================================

import express from "express";
import AdminController from "../Controllers/Admin/admin.controller.js";
import { brandLogoUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
import { adsUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/adsUpload.middleware.js";
import { subAdminManagementRouter } from "./subadmin.routes.js";
import jwtAuth from "../middlewares/Auth/auth.middleware.js";
import { onboardCarOwnerUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/onboardCustomerImageUpload.middleware.js";
import commonRoutes from "./Admin/common.routes.js";
import provinceRouter from "./Admin/province.routes.js";
import servicesRouter from "./Admin/services.routes.js";
import carCompanyRouter from "./Admin/carCompany.routes.js";
import carOwnerRouter from "./Admin/carOwner.routes.js";
import dealerRouter from "./Admin/dealer.routes.js";
import leadsRouter from "./Admin/leads.routes.js";
import accountsRouter from "./Admin/accounts.router.js";
import domainRouter from "./Admin/domain.router.js";
import autoShopOwnersRouter from "./Admin/autoShopOwners.routes.js";


const adminRouter = express.Router();
const adminController = new AdminController();

// ─── Sub Admin Management ─────────────────────────────────────────────────────
adminRouter.use("/subadmins", subAdminManagementRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
adminRouter.get("/", (req, res) => {
  res.send("Welcome to Auto Daddy Admin APIs");
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
adminRouter.get(
  "/dashboard",
  (req, res) => adminController.getDashboardDetails(req, res)
);

// ─── Services ─────────────────────────────────────────────────────────────────
// adminRouter.post("/services", (req, res) => adminController.addService(req, res));
// adminRouter.get("/services", (req, res) => adminController.fetchServices(req, res));
// adminRouter.put("/services/:id", (req, res) => adminController.editService(req, res));
// adminRouter.delete("/services/:id", (req, res) => adminController.deleteService(req, res));

// // ─── Car Owners ───────────────────────────────────────────────────────────────
// // Get all car owners (with job cards & populated vehicles/shops)
// adminRouter.get(
//   "/carowners",
//   (req, res) => adminController.getAllCarOwners(req, res)
// );

// // Onboard (create) a new car owner from admin panel
// adminRouter.post(
//   "/onboard-carowner",
//   jwtAuth,
//   onboardCarOwnerUploadMiddleware,
//   (req, res) => adminController.onboardCarOwner(req, res)
// );

// // Edit/update a car owner (admin panel)
// adminRouter.put(
//   "/my-customers",
//   jwtAuth,
//   onboardCarOwnerUploadMiddleware,
//   (req, res) => adminController.editCustomer(req, res)
// );

// // Toggle car owner status (soft delete / restore)
// // PUT /api/admin/car-owner/:userId/status/toggle
// adminRouter.put(
//   "/car-owner/:userId/status/toggle",
//   jwtAuth,
//   (req, res) => adminController.toggleStatus(req, res)
// );

// // ─── Auto Shop Owners ─────────────────────────────────────────────────────────

// // GET all auto shop owners
// adminRouter.get(
//   "/autoshopowners",
//   (req, res) => adminController.getAllAutoShopOwners(req, res)
// );

// // POST  — Create a new auto shop owner (Admin)
// // Body: { name, email, phone, countryCode, pincode, address? }
// adminRouter.post(
//   "/autoshopowners",
//   jwtAuth,
//   (req, res) => adminController.createAutoShopOwner(req, res)
// );

// // PUT  — Update an auto shop owner's profile (Admin)
// // Params: ownerId
// // Body (any subset): { name, email, phone, countryCode, pincode, address }
// adminRouter.put(
//   "/autoshopowners/:ownerId",
//   jwtAuth,
//   (req, res) => adminController.updateAutoShopOwner(req, res)
// );

// // DELETE  — Soft-delete an auto shop owner (Admin)
// // Sets status="deleted", isDisabled=true, deactivates business profile
// // Params: ownerId
// adminRouter.delete(
//   "/autoshopowners/:ownerId",
//   jwtAuth,
//   (req, res) => adminController.deleteAutoShopOwner(req, res)
// );

// // PUT  — Revive (restore) a soft-deleted auto shop owner (Admin)
// // Sets status="active", isDisabled=false, re-activates business profile
// // Params: ownerId
// // NOTE: This route MUST be declared BEFORE /autoshopowners/:ownerId
// //       so Express does not treat "revive" as an ownerId value.
// adminRouter.put(
//   "/autoshopowners/:ownerId/revive",
//   jwtAuth,
//   (req, res) => adminController.reviveAutoShopOwner(req, res)
// );

// // POST  — Enable / disable an auto shop owner + their business profile
// // Body: { userId: string, disable: boolean }
// adminRouter.post(
//   "/autoshopowners/toggle-status",
//   (req, res) => adminController.toggleAutoShopOwnerStatus(req, res)
// );

// ─── Vehicle Types ────────────────────────────────────────────────────────────
// adminRouter.get("/vehicletypes", (req, res) => adminController.fetchVehicleTypes(req, res));
// adminRouter.post("/vehicletypes", (req, res) => adminController.addVehicleType(req, res));
// adminRouter.put("/vehicletypes/:id", (req, res) => adminController.updateVehicleType(req, res));
// adminRouter.delete("/vehicletypes/:id", (req, res) => adminController.deleteVehicleType(req, res));

// ─── Website Templates ────────────────────────────────────────────────────────
// adminRouter.post("/website-templates", (req, res) => adminController.createWebsiteTemplate(req, res));
// adminRouter.put("/website-templates/:id", (req, res) => adminController.editWebsiteTemplate(req, res));
// adminRouter.delete("/website-templates/:id", (req, res) => adminController.deleteWebsiteTemplate(req, res));
// adminRouter.get("/website-templates", (req, res) => adminController.fetchWebsiteTemplates(req, res));

// ─── Dashboard Data ───────────────────────────────────────────────────────────
adminRouter.post("/dashboard-data", (req, res) => adminController.upsertDashboardData(req, res));
adminRouter.get("/dashboard-data", (req, res) => adminController.fetchDashboardData(req, res));
adminRouter.patch("/dashboard-data", (req, res) => adminController.editDashboardData(req, res));
adminRouter.delete("/dashboard-data", (req, res) => adminController.deleteDashboardData(req, res));

// ─── Car Companies ────────────────────────────────────────────────────────────
// adminRouter.post(
//   "/car-company",
//   brandLogoUploadMiddleware,
//   (req, res) => adminController.addCarCompany(req, res)
// );
// adminRouter.patch(
//   "/car-company/:id",
//   brandLogoUploadMiddleware,
//   (req, res) => adminController.editCarCompany(req, res)
// );
// adminRouter.get("/car-company", (req, res) => adminController.fetchCarCompanies(req, res));
// adminRouter.delete("/car-company/:id", (req, res) => adminController.deleteCarCompany(req, res));

// ─── Website Page ─────────────────────────────────────────────────────────────
adminRouter.get("/website-page", (req, res) => adminController.getWebsitePage(req, res));

// // ─── Provinces & Cities ───────────────────────────────────────────────────────
// adminRouter.post("/provinces", (req, res) => adminController.addProvince(req, res));
// adminRouter.get("/provinces", (req, res) => adminController.fetchProvinces(req, res));
// adminRouter.patch("/provinces/:provinceId", (req, res) => adminController.editProvince(req, res));
// adminRouter.delete("/provinces/:provinceId", (req, res) => adminController.deleteProvince(req, res));

// adminRouter.post("/provinces/:provinceId/cities", (req, res) => adminController.addCity(req, res));
// adminRouter.patch("/provinces/:provinceId/cities/:cityName", (req, res) => adminController.editCity(req, res));
// adminRouter.delete("/provinces/:provinceId/cities/:cityName", (req, res) => adminController.deleteCity(req, res));

// ─── Business Profile Ads ─────────────────────────────────────────────────────
adminRouter.get(
  "/business-profiles/:businessId/ads",
  (req, res) => adminController.getAllBusinessAds(req, res)
);

adminRouter.post(
  "/business-profiles/:businessId/ads",
  adsUploadMiddleware,
  (req, res) => adminController.createBusinessAd(req, res)
);

adminRouter.patch(
  "/business-profiles/:businessId/ads/:adId",
  adsUploadMiddleware,
  (req, res) => adminController.editBusinessAd(req, res)
);

adminRouter.delete(
  "/business-profiles/:businessId/ads/:adId",
  (req, res) => adminController.deleteBusinessAd(req, res)
);

// ─── Running Deals ────────────────────────────────────────────────────────────
adminRouter.get("/deals/running", (req, res) => adminController.getAllRunningDeals(req, res));

// ─── Job Card Payments ────────────────────────────────────────────────────────
adminRouter.get(
  "/job-cards/payments",
  (req, res) => adminController.getAllPaymentDetailsOfAllJobCards(req, res)
);

// ─── Custom Notifications ─────────────────────────────────────────────────────
// Sends push notifications to carowner or autoshopowner users
// Body: { userType: "carOwner"|"autoshopowner", userIds: string[], title, message }
adminRouter.post(
  "/notification/custom/send",
  (req, res) => adminController.sendCustomNotificationToUser(req, res)
);



//New
//New
//New
//New
//New
//New
//New Routes


// Mount Thought of the Day router under /admin/thought-of-the-day
adminRouter.use("/common", commonRoutes);


adminRouter.use("/provinces", provinceRouter);


adminRouter.use("/services", servicesRouter);


adminRouter.use("/car-company", carCompanyRouter);


adminRouter.use("/carowners", carOwnerRouter);

// Mount Auto Shop Owners router under /admin/auto-shop-owners
adminRouter.use("/autoshopowners", autoShopOwnersRouter);


adminRouter.use("/dealer", dealerRouter);


adminRouter.use("/leads", leadsRouter);

adminRouter.use("/accounts", accountsRouter);

adminRouter.use("/domains", domainRouter);

// Route to fetch the audioBlob for a specific InviteHelp document by its ID
adminRouter.get(
  "/invite-help/audio/:id",
  async (req, res) => {
    await adminController.getInviteHelpAudioBlob(req, res);
  }
);

adminRouter.patch(
  "/invite-help/status/:id/",
  jwtAuth,
  async (req, res) => {
    await adminController.updateInviteHelpStatus(req, res);
  }
);

// ─── Invite Help ──────────────────────────────────────────────────────────────
adminRouter.get("/invite-help", (req, res) => adminController.getInviteHelpToAdmin(req, res));






// Route to get the profile details for a given user ID
adminRouter.get(
  "/profile",
  jwtAuth,
  async (req, res) => {
    await adminController.getProfile(req, res);
  }
);



export default adminRouter;