
import express from "express";
import AdminController from "../Controllers/Admin/admin.controller.js";
import { brandLogoUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/brandLogoUpload.middleware.js";
import { adsUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/adsUpload.middleware.js";
// import { subAdminManagementRouter } from "./subadmin.routes.js";
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
import invoiceRouter from "./Admin/invoices.routes.js";
import staffUserManagementRouter from "./Admin/Staffuser.routes .js";
import roleRouter from "./Admin/role.routes.js";


const adminRouter = express.Router();
const adminController = new AdminController();

// ─── Sub Admin Management ─────────────────────────────────────────────────────
// adminRouter.use("/subadmins", subAdminManagementRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
adminRouter.get("/", (req, res) => {
  res.send("Welcome to Auto Daddy Admin APIs");
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
adminRouter.get(
  "/dashboard",
  (req, res) => adminController.getDashboardDetails(req, res)
);



adminRouter.post("/dashboard-data", (req, res) => adminController.upsertDashboardData(req, res));
adminRouter.get("/dashboard-data", (req, res) => adminController.fetchDashboardData(req, res));
adminRouter.patch("/dashboard-data", (req, res) => adminController.editDashboardData(req, res));
adminRouter.delete("/dashboard-data", (req, res) => adminController.deleteDashboardData(req, res));

adminRouter.get("/website-page", (req, res) => adminController.getWebsitePage(req, res));

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


console.log("Mounting /leads route with leadsRouter");
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

adminRouter.use("/invoices", invoiceRouter);

adminRouter.use("/roles", roleRouter);
adminRouter.use("/staff-users", staffUserManagementRouter);





export default adminRouter;