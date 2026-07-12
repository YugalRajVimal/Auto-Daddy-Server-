import express from "express";

import {
  getPlans,
  getSubscriptionStatus,
  getSubscriptionHistory,
  purchaseSubscription,
  createCheckoutSession,
  verifyPaymentStatus,
  markSubscriptionPaid,
  handleStripeWebhook,
} from "../../Controllers/AutoShops/subscription.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";


const subscriptionRouter = express.Router();

subscriptionRouter.use(jwtAuth);

// Static plan catalog — pricing, days, features
subscriptionRouter.get("/plans", getPlans);

// Current status — days remaining, expiry, prerequisite checks
subscriptionRouter.get("/status", getSubscriptionStatus);

// Full purchase history, paginated
subscriptionRouter.get("/history", getSubscriptionHistory);

// Manual/offline purchase (Cash, Void Cheque, e-Transfer)
subscriptionRouter.post("/purchase", purchaseSubscription);

// Create a Stripe Checkout Session for a card payment
subscriptionRouter.post("/checkout", createCheckoutSession);

// Check/reconcile the status of a specific purchase (self-heals missed webhooks)
subscriptionRouter.get("/:invoiceNo/status", verifyPaymentStatus);

// Manually confirm a non-Stripe Pending purchase
subscriptionRouter.patch("/:invoiceNo/mark-paid", markSubscriptionPaid);

export default subscriptionRouter;

/**
 * ================================================================
 * STRIPE WEBHOOK — CRITICAL MOUNTING NOTE
 * ================================================================
 * handleStripeWebhook is exported SEPARATELY (not attached to
 * subscriptionRouter above) because it needs the RAW request body to
 * verify Stripe's signature — NOT the JSON-parsed body your other
 * routes get. If this route sits behind your app's global
 * `app.use(express.json())`, the body will already be parsed into an
 * object by the time it reaches here, and signature verification
 * (`stripe.webhooks.constructEvent`) will fail on every single request.
 *
 * In your main server entry file (e.g. app.js / server.js), mount it
 * like this, BEFORE the global express.json() middleware:
 *
 *   import express from "express";
 *   import { handleStripeWebhook } from "./Controllers/AutoShops/subscription.controller.js";
 *
 *   const app = express();
 *
 *   // Stripe webhook — raw body, must come before express.json()
 *   app.post(
 *     "/api/autoshopowner/subscription/webhook",
 *     express.raw({ type: "application/json" }),
 *     handleStripeWebhook
 *   );
 *
 *   // Everything else uses parsed JSON as normal
 *   app.use(express.json());
 *   app.use("/api", router); // your existing router tree, including autoShopNewRouter
 *
 * Do NOT add a webhook route inside subscriptionRouter itself — Express
 * applies body-parsing middleware in registration order across the
 * whole app, and by the time a request reaches a nested router mounted
 * after express.json(), the raw body is already gone.
 * ================================================================
 */
export { handleStripeWebhook };

// Mount the rest alongside your other autoshopowner modules:
// autoShopNewRouter.use("/subscription", subscriptionRouter);
// -> Final base: {{BASE}}/api/autoshopowner/subscription