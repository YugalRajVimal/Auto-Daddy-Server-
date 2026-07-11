import express from "express";


import {
  getJobCardPageDetails,
  createJobCard,
  editJobCard,
  getAllJobCards,
  deleteJobCard,
  markStatus,
  sendForApproval,
  getSendForApprovalJobCards,
  markInvoicePaid,
} from "../../Controllers/AutoShops/jobCard.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const jobCardRouter = express.Router();

jobCardRouter.use(jwtAuth);

/* Page bootstrap data: customers, next job card no, subServices, banks */
jobCardRouter.get("/page-details", getJobCardPageDetails);

/* Job cards awaiting customer approval — keep above "/:jobCardNo" routes
   so it isn't swallowed as a jobCardNo param */
jobCardRouter.get("/pending-approval", getSendForApprovalJobCards);

/* Core CRUD */
jobCardRouter.post("/", createJobCard);
jobCardRouter.get("/", getAllJobCards); // supports ?search=&status=&page=&limit=
jobCardRouter.put("/:jobCardNo", editJobCard);
jobCardRouter.delete("/:jobCardNo", deleteJobCard);

jobCardRouter.post("/:jobCardNo/markInvoicePaid", markInvoicePaid);

/* Status + approval actions */
jobCardRouter.put("/:jobCardNo/status", markStatus);
jobCardRouter.post("/:jobCardNo/send-for-approval", sendForApproval);

export default jobCardRouter;

// Mount, following the same pattern as your other autoshopowner modules:
// autoShopNewRouter.use("/jobcards", jobCardRouter);
// -> Final base: {{BASE}}/api/autoshopowner/jobcards