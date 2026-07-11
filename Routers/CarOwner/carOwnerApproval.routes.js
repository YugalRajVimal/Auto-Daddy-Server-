import express from "express";

import {
  getPendingCustomerAddRequests,
  approveCustomerAddRequest,
  rejectCustomerAddRequest,
  getPendingJobCardApprovals,
  approveJobCard,
  rejectJobCard,
  getCustomerAddRequestDetails,
} from "../../Controllers/CarOwner/carOwnerApproval.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const approvalsRouter = express.Router();

/* Customer add-request approvals (shop's "AddToMyCustomers" flow) */
approvalsRouter.get("/customer-requests",jwtAuth, getPendingCustomerAddRequests);
// approvalsRouter.post("/customer-requests/:businessId/approve", approveCustomerAddRequest);
// approvalsRouter.post("/customer-requests/:businessId/reject", rejectCustomerAddRequest);

approvalsRouter.get("/customer-requests/:businessId", getCustomerAddRequestDetails);
approvalsRouter.post("/customer-requests/:businessId/approve", approveCustomerAddRequest);
approvalsRouter.post("/customer-requests/:businessId/reject", rejectCustomerAddRequest);

// link sent via SMS, e.g.:
// https://yourapp.com/customer-requests/<businessId>/approve?customerId=<customerId>
// https://yourapp.com/customer-requests/<businessId>/reject?customerId=<customerId>

/* Job card approvals */
approvalsRouter.get("/jobcards",jwtAuth, getPendingJobCardApprovals);
approvalsRouter.post("/jobcards/:jobCardId/approve",jwtAuth, approveJobCard);
approvalsRouter.post("/jobcards/:jobCardId/reject",jwtAuth, rejectJobCard);

export default approvalsRouter;

// Assumed mount, mirroring the autoshopowner chain pattern but for carowner:
// router.use("/carowner", carOwnerRouter);
// carOwnerRouter.use("/approvals", approvalsRouter);
// -> Final base: {{BASE}}/api/carowner/approvals