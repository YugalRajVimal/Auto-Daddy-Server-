import express from "express";


import {
  getPendingCustomerAddRequests,
  approveCustomerAddRequest,
  rejectCustomerAddRequest,
  getPendingJobCardApprovals,
  approveJobCard,
  rejectJobCard,
} from "../../Controllers/CarOwner/carOwnerApproval.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const approvalsRouter = express.Router();

approvalsRouter.use(jwtAuth);

/* Customer add-request approvals (shop's "AddToMyCustomers" flow) */
approvalsRouter.get("/customer-requests", getPendingCustomerAddRequests);
approvalsRouter.post("/customer-requests/:businessId/approve", approveCustomerAddRequest);
approvalsRouter.post("/customer-requests/:businessId/reject", rejectCustomerAddRequest);

/* Job card approvals */
approvalsRouter.get("/jobcards", getPendingJobCardApprovals);
approvalsRouter.post("/jobcards/:jobCardId/approve", approveJobCard);
approvalsRouter.post("/jobcards/:jobCardId/reject", rejectJobCard);

export default approvalsRouter;

// Assumed mount, mirroring the autoshopowner chain pattern but for carowner:
// router.use("/carowner", carOwnerRouter);
// carOwnerRouter.use("/approvals", approvalsRouter);
// -> Final base: {{BASE}}/api/carowner/approvals