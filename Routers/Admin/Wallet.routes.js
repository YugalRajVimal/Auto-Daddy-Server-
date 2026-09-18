import express from "express";
import { adjustWalletBalance } from "../../Controllers/AutoShops/wallet.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js"; // swap for your admin-auth middleware if different

const adminWalletRouter = express.Router();
adminWalletRouter.use(jwtAuth);

// Manual credit/debit adjustment — replaces the old direct-credit
// POST /api/autoshopowner/wallet/recharge. Deliberately kept out of the
// shop-owner wallet router: only a staff account with role "admin" (or
// isSuperAdmin) can call this (checked inside the controller), and every
// adjustment is logged as type: "adjustment" with the acting admin's
// id/role, never as a "recharge" a customer could mistake for a paid top-up.
adminWalletRouter.post("/adjust", adjustWalletBalance);

export default adminWalletRouter;

// Mount in your Admin router tree, e.g.:
// adminRouter.use("/wallet", adminWalletRouter);
// -> Final base: {{BASE}}/api/admin/wallet