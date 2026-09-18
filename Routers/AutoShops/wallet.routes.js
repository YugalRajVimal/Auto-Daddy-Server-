// import express from "express";
// import {
//   getWalletStatus,
//   getWalletHistory,
//   rechargeWallet,
// } from "../../Controllers/AutoShops/wallet.controller.js";
// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

// const walletRouter = express.Router();
// walletRouter.use(jwtAuth);

// walletRouter.get("/status", getWalletStatus);
// walletRouter.get("/history", getWalletHistory);
// walletRouter.post("/recharge", rechargeWallet);

// export default walletRouter;

// // Mount alongside your other autoshopowner modules:
// // autoShopNewRouter.use("/wallet", walletRouter);
// // -> Final base: {{BASE}}/api/autoshopowner/wallet

import express from "express";
import {
  getWalletStatus,
  getWalletHistory,
  createWalletCheckoutSession,
  verifyWalletCheckoutStatus,
} from "../../Controllers/AutoShops/wallet.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const walletRouter = express.Router();
walletRouter.use(jwtAuth);

walletRouter.get("/status", getWalletStatus);
walletRouter.get("/history", getWalletHistory);

// Create a Stripe Checkout Session for a wallet top-up
walletRouter.post("/checkout", createWalletCheckoutSession);

// Check/reconcile the status of a specific checkout session (self-heals
// missed webhooks), same pattern as subscription's :invoiceNo/status
walletRouter.get("/checkout/:sessionId/status", verifyWalletCheckoutStatus);

// NOTE: the old POST /wallet/recharge (direct, unverified balance credit)
// has been removed entirely — it let any authenticated user top up their
// wallet for free. Real recharges now only happen via Stripe Checkout
// above. The one remaining way to move a balance without a Stripe payment
// is POST /api/admin/wallet/adjust (admin-only, logged as type:
// "adjustment") — see Routers/Admin/wallet.routes.js.

export default walletRouter;

// Mount alongside your other autoshopowner modules:
// autoShopNewRouter.use("/wallet", walletRouter);
// -> Final base: {{BASE}}/api/autoshopowner/wallet