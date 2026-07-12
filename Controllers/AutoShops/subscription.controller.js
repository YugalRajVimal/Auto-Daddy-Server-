// import { User } from "../../Schema/user.schema.js";
// import BusinessProfileModel from "../../Schema/bussiness-profile.js";
// import { getNextSequence } from "../../Schema/counter.schema.js";
// import stripe from "../../Config/stripe.js";
// import {
//   SUBSCRIPTION_PLANS,
//   CURRENCY,
//   getPlanById,
//   getAllPlans,
//   computeSubscriptionAmounts,
// } from "../../Constants/subscriptionPlans.constant.js";

// /* Helper: resolve the caller's businessProfile id from DB (req.user only
//    ever has { id, role, ... } from jwtAuth — never businessProfile). Same
//    pattern used across every other autoshop controller. */
// async function getBusinessId(userId) {
//   const user = await User.findById(userId).select("businessProfile");
//   return user?.businessProfile || null;
// }

// /**
//  * Days remaining until subscriptionExpiresAt, floored at 0.
//  */
// function computeDaysRemaining(subscriptionExpiresAt) {
//   if (!subscriptionExpiresAt) return 0;
//   const now = new Date();
//   const expiresAt = new Date(subscriptionExpiresAt);
//   const msPerDay = 1000 * 60 * 60 * 24;
//   const diff = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);
//   return diff > 0 ? diff : 0;
// }

// /**
//  * Shared "grant days" logic — extends subscriptionExpiresAt from whichever
//  * is later: the current expiry (if still active) or today. Used by every
//  * code path that can turn a subscription record Paid: the manual
//  * purchase endpoint, the Stripe webhook, the self-healing status check,
//  * and the manual mark-paid endpoint. Centralized here so all four stay
//  * consistent instead of drifting apart over time.
//  */
// function extendExpiry(business, days) {
//   const now = new Date();
//   const currentExpiry = business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt) : null;
//   const baseDate = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;

//   const newExpiresAt = new Date(baseDate);
//   newExpiresAt.setDate(newExpiresAt.getDate() + days);
//   business.subscriptionExpiresAt = newExpiresAt;
//   return newExpiresAt;
// }

// function checkPrerequisites(business) {
//   const hasDomainDetails = (business.domainDetails || []).length > 0;
//   const hasWebsiteTemplate = !!business.websiteTemplateId;
//   return { hasDomainDetails, hasWebsiteTemplate, ok: hasDomainDetails && hasWebsiteTemplate };
// }

// const MANUAL_PAYMENT_METHODS = ["Cash", "Void Cheque", "e-Transfer"];
// const VALID_PAYMENT_STATUSES = ["Paid", "Pending", "Failed"];

// /* =========================================================
//    1. GET AVAILABLE PLANS
//       Route: GET /subscription/plans
//    ========================================================= */
// export const getPlans = async (req, res) => {
//   try {
//     return res.status(200).json({
//       success: true,
//       data: {
//         currency: CURRENCY,
//         plans: getAllPlans().map((plan) => ({
//           ...plan,
//           ...computeSubscriptionAmounts(plan),
//         })),
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch subscription plans",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    2. GET CURRENT SUBSCRIPTION STATUS
//       Route: GET /subscription/status
//    ========================================================= */
// export const getSubscriptionStatus = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId).select(
//       "subscriptionExpiresAt subscriptions domainDetails websiteTemplateId"
//     );
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const daysRemaining = computeDaysRemaining(business.subscriptionExpiresAt);
//     const lastPurchase = business.subscriptions.length
//       ? business.subscriptions[business.subscriptions.length - 1]
//       : null;

//     return res.status(200).json({
//       success: true,
//       data: {
//         isActive: daysRemaining > 0,
//         daysRemaining,
//         subscriptionExpiresAt: business.subscriptionExpiresAt,
//         lastPurchase,
//         totalPurchases: business.subscriptions.length,
//         prerequisites: checkPrerequisites(business),
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch subscription status",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    3. GET SUBSCRIPTION / PURCHASE HISTORY
//       Route: GET /subscription/history?page=&limit=
//    ========================================================= */
// export const getSubscriptionHistory = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { page = 1, limit = 20 } = req.query;
//     const pageNum = Math.max(1, Number(page) || 1);
//     const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

//     const business = await BusinessProfileModel.findById(businessId).select("subscriptions");
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const sorted = [...business.subscriptions].sort(
//       (a, b) => new Date(b.purchasedOn) - new Date(a.purchasedOn)
//     );

//     const total = sorted.length;
//     const start = (pageNum - 1) * limitNum;
//     const pageItems = sorted.slice(start, start + limitNum);

//     return res.status(200).json({
//       success: true,
//       data: pageItems,
//       pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch subscription history",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    4. MANUAL PURCHASE (Cash / Void Cheque / e-Transfer)
//       Route: POST /subscription/purchase
//       Body: { planId, paymentMethod, referenceId?, remarks?, paymentStatus? }
//       For offline payment methods only — card payments go through
//       createCheckoutSession below instead. paymentMethod: "stripe" is
//       rejected here with a 400 pointing at the correct endpoint.
//    ========================================================= */
// export const purchaseSubscription = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { planId, paymentMethod, referenceId, remarks, paymentStatus } = req.body;

//     const plan = getPlanById(planId);
//     if (!plan) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid planId. Valid values are: ${Object.keys(SUBSCRIPTION_PLANS).join(", ")}`,
//       });
//     }

//     if (paymentMethod === "stripe") {
//       return res.status(400).json({
//         success: false,
//         message: "For card payments, use POST /subscription/checkout instead of this endpoint.",
//       });
//     }
//     if (!paymentMethod || !MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
//       return res.status(400).json({
//         success: false,
//         message: `paymentMethod is required and must be one of: ${MANUAL_PAYMENT_METHODS.join(", ")}`,
//       });
//     }

//     if (paymentStatus !== undefined && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid paymentStatus. Valid values are: ${VALID_PAYMENT_STATUSES.join(", ")}`,
//       });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const prereq = checkPrerequisites(business);
//     if (!prereq.ok) {
//       const missing = [];
//       if (!prereq.hasDomainDetails) missing.push("domain details (POST /domain-details/add)");
//       if (!prereq.hasWebsiteTemplate) missing.push("a website template (POST /website-template/select)");
//       return res.status(403).json({
//         success: false,
//         message: `Cannot purchase a subscription until you've submitted: ${missing.join(" and ")}.`,
//       });
//     }

//     const { amount, subTotal, hst, hstAmount, total } = computeSubscriptionAmounts(plan);

//     const year = new Date().getFullYear();
//     const seq = await getNextSequence("invoiceNo");
//     const invoiceNo = `INV-${year}-${String(seq).padStart(5, "0")}`;

//     const finalStatus = paymentStatus || "Paid";

//     business.subscriptions.push({
//       days: plan.days,
//       amount,
//       subTotal,
//       hst,
//       hstAmount,
//       total,
//       purchasedOn: new Date(),
//       invoiceNo,
//       paymentStatus: finalStatus,
//       paymentMethod,
//       referenceId,
//       remarks: remarks || `${plan.name} (${plan.days} days)`,
//     });

//     if (finalStatus === "Paid") {
//       extendExpiry(business, plan.days);
//     }

//     await business.save();

//     return res.status(201).json({
//       success: true,
//       message:
//         finalStatus === "Paid"
//           ? `Subscription purchased successfully. ${plan.days} days added.`
//           : `Subscription recorded with status "${finalStatus}" — no days added until marked Paid.`,
//       data: {
//         invoiceNo,
//         plan: { id: plan.id, name: plan.name, days: plan.days },
//         amount: { subTotal, hst, hstAmount, total, currency: CURRENCY },
//         paymentStatus: finalStatus,
//         subscriptionExpiresAt: business.subscriptionExpiresAt,
//         daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to purchase subscription",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    5. CREATE STRIPE CHECKOUT SESSION
//       Route: POST /subscription/checkout
//       Body: { planId, successUrl?, cancelUrl? }
//       Creates a Pending subscription record (so it shows up in history
//       immediately) + a Stripe Checkout Session for a ONE-TIME payment
//       (mode: "payment", not Stripe's native recurring "subscription"
//       mode — your day-stacking logic is custom, so Stripe is used purely
//       as a payment collector here, not a billing engine).
//       Returns the Stripe-hosted checkout URL for the frontend to redirect
//       the user to.
//    ========================================================= */
// export const createCheckoutSession = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { planId, successUrl, cancelUrl } = req.body;

//     const plan = getPlanById(planId);
//     if (!plan) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid planId. Valid values are: ${Object.keys(SUBSCRIPTION_PLANS).join(", ")}`,
//       });
//     }

//     const finalSuccessUrl = successUrl || process.env.STRIPE_SUBSCRIPTION_SUCCESS_URL;
//     const finalCancelUrl = cancelUrl || process.env.STRIPE_SUBSCRIPTION_CANCEL_URL;
//     if (!finalSuccessUrl || !finalCancelUrl) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "successUrl and cancelUrl are required (either in the request body, or set STRIPE_SUBSCRIPTION_SUCCESS_URL / STRIPE_SUBSCRIPTION_CANCEL_URL env vars as a fallback).",
//       });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const prereq = checkPrerequisites(business);
//     if (!prereq.ok) {
//       const missing = [];
//       if (!prereq.hasDomainDetails) missing.push("domain details (POST /domain-details/add)");
//       if (!prereq.hasWebsiteTemplate) missing.push("a website template (POST /website-template/select)");
//       return res.status(403).json({
//         success: false,
//         message: `Cannot purchase a subscription until you've submitted: ${missing.join(" and ")}.`,
//       });
//     }

//     const { amount, subTotal, hst, hstAmount, total } = computeSubscriptionAmounts(plan);

//     const year = new Date().getFullYear();
//     const seq = await getNextSequence("invoiceNo");
//     const invoiceNo = `INV-${year}-${String(seq).padStart(5, "0")}`;

//     // Create the Pending record FIRST so a webhook that arrives before
//     // this function even finishes responding still has something to match
//     // against (Stripe webhooks can genuinely race the HTTP response).
//     business.subscriptions.push({
//       days: plan.days,
//       amount,
//       subTotal,
//       hst,
//       hstAmount,
//       total,
//       purchasedOn: new Date(),
//       invoiceNo,
//       paymentStatus: "Pending",
//       paymentMethod: "stripe",
//       remarks: `${plan.name} (${plan.days} days) — awaiting Stripe payment`,
//     });
//     await business.save();

//     let session;
//     try {
//       session = await stripe.checkout.sessions.create({
//         mode: "payment",
//         payment_method_types: ["card"],
//         line_items: [
//           {
//             price_data: {
//               currency: CURRENCY.toLowerCase(),
//               product_data: {
//                 name: plan.name,
//                 description: plan.features.join(" | "),
//               },
//               unit_amount: Math.round(total * 100), // Stripe expects the smallest currency unit (cents)
//             },
//             quantity: 1,
//           },
//         ],
//         success_url: `${finalSuccessUrl}${finalSuccessUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}&invoiceNo=${invoiceNo}`,
//         cancel_url: `${finalCancelUrl}${finalCancelUrl.includes("?") ? "&" : "?"}invoiceNo=${invoiceNo}`,
//         client_reference_id: invoiceNo,
//         metadata: {
//           businessId: businessId.toString(),
//           invoiceNo,
//           planId: plan.id,
//         },
//       });
//     } catch (stripeErr) {
//       // Stripe call failed — mark the Pending record Failed rather than
//       // leaving an orphaned Pending entry with no way to ever resolve it.
//       const business2 = await BusinessProfileModel.findById(businessId);
//       const sub = business2.subscriptions.find((s) => s.invoiceNo === invoiceNo);
//       if (sub) {
//         sub.paymentStatus = "Failed";
//         sub.remarks = `${sub.remarks} — Stripe session creation failed: ${stripeErr.message}`;
//         await business2.save();
//       }
//       return res.status(502).json({
//         success: false,
//         message: "Failed to create Stripe checkout session",
//         error: stripeErr.message,
//       });
//     }

//     // Attach the session id to the Pending record for later lookup/verification
//     const businessAfter = await BusinessProfileModel.findById(businessId);
//     const sub = businessAfter.subscriptions.find((s) => s.invoiceNo === invoiceNo);
//     if (sub) {
//       sub.stripeCheckoutSessionId = session.id;
//       sub.stripeStatus = session.status; // "open"
//       await businessAfter.save();
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Checkout session created. Redirect the user to checkoutUrl to complete payment.",
//       data: {
//         invoiceNo,
//         checkoutUrl: session.url,
//         checkoutSessionId: session.id,
//         plan: { id: plan.id, name: plan.name, days: plan.days },
//         amount: { subTotal, hst, hstAmount, total, currency: CURRENCY },
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to create checkout session",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    6. STRIPE WEBHOOK
//       Route: POST /subscription/webhook
//       *** MUST be mounted with express.raw({ type: "application/json" }),
//       *** BEFORE your app's global express.json() middleware runs — see
//       *** the mounting note in subscription.routes.js. Signature
//       *** verification needs the exact raw request bytes; if the body
//       *** has already been JSON-parsed by the time it reaches here,
//       *** constructEvent() will fail on every request.
//       Handles:
//         - checkout.session.completed -> mark Paid, extend expiry
//         - checkout.session.expired   -> mark Failed
//       Always acknowledges fast (Stripe retries on non-2xx / timeout).
//    ========================================================= */
// export const handleStripeWebhook = async (req, res) => {
//   const signature = req.headers["stripe-signature"];

//   let event;
//   try {
//     event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) {
//     console.error("[stripe webhook] Signature verification failed:", err.message);
//     return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
//   }

//   try {
//     switch (event.type) {
//       case "checkout.session.completed": {
//         const session = event.data.object;
//         const { businessId, invoiceNo } = session.metadata || {};

//         if (!businessId || !invoiceNo) {
//           console.error("[stripe webhook] checkout.session.completed missing metadata", session.id);
//           break;
//         }

//         const business = await BusinessProfileModel.findById(businessId);
//         if (!business) {
//           console.error("[stripe webhook] Business not found for id:", businessId);
//           break;
//         }

//         const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
//         if (!sub) {
//           console.error("[stripe webhook] Subscription record not found for invoiceNo:", invoiceNo);
//           break;
//         }

//         // Idempotency: Stripe can and does deliver the same webhook event
//         // more than once. If we've already processed this as Paid, don't
//         // extend the expiry a second time.
//         if (sub.paymentStatus === "Paid") {
//           break;
//         }

//         sub.paymentStatus = "Paid";
//         sub.stripeStatus = session.payment_status; // "paid"
//         sub.stripePaymentIntentId = session.payment_intent;
//         sub.stripeCustomerId = session.customer;
//         sub.stripePayload = session;

//         extendExpiry(business, sub.days);
//         await business.save();

//         console.log(`[stripe webhook] Subscription ${invoiceNo} marked Paid, ${sub.days} days added.`);
//         break;
//       }

//       case "checkout.session.expired": {
//         const session = event.data.object;
//         const { businessId, invoiceNo } = session.metadata || {};
//         if (!businessId || !invoiceNo) break;

//         const business = await BusinessProfileModel.findById(businessId);
//         if (!business) break;

//         const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
//         if (sub && sub.paymentStatus === "Pending") {
//           sub.paymentStatus = "Failed";
//           sub.stripeStatus = "expired";
//           await business.save();
//         }
//         break;
//       }

//       default:
//         // Unhandled event types are fine to ignore — acknowledge and move on.
//         break;
//     }

//     return res.status(200).json({ received: true });
//   } catch (error) {
//     console.error("[stripe webhook] Handler error:", error);
//     // Return 500 so Stripe retries this event later rather than silently
//     // dropping a payment confirmation due to a transient DB error.
//     return res.status(500).json({ received: false, error: error.message });
//   }
// };

// /* =========================================================
//    7. VERIFY / CHECK PAYMENT STATUS
//       Route: GET /subscription/:invoiceNo/status
//       Self-healing: if the local record is still "Pending" and has a
//       Stripe session attached, live-checks Stripe directly. This covers
//       the case where the webhook hasn't arrived yet (or was missed) but
//       the user has already been redirected back from Stripe's success
//       page — the frontend can poll this endpoint right after redirect
//       instead of waiting on webhook timing.
//    ========================================================= */
// export const verifyPaymentStatus = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { invoiceNo } = req.params;

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
//     if (!sub) {
//       return res.status(404).json({ success: false, message: "Subscription record not found" });
//     }

//     // Already resolved — no need to call Stripe.
//     if (sub.paymentStatus !== "Pending" || sub.paymentMethod !== "stripe" || !sub.stripeCheckoutSessionId) {
//       return res.status(200).json({
//         success: true,
//         data: {
//           invoiceNo,
//           paymentStatus: sub.paymentStatus,
//           subscriptionExpiresAt: business.subscriptionExpiresAt,
//           daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
//           reconciled: false,
//         },
//       });
//     }

//     // Still Pending locally — check with Stripe directly.
//     let session;
//     try {
//       session = await stripe.checkout.sessions.retrieve(sub.stripeCheckoutSessionId);
//     } catch (stripeErr) {
//       return res.status(502).json({
//         success: false,
//         message: "Failed to verify payment status with Stripe",
//         error: stripeErr.message,
//       });
//     }

//     let reconciled = false;

//     if (session.payment_status === "paid" && sub.paymentStatus !== "Paid") {
//       sub.paymentStatus = "Paid";
//       sub.stripeStatus = session.payment_status;
//       sub.stripePaymentIntentId = session.payment_intent;
//       sub.stripeCustomerId = session.customer;
//       sub.stripePayload = session;
//       extendExpiry(business, sub.days);
//       await business.save();
//       reconciled = true;
//     } else if (session.status === "expired" && sub.paymentStatus === "Pending") {
//       sub.paymentStatus = "Failed";
//       sub.stripeStatus = "expired";
//       await business.save();
//       reconciled = true;
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         invoiceNo,
//         paymentStatus: sub.paymentStatus,
//         stripeStatus: session.status,
//         subscriptionExpiresAt: business.subscriptionExpiresAt,
//         daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
//         reconciled, // true if this call itself just fixed a missed webhook
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to verify payment status",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    8. MANUALLY MARK A NON-STRIPE PENDING SUBSCRIPTION AS PAID
//       Route: PATCH /subscription/:invoiceNo/mark-paid
//       For OFFLINE payment methods only (e.g. e-Transfer confirmed
//       manually by staff). Stripe payments should resolve via the webhook
//       or verifyPaymentStatus instead — this endpoint rejects
//       paymentMethod: "stripe" records to avoid double-crediting days if
//       staff manually confirms something Stripe is also about to confirm.
//    ========================================================= */
// export const markSubscriptionPaid = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { invoiceNo } = req.params;

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
//     if (!sub) {
//       return res.status(404).json({ success: false, message: "Subscription record not found" });
//     }

//     if (sub.paymentMethod === "stripe") {
//       return res.status(400).json({
//         success: false,
//         message: "Stripe payments are confirmed automatically via webhook. Use GET /subscription/:invoiceNo/status to check/reconcile instead.",
//       });
//     }

//     if (sub.paymentStatus === "Paid") {
//       return res.status(409).json({ success: false, message: "This subscription is already marked as Paid" });
//     }

//     sub.paymentStatus = "Paid";
//     extendExpiry(business, sub.days);
//     await business.save();

//     return res.status(200).json({
//       success: true,
//       message: `Subscription ${invoiceNo} marked as Paid. ${sub.days} days added.`,
//       data: {
//         invoiceNo,
//         subscriptionExpiresAt: business.subscriptionExpiresAt,
//         daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to mark subscription as paid",
//       error: error.message,
//     });
//   }
// };

import { User } from "../../Schema/user.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
// import { getNextSequence } from "../../Schema/counter.schema.js";
import { getNextSequence } from "../../Schema/Subscription/subsCounter.schema.js";

import stripe from "../../Config/stripe.js";
import {
  SUBSCRIPTION_PLANS,
  CURRENCY,
  getPlanById,
  getAllPlans,
  computeSubscriptionAmounts,
} from "../../Schema/Subscription/Constants/Subscriptionplans.constant.js";

/* Helper: resolve the caller's businessProfile id from DB (req.user only
   ever has { id, role, ... } from jwtAuth — never businessProfile). Same
   pattern used across every other autoshop controller. */
async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

/**
 * Days remaining until subscriptionExpiresAt, floored at 0.
 */
function computeDaysRemaining(subscriptionExpiresAt) {
  if (!subscriptionExpiresAt) return 0;
  const now = new Date();
  const expiresAt = new Date(subscriptionExpiresAt);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);
  return diff > 0 ? diff : 0;
}

/**
 * Shared "grant days" logic — extends subscriptionExpiresAt from whichever
 * is later: the current expiry (if still active) or today. Used by every
 * code path that can turn a subscription record Paid: the manual
 * purchase endpoint, the Stripe webhook, the self-healing status check,
 * and the manual mark-paid endpoint. Centralized here so all four stay
 * consistent instead of drifting apart over time.
 */
function extendExpiry(business, days) {
  const now = new Date();
  const currentExpiry = business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt) : null;
  const baseDate = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;

  const newExpiresAt = new Date(baseDate);
  newExpiresAt.setDate(newExpiresAt.getDate() + days);
  business.subscriptionExpiresAt = newExpiresAt;
  return newExpiresAt;
}

function checkPrerequisites(business) {
  const hasDomainDetails = (business.domainDetails || []).length > 0;
  const hasWebsiteTemplate = !!business.websiteTemplateId;
  return { hasDomainDetails, hasWebsiteTemplate, ok: hasDomainDetails && hasWebsiteTemplate };
}

const MANUAL_PAYMENT_METHODS = ["Cash", "Void Cheque", "e-Transfer"];
const VALID_PAYMENT_STATUSES = ["Paid", "Pending", "Failed"];

/* =========================================================
   1. GET AVAILABLE PLANS
      Route: GET /subscription/plans
   ========================================================= */
export const getPlans = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        currency: CURRENCY,
        plans: getAllPlans().map((plan) => ({
          ...plan,
          ...computeSubscriptionAmounts(plan),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
      error: error.message,
    });
  }
};

/* =========================================================
   2. GET CURRENT SUBSCRIPTION STATUS
      Route: GET /subscription/status
   ========================================================= */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId).select(
      "subscriptionExpiresAt subscriptions domainDetails websiteTemplateId"
    );
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const daysRemaining = computeDaysRemaining(business.subscriptionExpiresAt);
    const lastPurchase = business.subscriptions.length
      ? business.subscriptions[business.subscriptions.length - 1]
      : null;

    return res.status(200).json({
      success: true,
      data: {
        isActive: daysRemaining > 0,
        daysRemaining,
        subscriptionExpiresAt: business.subscriptionExpiresAt,
        lastPurchase,
        totalPurchases: business.subscriptions.length,
        prerequisites: checkPrerequisites(business),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription status",
      error: error.message,
    });
  }
};

/* =========================================================
   3. GET SUBSCRIPTION / PURCHASE HISTORY
      Route: GET /subscription/history?page=&limit=
   ========================================================= */
export const getSubscriptionHistory = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

    const business = await BusinessProfileModel.findById(businessId).select("subscriptions");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const sorted = [...business.subscriptions].sort(
      (a, b) => new Date(b.purchasedOn) - new Date(a.purchasedOn)
    );

    const total = sorted.length;
    const start = (pageNum - 1) * limitNum;
    const pageItems = sorted.slice(start, start + limitNum);

    return res.status(200).json({
      success: true,
      data: pageItems,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
      error: error.message,
    });
  }
};

/* =========================================================
   4. MANUAL PURCHASE (Cash / Void Cheque / e-Transfer)
      Route: POST /subscription/purchase
      Body: { planId, paymentMethod, referenceId?, remarks?, paymentStatus? }
      For offline payment methods only — card payments go through
      createCheckoutSession below instead. paymentMethod: "stripe" is
      rejected here with a 400 pointing at the correct endpoint.
   ========================================================= */
export const purchaseSubscription = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { planId, paymentMethod, referenceId, remarks, paymentStatus } = req.body;

    const plan = getPlanById(planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Invalid planId. Valid values are: ${Object.keys(SUBSCRIPTION_PLANS).join(", ")}`,
      });
    }

    if (paymentMethod === "stripe") {
      return res.status(400).json({
        success: false,
        message: "For card payments, use POST /subscription/checkout instead of this endpoint.",
      });
    }
    if (!paymentMethod || !MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `paymentMethod is required and must be one of: ${MANUAL_PAYMENT_METHODS.join(", ")}`,
      });
    }

    if (paymentStatus !== undefined && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentStatus. Valid values are: ${VALID_PAYMENT_STATUSES.join(", ")}`,
      });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const prereq = checkPrerequisites(business);
    if (!prereq.ok) {
      const missing = [];
      if (!prereq.hasDomainDetails) missing.push("domain details (POST /domain-details/add)");
      if (!prereq.hasWebsiteTemplate) missing.push("a website template (POST /website-template/select)");
      return res.status(403).json({
        success: false,
        message: `Cannot purchase a subscription until you've submitted: ${missing.join(" and ")}.`,
      });
    }

    const { amount, subTotal, hst, hstAmount, total } = computeSubscriptionAmounts(plan);

    const year = new Date().getFullYear();
    const seq = await getNextSequence("invoiceNo");
    const invoiceNo = `INV-${year}-${String(seq).padStart(5, "0")}`;

    const finalStatus = paymentStatus || "Paid";

    business.subscriptions.push({
      days: plan.days,
      amount,
      subTotal,
      hst,
      hstAmount,
      total,
      purchasedOn: new Date(),
      invoiceNo,
      paymentStatus: finalStatus,
      paymentMethod,
      referenceId,
      remarks: remarks || `${plan.name} (${plan.days} days)`,
    });

    if (finalStatus === "Paid") {
      extendExpiry(business, plan.days);
    }

    await business.save();

    return res.status(201).json({
      success: true,
      message:
        finalStatus === "Paid"
          ? `Subscription purchased successfully. ${plan.days} days added.`
          : `Subscription recorded with status "${finalStatus}" — no days added until marked Paid.`,
      data: {
        invoiceNo,
        plan: { id: plan.id, name: plan.name, days: plan.days },
        amount: { subTotal, hst, hstAmount, total, currency: CURRENCY },
        paymentStatus: finalStatus,
        subscriptionExpiresAt: business.subscriptionExpiresAt,
        daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to purchase subscription",
      error: error.message,
    });
  }
};

/* =========================================================
   5. CREATE STRIPE CHECKOUT SESSION
      Route: POST /subscription/checkout
      Body: { planId, successUrl?, cancelUrl? }
      Creates a Pending subscription record (so it shows up in history
      immediately) + a Stripe Checkout Session for a ONE-TIME payment
      (mode: "payment", not Stripe's native recurring "subscription"
      mode — your day-stacking logic is custom, so Stripe is used purely
      as a payment collector here, not a billing engine).
      Returns the Stripe-hosted checkout URL for the frontend to redirect
      the user to.
   ========================================================= */
export const createCheckoutSession = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { planId, successUrl, cancelUrl } = req.body;

    const plan = getPlanById(planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Invalid planId. Valid values are: ${Object.keys(SUBSCRIPTION_PLANS).join(", ")}`,
      });
    }

    const finalSuccessUrl = successUrl || process.env.STRIPE_SUBSCRIPTION_SUCCESS_URL;
    const finalCancelUrl = cancelUrl || process.env.STRIPE_SUBSCRIPTION_CANCEL_URL;
    if (!finalSuccessUrl || !finalCancelUrl) {
      return res.status(400).json({
        success: false,
        message:
          "successUrl and cancelUrl are required (either in the request body, or set STRIPE_SUBSCRIPTION_SUCCESS_URL / STRIPE_SUBSCRIPTION_CANCEL_URL env vars as a fallback).",
      });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const prereq = checkPrerequisites(business);
    if (!prereq.ok) {
      const missing = [];
      if (!prereq.hasDomainDetails) missing.push("domain details (POST /domain-details/add)");
      if (!prereq.hasWebsiteTemplate) missing.push("a website template (POST /website-template/select)");
      return res.status(403).json({
        success: false,
        message: `Cannot purchase a subscription until you've submitted: ${missing.join(" and ")}.`,
      });
    }

    const { amount, subTotal, hst, hstAmount, total } = computeSubscriptionAmounts(plan);

    const year = new Date().getFullYear();
    const seq = await getNextSequence("invoiceNo");
    const invoiceNo = `INV-${year}-${String(seq).padStart(5, "0")}`;

    // Create the Pending record FIRST so a webhook that arrives before
    // this function even finishes responding still has something to match
    // against (Stripe webhooks can genuinely race the HTTP response).
    business.subscriptions.push({
      days: plan.days,
      amount,
      subTotal,
      hst,
      hstAmount,
      total,
      purchasedOn: new Date(),
      invoiceNo,
      paymentStatus: "Pending",
      paymentMethod: "stripe",
      remarks: `${plan.name} (${plan.days} days) — awaiting Stripe payment`,
    });
    await business.save();

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: CURRENCY.toLowerCase(),
              product_data: {
                name: plan.name,
                description: plan.features.join(" | "),
              },
              unit_amount: Math.round(total * 100), // Stripe expects the smallest currency unit (cents)
            },
            quantity: 1,
          },
        ],
        success_url: `${finalSuccessUrl}${finalSuccessUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}&invoiceNo=${invoiceNo}`,
        cancel_url: `${finalCancelUrl}${finalCancelUrl.includes("?") ? "&" : "?"}invoiceNo=${invoiceNo}`,
        client_reference_id: invoiceNo,
        metadata: {
          businessId: businessId.toString(),
          invoiceNo,
          planId: plan.id,
        },
      });
    } catch (stripeErr) {
      // Stripe call failed — mark the Pending record Failed rather than
      // leaving an orphaned Pending entry with no way to ever resolve it.
      const business2 = await BusinessProfileModel.findById(businessId);
      const sub = business2.subscriptions.find((s) => s.invoiceNo === invoiceNo);
      if (sub) {
        sub.paymentStatus = "Failed";
        sub.remarks = `${sub.remarks} — Stripe session creation failed: ${stripeErr.message}`;
        await business2.save();
      }
      return res.status(502).json({
        success: false,
        message: "Failed to create Stripe checkout session",
        error: stripeErr.message,
      });
    }

    // Attach the session id to the Pending record for later lookup/verification
    const businessAfter = await BusinessProfileModel.findById(businessId);
    const sub = businessAfter.subscriptions.find((s) => s.invoiceNo === invoiceNo);
    if (sub) {
      sub.stripeCheckoutSessionId = session.id;
      sub.stripeStatus = session.status; // "open"
      await businessAfter.save();
    }

    return res.status(201).json({
      success: true,
      message: "Checkout session created. Redirect the user to checkoutUrl to complete payment.",
      data: {
        invoiceNo,
        checkoutUrl: session.url,
        checkoutSessionId: session.id,
        plan: { id: plan.id, name: plan.name, days: plan.days },
        amount: { subTotal, hst, hstAmount, total, currency: CURRENCY },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

/* =========================================================
   6. STRIPE WEBHOOK
      Route: POST /subscription/webhook
      *** MUST be mounted with express.raw({ type: "application/json" }),
      *** BEFORE your app's global express.json() middleware runs — see
      *** the mounting note in subscription.routes.js. Signature
      *** verification needs the exact raw request bytes; if the body
      *** has already been JSON-parsed by the time it reaches here,
      *** constructEvent() will fail on every request.
      Handles:
        - checkout.session.completed -> mark Paid, extend expiry
        - checkout.session.expired   -> mark Failed
      Always acknowledges fast (Stripe retries on non-2xx / timeout).
   ========================================================= */
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { businessId, invoiceNo } = session.metadata || {};

        if (!businessId || !invoiceNo) {
          console.error("[stripe webhook] checkout.session.completed missing metadata", session.id);
          break;
        }

        const business = await BusinessProfileModel.findById(businessId);
        if (!business) {
          console.error("[stripe webhook] Business not found for id:", businessId);
          break;
        }

        const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
        if (!sub) {
          console.error("[stripe webhook] Subscription record not found for invoiceNo:", invoiceNo);
          break;
        }

        // Idempotency: Stripe can and does deliver the same webhook event
        // more than once. If we've already processed this as Paid, don't
        // extend the expiry a second time.
        if (sub.paymentStatus === "Paid") {
          break;
        }

        sub.paymentStatus = "Paid";
        sub.stripeStatus = session.payment_status; // "paid"
        sub.stripePaymentIntentId = session.payment_intent;
        sub.stripeCustomerId = session.customer;
        sub.stripePayload = session;

        extendExpiry(business, sub.days);
        await business.save();

        console.log(`[stripe webhook] Subscription ${invoiceNo} marked Paid, ${sub.days} days added.`);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        const { businessId, invoiceNo } = session.metadata || {};
        if (!businessId || !invoiceNo) break;

        const business = await BusinessProfileModel.findById(businessId);
        if (!business) break;

        const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
        if (sub && sub.paymentStatus === "Pending") {
          sub.paymentStatus = "Failed";
          sub.stripeStatus = "expired";
          await business.save();
        }
        break;
      }

      default:
        // Unhandled event types are fine to ignore — acknowledge and move on.
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[stripe webhook] Handler error:", error);
    // Return 500 so Stripe retries this event later rather than silently
    // dropping a payment confirmation due to a transient DB error.
    return res.status(500).json({ received: false, error: error.message });
  }
};

/* =========================================================
   7. VERIFY / CHECK PAYMENT STATUS
      Route: GET /subscription/:invoiceNo/status
      Self-healing: if the local record is still "Pending" and has a
      Stripe session attached, live-checks Stripe directly. This covers
      the case where the webhook hasn't arrived yet (or was missed) but
      the user has already been redirected back from Stripe's success
      page — the frontend can poll this endpoint right after redirect
      instead of waiting on webhook timing.
   ========================================================= */
export const verifyPaymentStatus = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { invoiceNo } = req.params;

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
    if (!sub) {
      return res.status(404).json({ success: false, message: "Subscription record not found" });
    }

    // Already resolved — no need to call Stripe.
    if (sub.paymentStatus !== "Pending" || sub.paymentMethod !== "stripe" || !sub.stripeCheckoutSessionId) {
      return res.status(200).json({
        success: true,
        data: {
          invoiceNo,
          paymentStatus: sub.paymentStatus,
          subscriptionExpiresAt: business.subscriptionExpiresAt,
          daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
          reconciled: false,
        },
      });
    }

    // Still Pending locally — check with Stripe directly.
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sub.stripeCheckoutSessionId);
    } catch (stripeErr) {
      return res.status(502).json({
        success: false,
        message: "Failed to verify payment status with Stripe",
        error: stripeErr.message,
      });
    }

    let reconciled = false;

    if (session.payment_status === "paid" && sub.paymentStatus !== "Paid") {
      sub.paymentStatus = "Paid";
      sub.stripeStatus = session.payment_status;
      sub.stripePaymentIntentId = session.payment_intent;
      sub.stripeCustomerId = session.customer;
      sub.stripePayload = session;
      extendExpiry(business, sub.days);
      await business.save();
      reconciled = true;
    } else if (session.status === "expired" && sub.paymentStatus === "Pending") {
      sub.paymentStatus = "Failed";
      sub.stripeStatus = "expired";
      await business.save();
      reconciled = true;
    }

    return res.status(200).json({
      success: true,
      data: {
        invoiceNo,
        paymentStatus: sub.paymentStatus,
        stripeStatus: session.status,
        subscriptionExpiresAt: business.subscriptionExpiresAt,
        daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
        reconciled, // true if this call itself just fixed a missed webhook
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment status",
      error: error.message,
    });
  }
};

/* =========================================================
   8. MANUALLY MARK A NON-STRIPE PENDING SUBSCRIPTION AS PAID
      Route: PATCH /subscription/:invoiceNo/mark-paid
      For OFFLINE payment methods only (e.g. e-Transfer confirmed
      manually by staff). Stripe payments should resolve via the webhook
      or verifyPaymentStatus instead — this endpoint rejects
      paymentMethod: "stripe" records to avoid double-crediting days if
      staff manually confirms something Stripe is also about to confirm.
   ========================================================= */
export const markSubscriptionPaid = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { invoiceNo } = req.params;

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const sub = business.subscriptions.find((s) => s.invoiceNo === invoiceNo);
    if (!sub) {
      return res.status(404).json({ success: false, message: "Subscription record not found" });
    }

    if (sub.paymentMethod === "stripe") {
      return res.status(400).json({
        success: false,
        message: "Stripe payments are confirmed automatically via webhook. Use GET /subscription/:invoiceNo/status to check/reconcile instead.",
      });
    }

    if (sub.paymentStatus === "Paid") {
      return res.status(409).json({ success: false, message: "This subscription is already marked as Paid" });
    }

    sub.paymentStatus = "Paid";
    extendExpiry(business, sub.days);
    await business.save();

    return res.status(200).json({
      success: true,
      message: `Subscription ${invoiceNo} marked as Paid. ${sub.days} days added.`,
      data: {
        invoiceNo,
        subscriptionExpiresAt: business.subscriptionExpiresAt,
        daysRemaining: computeDaysRemaining(business.subscriptionExpiresAt),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark subscription as paid",
      error: error.message,
    });
  }
};