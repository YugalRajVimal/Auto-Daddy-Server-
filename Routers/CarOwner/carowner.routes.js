import express from "express";
import approvalsRouter from "./carOwnerApproval.routes.js";

const carownerRouter = express.Router();

// Mount the car owner approvals sub-router
carownerRouter.use("/approvals", approvalsRouter);

export default carownerRouter;
