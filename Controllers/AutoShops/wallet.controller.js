// // import BusinessProfileModel from "../../Schema/bussiness-profile.js";
// // import { User } from "../../Schema/user.schema.js";
// // import { getPlatformSettings } from "../../Schema/PlatformSettings/platformSettings.service.js";

// // async function getBusinessId(userId) {
// //   const user = await User.findById(userId).select("businessProfile");
// //   return user?.businessProfile || null;
// // }

// // /**
// //  * Trial status: free until softwareTrialStartedAt + settings.trialDays.
// //  */
// // export function computeTrialStatus(business, settings) {
// //   const start = new Date(business.softwareTrialStartedAt || business.createdAt || Date.now());
// //   const expiresAt = new Date(start);
// //   expiresAt.setDate(expiresAt.getDate() + settings.trialDays);
// //   const now = new Date();
// //   const msPerDay = 1000 * 60 * 60 * 24;
// //   const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay));
// //   return { trialActive: now < expiresAt, trialExpiresAt: expiresAt, trialDaysRemaining: daysRemaining };
// // }

// // /**
// //  * Core gate used by jobCard.controller.js. Call BEFORE creating a job card.
// //  * Throws { status, message } style errors the controller can forward.
// //  */
// // export async function assertCanCreateJobCard(businessId) {
// //   const settings = await getPlatformSettings();
// //   const business = await BusinessProfileModel.findById(businessId).select(
// //     "softwareTrialStartedAt createdAt wallet"
// //   );
// //   if (!business) {
// //     const err = new Error("Business not found");
// //     err.status = 404;
// //     throw err;
// //   }

// //   const trial = computeTrialStatus(business, settings);
// //   if (trial.trialActive) {
// //     return { free: true, business, settings, trial };
// //   }

// //   const charge = settings.perJobCardCharge;
// //   const balance = business.wallet?.balance || 0;
// //   if (balance < charge) {
// //     const err = new Error(
// //       `Your free trial has ended. Job card creation costs ${settings.walletCurrency} ${charge.toFixed(2)} from your wallet, and your balance is too low. Please recharge your wallet.`
// //     );
// //     err.status = 402; // Payment Required
// //     err.code = "WALLET_INSUFFICIENT_BALANCE";
// //     throw err;
// //   }

// //   return { free: false, business, settings, trial, charge };
// // }

// // /**
// //  * Actually deducts the fee. Call AFTER the job card has been saved
// //  * successfully, passing the jobCardNo for the transaction record.
// //  */
// // export async function chargeJobCardFee(businessId, jobCardNo, gate) {
// //   if (gate.free) return null; // trial — nothing to deduct
// //   const business = await BusinessProfileModel.findById(businessId).select("wallet");
// //   const charge = gate.charge;
// //   const newBalance = Math.max(0, (business.wallet?.balance || 0) - charge);

// //   business.wallet.balance = newBalance;
// //   business.wallet.transactions.push({
// //     type: "debit",
// //     amount: charge,
// //     balanceAfter: newBalance,
// //     reason: `Job Card #${jobCardNo}`,
// //     jobCardNo,
// //   });
// //   await business.save();
// //   return newBalance;
// // }

// // /* =========================================================
// //    GET /wallet/status
// //    ========================================================= */
// // export const getWalletStatus = async (req, res) => {
// //   try {
// //     const businessId = await getBusinessId(req.user.id);
// //     if (!businessId) {
// //       return res.status(404).json({ success: false, message: "Business profile not found" });
// //     }

// //     const settings = await getPlatformSettings();
// //     const business = await BusinessProfileModel.findById(businessId).select(
// //       "softwareTrialStartedAt createdAt wallet"
// //     );
// //     if (!business) {
// //       return res.status(404).json({ success: false, message: "Business not found" });
// //     }

// //     const trial = computeTrialStatus(business, settings);

// //     return res.status(200).json({
// //       success: true,
// //       data: {
// //         balance: business.wallet?.balance || 0,
// //         currency: settings.walletCurrency,
// //         trialActive: trial.trialActive,
// //         trialDaysRemaining: trial.trialDaysRemaining,
// //         trialExpiresAt: trial.trialExpiresAt,
// //         perJobCardCharge: settings.perJobCardCharge,
// //         minWalletRechargeAmount: settings.minWalletRechargeAmount,
// //       },
// //     });
// //   } catch (error) {
// //     return res.status(500).json({ success: false, message: "Failed to fetch wallet status", error: error.message });
// //   }
// // };

// // /* =========================================================
// //    GET /wallet/history?page=&limit=
// //    ========================================================= */
// // export const getWalletHistory = async (req, res) => {
// //   try {
// //     const businessId = await getBusinessId(req.user.id);
// //     if (!businessId) {
// //       return res.status(404).json({ success: false, message: "Business profile not found" });
// //     }

// //     const { page = 1, limit = 20 } = req.query;
// //     const pageNum = Math.max(1, Number(page) || 1);
// //     const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

// //     const business = await BusinessProfileModel.findById(businessId).select("wallet");
// //     if (!business) {
// //       return res.status(404).json({ success: false, message: "Business not found" });
// //     }

// //     const sorted = [...(business.wallet?.transactions || [])].sort(
// //       (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
// //     );
// //     const total = sorted.length;
// //     const start = (pageNum - 1) * limitNum;
// //     const pageItems = sorted.slice(start, start + limitNum);

// //     return res.status(200).json({
// //       success: true,
// //       data: pageItems,
// //       balance: business.wallet?.balance || 0,
// //       pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
// //     });
// //   } catch (error) {
// //     return res.status(500).json({ success: false, message: "Failed to fetch wallet history", error: error.message });
// //   }
// // };

// // /* =========================================================
// //    POST /wallet/recharge
// //    Body: { amount, paymentMethod, referenceId?, remarks? }
// //    CUSTOM WALLET — no Stripe. Credits the wallet directly. If you later
// //    want to require staff/admin confirmation before crediting, add a
// //    "Pending" transaction type and a mark-paid endpoint mirroring
// //    subscription.controller.js's markSubscriptionPaid.
// //    ========================================================= */
// // export const rechargeWallet = async (req, res) => {
// //   try {
// //     const businessId = await getBusinessId(req.user.id);
// //     if (!businessId) {
// //       return res.status(404).json({ success: false, message: "Business profile not found" });
// //     }

// //     const { amount, paymentMethod, referenceId, remarks } = req.body;
// //     const settings = await getPlatformSettings();

// //     const numericAmount = Number(amount);
// //     if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
// //       return res.status(400).json({ success: false, message: "A valid recharge amount is required" });
// //     }
// //     if (numericAmount < settings.minWalletRechargeAmount) {
// //       return res.status(400).json({
// //         success: false,
// //         message: `Minimum wallet recharge is ${settings.walletCurrency} ${settings.minWalletRechargeAmount.toFixed(2)}`,
// //       });
// //     }

// //     const business = await BusinessProfileModel.findById(businessId).select("wallet");
// //     if (!business) {
// //       return res.status(404).json({ success: false, message: "Business not found" });
// //     }

// //     const newBalance = (business.wallet?.balance || 0) + numericAmount;
// //     business.wallet.balance = newBalance;
// //     business.wallet.transactions.push({
// //       type: "recharge",
// //       amount: numericAmount,
// //       balanceAfter: newBalance,
// //       reason: remarks || "Wallet recharge",
// //       paymentMethod: paymentMethod || "Manual",
// //       referenceId,
// //     });
// //     await business.save();

// //     return res.status(201).json({
// //       success: true,
// //       message: `Wallet recharged with ${settings.walletCurrency} ${numericAmount.toFixed(2)}`,
// //       data: { balance: newBalance, currency: settings.walletCurrency },
// //     });
// //   } catch (error) {
// //     return res.status(500).json({ success: false, message: "Failed to recharge wallet", error: error.message });
// //   }
// // };

// import mongoose from "mongoose";
// import BusinessProfileModel from "../../Schema/bussiness-profile.js";
// import { User } from "../../Schema/user.schema.js";
// import { getPlatformSettings } from "../../Schema/PlatformSettings/platformSettings.service.js";
// import stripe from "../../config/stripe.js";

// // Roles allowed to perform a manual wallet balance adjustment. Mirrors the
// // STAFF_ROLES set recognized by jwtAuth (auth.middleware.js) — only staff
// // accounts ever get req.user.role set to one of these; ordinary autoshop
// // owner users never do, so this alone is enough to gate the endpoint.
// const ADJUSTMENT_ROLES = ["admin"]; // "admin" == superadmin staff role (isSuperAdmin: true)

// async function getBusinessId(userId) {
//   const user = await User.findById(userId).select("businessProfile");
//   return user?.businessProfile || null;
// }

// /**
//  * Trial status: free until softwareTrialStartedAt + settings.trialDays.
//  */
// export function computeTrialStatus(business, settings) {
//   const start = new Date(business.softwareTrialStartedAt || business.createdAt || Date.now());
//   const expiresAt = new Date(start);
//   expiresAt.setDate(expiresAt.getDate() + settings.trialDays);
//   const now = new Date();
//   const msPerDay = 1000 * 60 * 60 * 24;
//   const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay));
//   return { trialActive: now < expiresAt, trialExpiresAt: expiresAt, trialDaysRemaining: daysRemaining };
// }

// /**
//  * Fast, ADVISORY pre-check used by jobCard.controller.js to fail early
//  * (before it does the heavier vehicle/customer/service validation) when the
//  * wallet is obviously out of trial and out of balance. This reads the
//  * balance outside any transaction, so it is NOT the authoritative gate —
//  * two concurrent requests can both pass this check against the same stale
//  * balance. The real, atomic, race-free check-and-deduct is
//  * chargeJobCardFee() below, which MUST run inside the same transaction as
//  * the job card save. Never charge the wallet based on this function's
//  * result alone.
//  */
// export async function assertCanCreateJobCard(businessId) {
//   const settings = await getPlatformSettings();
//   const business = await BusinessProfileModel.findById(businessId).select(
//     "softwareTrialStartedAt createdAt wallet"
//   );
//   if (!business) {
//     const err = new Error("Business not found");
//     err.status = 404;
//     throw err;
//   }

//   const trial = computeTrialStatus(business, settings);
//   if (trial.trialActive) {
//     return { free: true, business, settings, trial };
//   }

//   const charge = settings.perJobCardCharge;
//   const balance = business.wallet?.balance || 0;
//   if (balance < charge) {
//     const err = new Error(
//       `Your free trial has ended. Job card creation costs ${settings.walletCurrency} ${charge.toFixed(2)} from your wallet, and your balance is too low. Please recharge your wallet.`
//     );
//     err.status = 402; // Payment Required
//     err.code = "WALLET_INSUFFICIENT_BALANCE";
//     throw err;
//   }

//   return { free: false, business, settings, trial, charge };
// }

// /**
//  * Atomically checks-and-deducts the per-job-card fee. MUST be called inside
//  * a Mongoose session that is also used for the JobCardCounter increment and
//  * the JobCard.save() call, and the caller must abort the whole transaction
//  * if this throws, or if the job card save fails after this succeeds.
//  *
//  * Race-safety comes from two things working together:
//  *  1. The balance check and the deduction are the SAME atomic MongoDB
//  *     operation (findOneAndUpdate with a `wallet.balance: { $gte: charge }`
//  *     filter). MongoDB evaluates the filter and applies the update as one
//  *     document-level compare-and-swap — there is no gap between "read
//  *     balance" and "write balance" for something else to land in. Two
//  *     concurrent requests for the same business are naturally serialized
//  *     here: whichever update commits first moves the balance down, and the
//  *     second one's filter is re-evaluated against that new (lower) balance,
//  *     so it can legitimately fail even though both requests originally saw
//  *     a sufficient balance.
//  *  2. It never trusts a `gate` computed earlier in the request (the old
//  *     signature took one) — trial status and balance are re-read fresh,
//  *     inside the session, right before the deduct.
//  *
//  * Returns { free: true } during the trial (no deduction), or
//  * { free: false, balance, charge } after a successful atomic deduction.
//  * Throws a 402/WALLET_INSUFFICIENT_BALANCE error if the balance filter
//  * doesn't match — the caller should abort the transaction on this.
//  */
// export async function chargeJobCardFee(businessId, jobCardNo, session) {
//   const settings = await getPlatformSettings();

//   const business = await BusinessProfileModel.findById(businessId)
//     .select("softwareTrialStartedAt createdAt wallet")
//     .session(session);
//   if (!business) {
//     const err = new Error("Business not found");
//     err.status = 404;
//     throw err;
//   }

//   const trial = computeTrialStatus(business, settings);
//   if (trial.trialActive) {
//     return { free: true, balance: business.wallet?.balance || 0 };
//   }

//   const charge = settings.perJobCardCharge;

//   // Single atomic compare-and-swap: match only if the balance is still
//   // sufficient, decrement it, and append the transaction row — all in one
//   // MongoDB operation via an aggregation-pipeline update, so balanceAfter
//   // is computed server-side from the same $subtract as the balance write
//   // (no second read-modify-write that could itself race).
//   const updated = await BusinessProfileModel.findOneAndUpdate(
//     { _id: businessId, "wallet.balance": { $gte: charge } },
//     [
//       {
//         $set: {
//           "wallet.balance": { $subtract: ["$wallet.balance", charge] },
//         },
//       },
//       {
//         $set: {
//           "wallet.transactions": {
//             $concatArrays: [
//               "$wallet.transactions",
//               [
//                 {
//                   _id: new mongoose.Types.ObjectId(),
//                   type: "debit",
//                   amount: charge,
//                   balanceAfter: "$wallet.balance",
//                   reason: `Job Card #${jobCardNo}`,
//                   jobCardNo,
//                   paymentStatus: "Paid",
//                   createdAt: new Date(),
//                 },
//               ],
//             ],
//           },
//         },
//       },
//     ],
//     { new: true, session }
//   );

//   if (!updated) {
//     // Either the balance was too low from the start, or another concurrent
//     // request (double submit, or a different tab) already spent it down
//     // between this request reading the trial/settings and reaching here.
//     // Either way, the caller MUST abort its transaction — no job card
//     // should be persisted for this attempt.
//     const err = new Error(
//       `Your free trial has ended. Job card creation costs ${settings.walletCurrency} ${charge.toFixed(2)} from your wallet, and your balance is too low. Please recharge your wallet.`
//     );
//     err.status = 402;
//     err.code = "WALLET_INSUFFICIENT_BALANCE";
//     throw err;
//   }

//   return { free: false, balance: updated.wallet.balance, charge };
// }

// /* =========================================================
//    GET /wallet/status
//    ========================================================= */
// export const getWalletStatus = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const settings = await getPlatformSettings();
//     const business = await BusinessProfileModel.findById(businessId).select(
//       "softwareTrialStartedAt createdAt wallet"
//     );
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const trial = computeTrialStatus(business, settings);

//     return res.status(200).json({
//       success: true,
//       data: {
//         balance: business.wallet?.balance || 0,
//         currency: settings.walletCurrency,
//         trialActive: trial.trialActive,
//         trialDaysRemaining: trial.trialDaysRemaining,
//         trialExpiresAt: trial.trialExpiresAt,
//         perJobCardCharge: settings.perJobCardCharge,
//         minWalletRechargeAmount: settings.minWalletRechargeAmount,
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Failed to fetch wallet status", error: error.message });
//   }
// };

// /* =========================================================
//    GET /wallet/history?page=&limit=
//    ========================================================= */
// export const getWalletHistory = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { page = 1, limit = 20 } = req.query;
//     const pageNum = Math.max(1, Number(page) || 1);
//     const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

//     const business = await BusinessProfileModel.findById(businessId).select("wallet");
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const sorted = [...(business.wallet?.transactions || [])].sort(
//       (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//     );
//     const total = sorted.length;
//     const start = (pageNum - 1) * limitNum;
//     const pageItems = sorted.slice(start, start + limitNum);

//     return res.status(200).json({
//       success: true,
//       data: pageItems,
//       balance: business.wallet?.balance || 0,
//       pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Failed to fetch wallet history", error: error.message });
//   }
// };

// /* =========================================================
//    POST /wallet/checkout
//    Body: { amount, successUrl?, cancelUrl? }
//    Creates a Stripe Checkout Session for a wallet top-up. Mirrors
//    subscription.controller.js's createCheckoutSession:
//      - validates the amount against platformSettings.minWalletRechargeAmount
//      - writes a "Pending" wallet transaction FIRST (balance is untouched),
//        so a webhook that races the HTTP response still has something to
//        match against via stripeCheckoutSessionId
//      - the balance is only ever credited later, by
//        handleWalletCheckoutCompleted() (webhook) or
//        verifyWalletCheckoutStatus() (self-heal poll) — NEVER here.
//    Returns the Stripe-hosted checkout URL for the frontend to redirect to.
//    ========================================================= */
// export const createWalletCheckoutSession = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { amount, successUrl, cancelUrl } = req.body;
//     const settings = await getPlatformSettings();

//     const numericAmount = Number(amount);
//     if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
//       return res.status(400).json({ success: false, message: "A valid recharge amount is required" });
//     }
//     if (numericAmount < settings.minWalletRechargeAmount) {
//       return res.status(400).json({
//         success: false,
//         message: `Minimum wallet recharge is ${settings.walletCurrency} ${settings.minWalletRechargeAmount.toFixed(2)}`,
//       });
//     }

//     const finalSuccessUrl = successUrl || process.env.STRIPE_WALLET_SUCCESS_URL;
//     const finalCancelUrl = cancelUrl || process.env.STRIPE_WALLET_CANCEL_URL;
//     if (!finalSuccessUrl || !finalCancelUrl) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "successUrl and cancelUrl are required (either in the request body, or set STRIPE_WALLET_SUCCESS_URL / STRIPE_WALLET_CANCEL_URL env vars as a fallback).",
//       });
//     }

//     const business = await BusinessProfileModel.findById(businessId).select("wallet");
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const currentBalance = business.wallet?.balance || 0;

//     // Pending record first — balanceAfter is a placeholder (unchanged
//     // balance) until this flips to Paid; see the comment on
//     // walletTransactionSchema.paymentStatus in bussiness-profile.js.
//     business.wallet.transactions.push({
//       type: "recharge",
//       amount: numericAmount,
//       balanceAfter: currentBalance,
//       reason: "Wallet recharge — awaiting Stripe payment",
//       paymentMethod: "stripe",
//       paymentStatus: "Pending",
//     });
//     await business.save();

//     const pendingTxn = business.wallet.transactions[business.wallet.transactions.length - 1];
//     const transactionId = pendingTxn._id.toString();

//     let session;
//     try {
//       session = await stripe.checkout.sessions.create({
//         mode: "payment",
//         payment_method_types: ["card"],
//         line_items: [
//           {
//             price_data: {
//               currency: settings.walletCurrency.toLowerCase(),
//               product_data: {
//                 name: "Software Wallet Recharge",
//                 description: `Add ${settings.walletCurrency} ${numericAmount.toFixed(2)} to your Auto Daddy wallet`,
//               },
//               unit_amount: Math.round(numericAmount * 100), // smallest currency unit
//             },
//             quantity: 1,
//           },
//         ],
//         success_url: `${finalSuccessUrl}${finalSuccessUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${finalCancelUrl}${finalCancelUrl.includes("?") ? "&" : "?"}transactionId=${transactionId}`,
//         client_reference_id: transactionId,
//         metadata: {
//           businessId: businessId.toString(),
//           type: "wallet_recharge",
//           amount: String(numericAmount),
//           transactionId,
//         },
//       });
//     } catch (stripeErr) {
//       // Stripe call failed — mark the Pending row Failed rather than leaving
//       // an orphaned Pending entry with no way to ever resolve it.
//       const business2 = await BusinessProfileModel.findById(businessId).select("wallet");
//       const txn = business2.wallet.transactions.id(transactionId);
//       if (txn) {
//         txn.paymentStatus = "Failed";
//         txn.reason = `${txn.reason} — Stripe session creation failed: ${stripeErr.message}`;
//         await business2.save();
//       }
//       return res.status(502).json({
//         success: false,
//         message: "Failed to create Stripe checkout session",
//         error: stripeErr.message,
//       });
//     }

//     // Attach the session id to the Pending row for later lookup/verification
//     const businessAfter = await BusinessProfileModel.findById(businessId).select("wallet");
//     const txn = businessAfter.wallet.transactions.id(transactionId);
//     if (txn) {
//       txn.stripeCheckoutSessionId = session.id;
//       txn.stripeStatus = session.status; // "open"
//       await businessAfter.save();
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Checkout session created. Redirect the user to checkoutUrl to complete payment.",
//       data: {
//         transactionId,
//         checkoutUrl: session.url,
//         checkoutSessionId: session.id,
//         amount: numericAmount,
//         currency: settings.walletCurrency,
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to create wallet checkout session",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    GET /wallet/checkout/:sessionId/status
//    Self-healing status poll — same pattern as subscription.controller.js's
//    verifyPaymentStatus. If the local Pending row hasn't been resolved by the
//    webhook yet, live-checks Stripe directly and credits the wallet if paid.
//    Idempotent: won't double-credit if the webhook already processed it (or
//    vice versa) because it only acts while paymentStatus is still "Pending".
//    ========================================================= */
// export const verifyWalletCheckoutStatus = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const { sessionId } = req.params;

//     const business = await BusinessProfileModel.findById(businessId).select("wallet");
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const txn = business.wallet.transactions.find((t) => t.stripeCheckoutSessionId === sessionId);
//     if (!txn) {
//       return res.status(404).json({ success: false, message: "Wallet checkout session not found" });
//     }

//     // Already resolved — no need to call Stripe.
//     if (txn.paymentStatus !== "Pending") {
//       return res.status(200).json({
//         success: true,
//         data: {
//           transactionId: txn._id,
//           paymentStatus: txn.paymentStatus,
//           balance: business.wallet.balance,
//           reconciled: false,
//         },
//       });
//     }

//     // Still Pending locally — check with Stripe directly.
//     let session;
//     try {
//       session = await stripe.checkout.sessions.retrieve(sessionId);
//     } catch (stripeErr) {
//       return res.status(502).json({
//         success: false,
//         message: "Failed to verify payment status with Stripe",
//         error: stripeErr.message,
//       });
//     }

//     let reconciled = false;

//     if (session.payment_status === "paid" && txn.paymentStatus !== "Paid") {
//       const newBalance = (business.wallet.balance || 0) + txn.amount;
//       business.wallet.balance = newBalance;
//       txn.paymentStatus = "Paid";
//       txn.balanceAfter = newBalance;
//       txn.reason = "Wallet recharge";
//       txn.stripeStatus = session.payment_status;
//       txn.stripePaymentIntentId = session.payment_intent;
//       txn.stripeCustomerId = session.customer;
//       txn.stripePayload = session;
//       await business.save();
//       reconciled = true;
//     } else if (session.status === "expired" && txn.paymentStatus === "Pending") {
//       txn.paymentStatus = "Failed";
//       txn.stripeStatus = "expired";
//       await business.save();
//       reconciled = true;
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         transactionId: txn._id,
//         paymentStatus: txn.paymentStatus,
//         stripeStatus: session.status,
//         balance: business.wallet.balance,
//         reconciled, // true if this call itself just fixed a missed webhook
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to verify wallet checkout status",
//       error: error.message,
//     });
//   }
// };

// /**
//  * Called from subscription.controller.js's handleStripeWebhook (the single
//  * Stripe webhook endpoint handles both subscription and wallet checkout
//  * sessions, distinguished by session.metadata.type) when a
//  * checkout.session.completed event's metadata.type === "wallet_recharge".
//  * Exported so the webhook handler can stay the one and only place that
//  * verifies the Stripe signature and dispatches by event/metadata type.
//  */
// export async function handleWalletCheckoutCompleted(session) {
//   const { businessId, transactionId } = session.metadata || {};
//   if (!businessId || !transactionId) {
//     console.error("[stripe webhook] wallet_recharge missing metadata", session.id);
//     return;
//   }

//   const business = await BusinessProfileModel.findById(businessId).select("wallet");
//   if (!business) {
//     console.error("[stripe webhook] Business not found for id:", businessId);
//     return;
//   }

//   const txn = business.wallet.transactions.id(transactionId);
//   if (!txn) {
//     console.error("[stripe webhook] Wallet transaction not found for id:", transactionId);
//     return;
//   }

//   // Idempotency: Stripe can and does deliver the same webhook event more
//   // than once, and verifyWalletCheckoutStatus() can race it too.
//   if (txn.paymentStatus === "Paid") {
//     return;
//   }

//   const newBalance = (business.wallet.balance || 0) + txn.amount;
//   business.wallet.balance = newBalance;
//   txn.paymentStatus = "Paid";
//   txn.balanceAfter = newBalance;
//   txn.reason = "Wallet recharge";
//   txn.stripeStatus = session.payment_status; // "paid"
//   txn.stripePaymentIntentId = session.payment_intent;
//   txn.stripeCustomerId = session.customer;
//   txn.stripePayload = session;
//   await business.save();

//   console.log(`[stripe webhook] Wallet recharge ${transactionId} credited, new balance ${newBalance}.`);
// }

// /**
//  * Mirror of handleWalletCheckoutCompleted for checkout.session.expired,
//  * called from the same webhook dispatcher.
//  */
// export async function handleWalletCheckoutExpired(session) {
//   const { businessId, transactionId } = session.metadata || {};
//   if (!businessId || !transactionId) return;

//   const business = await BusinessProfileModel.findById(businessId).select("wallet");
//   if (!business) return;

//   const txn = business.wallet.transactions.id(transactionId);
//   if (txn && txn.paymentStatus === "Pending") {
//     txn.paymentStatus = "Failed";
//     txn.stripeStatus = "expired";
//     await business.save();
//   }
// }

// /* =========================================================
//    POST /wallet/adjust
//    ADMIN-ONLY. Replaces the old direct-credit POST /wallet/recharge.
//    Body: { businessId, amount, reason }
//    `amount` may be positive (credit) or negative (debit correction).
//    This is the ONLY remaining way to change a wallet balance without a
//    Stripe payment behind it, and it is logged as type: "adjustment" with
//    the acting admin's id/role attached for audit purposes — never as
//    "recharge", so it can never be mistaken for a paid top-up in the
//    customer-facing wallet history.
//    ========================================================= */
// export const adjustWalletBalance = async (req, res) => {
//   try {
//     if (!ADJUSTMENT_ROLES.includes(req.user.role) && !req.user.isSuperAdmin) {
//       return res.status(403).json({ success: false, message: "Forbidden — admin only" });
//     }

//     const { businessId, amount, reason } = req.body;
//     if (!businessId) {
//       return res.status(400).json({ success: false, message: "businessId is required" });
//     }

//     const numericAmount = Number(amount);
//     if (!Number.isFinite(numericAmount) || numericAmount === 0) {
//       return res.status(400).json({ success: false, message: "A non-zero adjustment amount is required" });
//     }
//     if (!reason || !reason.trim()) {
//       return res.status(400).json({ success: false, message: "A reason is required for manual adjustments" });
//     }

//     const business = await BusinessProfileModel.findById(businessId).select("wallet");
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const newBalance = Math.max(0, (business.wallet?.balance || 0) + numericAmount);
//     business.wallet.balance = newBalance;
//     business.wallet.transactions.push({
//       type: "adjustment",
//       amount: Math.abs(numericAmount),
//       balanceAfter: newBalance,
//       reason: `${numericAmount > 0 ? "Credit" : "Debit"} adjustment: ${reason.trim()}`,
//       paymentMethod: "Manual",
//       paymentStatus: "Paid",
//       adjustedByUserId: req.user.id,
//       adjustedByRole: req.user.role,
//     });
//     await business.save();

//     return res.status(201).json({
//       success: true,
//       message: `Wallet ${numericAmount > 0 ? "credited" : "debited"} by manual adjustment`,
//       data: { balance: newBalance },
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Failed to adjust wallet balance", error: error.message });
//   }
// };

import mongoose from "mongoose";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import { getPlatformSettings } from "../../Schema/PlatformSettings/platformSettings.service.js";
import stripe from "../../config/stripe.js";

// Roles allowed to perform a manual wallet balance adjustment. Mirrors the
// STAFF_ROLES set recognized by jwtAuth (auth.middleware.js) — only staff
// accounts ever get req.user.role set to one of these; ordinary autoshop
// owner users never do, so this alone is enough to gate the endpoint.
const ADJUSTMENT_ROLES = ["admin"]; // "admin" == superadmin staff role (isSuperAdmin: true)

async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

/**
 * Trial status: free until softwareTrialStartedAt + settings.trialDays.
 */
export function computeTrialStatus(business, settings) {
  const start = new Date(business.softwareTrialStartedAt || business.createdAt || Date.now());
  const expiresAt = new Date(start);
  expiresAt.setDate(expiresAt.getDate() + settings.trialDays);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay));
  return { trialActive: now < expiresAt, trialExpiresAt: expiresAt, trialDaysRemaining: daysRemaining };
}

/**
 * Fast, ADVISORY pre-check used by jobCard.controller.js to fail early
 * (before it does the heavier vehicle/customer/service validation) when the
 * wallet is obviously out of trial and out of balance. This reads the
 * balance outside any transaction, so it is NOT the authoritative gate —
 * two concurrent requests can both pass this check against the same stale
 * balance. The real, atomic, race-free check-and-deduct is
 * chargeJobCardFee() below, which MUST run inside the same transaction as
 * the job card save. Never charge the wallet based on this function's
 * result alone.
 */
export async function assertCanCreateJobCard(businessId) {
  const settings = await getPlatformSettings();
  const business = await BusinessProfileModel.findById(businessId).select(
    "softwareTrialStartedAt createdAt wallet"
  );
  if (!business) {
    const err = new Error("Business not found");
    err.status = 404;
    throw err;
  }

  const trial = computeTrialStatus(business, settings);
  if (trial.trialActive) {
    return { free: true, business, settings, trial };
  }

  const charge = settings.perJobCardCharge;
  const balance = business.wallet?.balance || 0;
  if (balance < charge) {
    const err = new Error(
      `Your free trial has ended. Job card creation costs ${settings.walletCurrency} ${charge.toFixed(2)} from your wallet, and your balance is too low. Please recharge your wallet.`
    );
    err.status = 402; // Payment Required
    err.code = "WALLET_INSUFFICIENT_BALANCE";
    throw err;
  }

  return { free: false, business, settings, trial, charge };
}

/**
 * Atomically checks-and-deducts the per-job-card fee. MUST be called inside
 * a Mongoose session that is also used for the JobCardCounter increment and
 * the JobCard.save() call, and the caller must abort the whole transaction
 * if this throws, or if the job card save fails after this succeeds.
 *
 * Race-safety comes from two things working together:
 *  1. The balance check and the deduction are the SAME atomic MongoDB
 *     operation (findOneAndUpdate with a `wallet.balance: { $gte: charge }`
 *     filter). MongoDB evaluates the filter and applies the update as one
 *     document-level compare-and-swap — there is no gap between "read
 *     balance" and "write balance" for something else to land in. Two
 *     concurrent requests for the same business are naturally serialized
 *     here: whichever update commits first moves the balance down, and the
 *     second one's filter is re-evaluated against that new (lower) balance,
 *     so it can legitimately fail even though both requests originally saw
 *     a sufficient balance.
 *  2. It never trusts a `gate` computed earlier in the request (the old
 *     signature took one) — trial status and balance are re-read fresh,
 *     inside the session, right before the deduct.
 *
 * Returns { free: true } during the trial (no deduction), or
 * { free: false, balance, charge } after a successful atomic deduction.
 * Throws a 402/WALLET_INSUFFICIENT_BALANCE error if the balance filter
 * doesn't match — the caller should abort the transaction on this.
 */
export async function chargeJobCardFee(businessId, jobCardNo, session) {
  const settings = await getPlatformSettings();

  const business = await BusinessProfileModel.findById(businessId)
    .select("softwareTrialStartedAt createdAt wallet")
    .session(session);
  if (!business) {
    const err = new Error("Business not found");
    err.status = 404;
    throw err;
  }

  const trial = computeTrialStatus(business, settings);
  if (trial.trialActive) {
    return { free: true, balance: business.wallet?.balance || 0 };
  }

  const charge = settings.perJobCardCharge;

  // Single atomic compare-and-swap: match only if the balance is still
  // sufficient, decrement it, and append the transaction row — all in one
  // MongoDB operation via an aggregation-pipeline update, so balanceAfter
  // is computed server-side from the same $subtract as the balance write
  // (no second read-modify-write that could itself race).
  const updated = await BusinessProfileModel.findOneAndUpdate(
    { _id: businessId, "wallet.balance": { $gte: charge } },
    [
      {
        $set: {
          "wallet.balance": { $subtract: ["$wallet.balance", charge] },
        },
      },
      {
        $set: {
          "wallet.transactions": {
            $concatArrays: [
              "$wallet.transactions",
              [
                {
                  _id: new mongoose.Types.ObjectId(),
                  type: "debit",
                  amount: charge,
                  balanceAfter: "$wallet.balance",
                  reason: `Job Card #${jobCardNo}`,
                  jobCardNo,
                  paymentStatus: "Paid",
                  createdAt: new Date(),
                },
              ],
            ],
          },
        },
      },
    ],
    { new: true, session }
  );

  if (!updated) {
    // Either the balance was too low from the start, or another concurrent
    // request (double submit, or a different tab) already spent it down
    // between this request reading the trial/settings and reaching here.
    // Either way, the caller MUST abort its transaction — no job card
    // should be persisted for this attempt.
    const err = new Error(
      `Your free trial has ended. Job card creation costs ${settings.walletCurrency} ${charge.toFixed(2)} from your wallet, and your balance is too low. Please recharge your wallet.`
    );
    err.status = 402;
    err.code = "WALLET_INSUFFICIENT_BALANCE";
    throw err;
  }

  return { free: false, balance: updated.wallet.balance, charge };
}

/* =========================================================
   GET /wallet/status
   ========================================================= */
export const getWalletStatus = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const settings = await getPlatformSettings();
    const business = await BusinessProfileModel.findById(businessId).select(
      "softwareTrialStartedAt createdAt wallet"
    );
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const trial = computeTrialStatus(business, settings);

    return res.status(200).json({
      success: true,
      data: {
        balance: business.wallet?.balance || 0,
        currency: settings.walletCurrency,
        trialActive: trial.trialActive,
        trialDaysRemaining: trial.trialDaysRemaining,
        trialExpiresAt: trial.trialExpiresAt,
        perJobCardCharge: settings.perJobCardCharge,
        minWalletRechargeAmount: settings.minWalletRechargeAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch wallet status", error: error.message });
  }
};

/* =========================================================
   GET /wallet/history?page=&limit=
   ========================================================= */
export const getWalletHistory = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

    const business = await BusinessProfileModel.findById(businessId).select("wallet");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const sorted = [...(business.wallet?.transactions || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const total = sorted.length;
    const start = (pageNum - 1) * limitNum;
    const pageItems = sorted.slice(start, start + limitNum);

    return res.status(200).json({
      success: true,
      data: pageItems,
      balance: business.wallet?.balance || 0,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch wallet history", error: error.message });
  }
};

/* =========================================================
   POST /wallet/checkout
   Body: { amount, successUrl?, cancelUrl? }
   Creates a Stripe Checkout Session for a wallet top-up. Mirrors
   subscription.controller.js's createCheckoutSession:
     - validates the amount against platformSettings.minWalletRechargeAmount
     - writes a "Pending" wallet transaction FIRST (balance is untouched),
       so a webhook that races the HTTP response still has something to
       match against via stripeCheckoutSessionId
     - the balance is only ever credited later, by
       handleWalletCheckoutCompleted() (webhook) or
       verifyWalletCheckoutStatus() (self-heal poll) — NEVER here.
   Returns the Stripe-hosted checkout URL for the frontend to redirect to.
   ========================================================= */
export const createWalletCheckoutSession = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { amount, successUrl, cancelUrl } = req.body;
    const settings = await getPlatformSettings();

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "A valid recharge amount is required" });
    }
    if (numericAmount < settings.minWalletRechargeAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum wallet recharge is ${settings.walletCurrency} ${settings.minWalletRechargeAmount.toFixed(2)}`,
      });
    }

    const finalSuccessUrl = successUrl || process.env.STRIPE_WALLET_SUCCESS_URL;
    const finalCancelUrl = cancelUrl || process.env.STRIPE_WALLET_CANCEL_URL;
    if (!finalSuccessUrl || !finalCancelUrl) {
      return res.status(400).json({
        success: false,
        message:
          "successUrl and cancelUrl are required (either in the request body, or set STRIPE_WALLET_SUCCESS_URL / STRIPE_WALLET_CANCEL_URL env vars as a fallback).",
      });
    }

    const business = await BusinessProfileModel.findById(businessId).select("wallet");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const currentBalance = business.wallet?.balance || 0;

    // Pending record first — balanceAfter is a placeholder (unchanged
    // balance) until this flips to Paid; see the comment on
    // walletTransactionSchema.paymentStatus in bussiness-profile.js.
    business.wallet.transactions.push({
      type: "recharge",
      amount: numericAmount,
      balanceAfter: currentBalance,
      reason: "Wallet recharge — awaiting Stripe payment",
      paymentMethod: "stripe",
      paymentStatus: "Pending",
    });
    await business.save();

    const pendingTxn = business.wallet.transactions[business.wallet.transactions.length - 1];
    const transactionId = pendingTxn._id.toString();

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: settings.walletCurrency.toLowerCase(),
              product_data: {
                name: "Software Wallet Recharge",
                description: `Add ${settings.walletCurrency} ${numericAmount.toFixed(2)} to your Auto Daddy wallet`,
              },
              unit_amount: Math.round(numericAmount * 100), // smallest currency unit
            },
            quantity: 1,
          },
        ],
        success_url: `${finalSuccessUrl}${finalSuccessUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${finalCancelUrl}${finalCancelUrl.includes("?") ? "&" : "?"}transactionId=${transactionId}`,
        client_reference_id: transactionId,
        metadata: {
          businessId: businessId.toString(),
          type: "wallet_recharge",
          amount: String(numericAmount),
          transactionId,
        },
      });
    } catch (stripeErr) {
      // Stripe call failed — mark the Pending row Failed rather than leaving
      // an orphaned Pending entry with no way to ever resolve it.
      const business2 = await BusinessProfileModel.findById(businessId).select("wallet");
      const txn = business2.wallet.transactions.id(transactionId);
      if (txn) {
        txn.paymentStatus = "Failed";
        txn.reason = `${txn.reason} — Stripe session creation failed: ${stripeErr.message}`;
        await business2.save();
      }
      return res.status(502).json({
        success: false,
        message: "Failed to create Stripe checkout session",
        error: stripeErr.message,
      });
    }

    // Attach the session id to the Pending row for later lookup/verification
    const businessAfter = await BusinessProfileModel.findById(businessId).select("wallet");
    const txn = businessAfter.wallet.transactions.id(transactionId);
    if (txn) {
      txn.stripeCheckoutSessionId = session.id;
      txn.stripeStatus = session.status; // "open"
      await businessAfter.save();
    }

    return res.status(201).json({
      success: true,
      message: "Checkout session created. Redirect the user to checkoutUrl to complete payment.",
      data: {
        transactionId,
        checkoutUrl: session.url,
        checkoutSessionId: session.id,
        amount: numericAmount,
        currency: settings.walletCurrency,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create wallet checkout session",
      error: error.message,
    });
  }
};

/* =========================================================
   GET /wallet/checkout/:sessionId/status
   Self-healing status poll — same pattern as subscription.controller.js's
   verifyPaymentStatus. If the local Pending row hasn't been resolved by the
   webhook yet, live-checks Stripe directly and credits the wallet if paid.
   Idempotent: won't double-credit if the webhook already processed it (or
   vice versa) because it only acts while paymentStatus is still "Pending".
   ========================================================= */
export const verifyWalletCheckoutStatus = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { sessionId } = req.params;

    const business = await BusinessProfileModel.findById(businessId).select("wallet");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const txn = business.wallet.transactions.find((t) => t.stripeCheckoutSessionId === sessionId);
    if (!txn) {
      return res.status(404).json({ success: false, message: "Wallet checkout session not found" });
    }

    // Already resolved — no need to call Stripe.
    if (txn.paymentStatus !== "Pending") {
      return res.status(200).json({
        success: true,
        data: {
          transactionId: txn._id,
          paymentStatus: txn.paymentStatus,
          balance: business.wallet.balance,
          reconciled: false,
        },
      });
    }

    // Still Pending locally — check with Stripe directly.
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (stripeErr) {
      return res.status(502).json({
        success: false,
        message: "Failed to verify payment status with Stripe",
        error: stripeErr.message,
      });
    }

    let reconciled = false;

    if (session.payment_status === "paid" && txn.paymentStatus !== "Paid") {
      const newBalance = (business.wallet.balance || 0) + txn.amount;
      business.wallet.balance = newBalance;
      txn.paymentStatus = "Paid";
      txn.balanceAfter = newBalance;
      txn.reason = "Wallet recharge";
      txn.stripeStatus = session.payment_status;
      txn.stripePaymentIntentId = session.payment_intent;
      txn.stripeCustomerId = session.customer;
      txn.stripePayload = session;
      await business.save();
      reconciled = true;
    } else if (session.status === "expired" && txn.paymentStatus === "Pending") {
      txn.paymentStatus = "Failed";
      txn.stripeStatus = "expired";
      await business.save();
      reconciled = true;
    }

    return res.status(200).json({
      success: true,
      data: {
        transactionId: txn._id,
        paymentStatus: txn.paymentStatus,
        stripeStatus: session.status,
        balance: business.wallet.balance,
        reconciled, // true if this call itself just fixed a missed webhook
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify wallet checkout status",
      error: error.message,
    });
  }
};

/**
 * Called from subscription.controller.js's handleStripeWebhook (the single
 * Stripe webhook endpoint handles both subscription and wallet checkout
 * sessions, distinguished by session.metadata.type) when a
 * checkout.session.completed event's metadata.type === "wallet_recharge".
 * Exported so the webhook handler can stay the one and only place that
 * verifies the Stripe signature and dispatches by event/metadata type.
 */
export async function handleWalletCheckoutCompleted(session) {
  const { businessId, transactionId } = session.metadata || {};
  if (!businessId || !transactionId) {
    console.error("[stripe webhook] wallet_recharge missing metadata", session.id);
    return;
  }

  const business = await BusinessProfileModel.findById(businessId).select("wallet");
  if (!business) {
    console.error("[stripe webhook] Business not found for id:", businessId);
    return;
  }

  const txn = business.wallet.transactions.id(transactionId);
  if (!txn) {
    console.error("[stripe webhook] Wallet transaction not found for id:", transactionId);
    return;
  }

  // Idempotency: Stripe can and does deliver the same webhook event more
  // than once, and verifyWalletCheckoutStatus() can race it too.
  if (txn.paymentStatus === "Paid") {
    return;
  }

  const newBalance = (business.wallet.balance || 0) + txn.amount;
  business.wallet.balance = newBalance;
  txn.paymentStatus = "Paid";
  txn.balanceAfter = newBalance;
  txn.reason = "Wallet recharge";
  txn.stripeStatus = session.payment_status; // "paid"
  txn.stripePaymentIntentId = session.payment_intent;
  txn.stripeCustomerId = session.customer;
  txn.stripePayload = session;
  await business.save();

  console.log(`[stripe webhook] Wallet recharge ${transactionId} credited, new balance ${newBalance}.`);
}

/**
 * Mirror of handleWalletCheckoutCompleted for checkout.session.expired,
 * called from the same webhook dispatcher.
 */
export async function handleWalletCheckoutExpired(session) {
  const { businessId, transactionId } = session.metadata || {};
  if (!businessId || !transactionId) return;

  const business = await BusinessProfileModel.findById(businessId).select("wallet");
  if (!business) return;

  const txn = business.wallet.transactions.id(transactionId);
  if (txn && txn.paymentStatus === "Pending") {
    txn.paymentStatus = "Failed";
    txn.stripeStatus = "expired";
    await business.save();
  }
}

/* =========================================================
   POST /wallet/adjust
   ADMIN-ONLY. Replaces the old direct-credit POST /wallet/recharge.
   Body: { businessId, amount, reason }
   `amount` may be positive (credit) or negative (debit correction).
   This is the ONLY remaining way to change a wallet balance without a
   Stripe payment behind it, and it is logged as type: "adjustment" with
   the acting admin's id/role attached for audit purposes — never as
   "recharge", so it can never be mistaken for a paid top-up in the
   customer-facing wallet history.
   ========================================================= */
export const adjustWalletBalance = async (req, res) => {
  try {
    if (!ADJUSTMENT_ROLES.includes(req.user.role) && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden — admin only" });
    }

    const { businessId, amount, reason } = req.body;
    if (!businessId) {
      return res.status(400).json({ success: false, message: "businessId is required" });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      return res.status(400).json({ success: false, message: "A non-zero adjustment amount is required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "A reason is required for manual adjustments" });
    }

    const business = await BusinessProfileModel.findById(businessId).select("wallet");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const newBalance = Math.max(0, (business.wallet?.balance || 0) + numericAmount);
    business.wallet.balance = newBalance;
    business.wallet.transactions.push({
      type: "adjustment",
      amount: Math.abs(numericAmount),
      balanceAfter: newBalance,
      reason: `${numericAmount > 0 ? "Credit" : "Debit"} adjustment: ${reason.trim()}`,
      paymentMethod: "Manual",
      paymentStatus: "Paid",
      adjustedByUserId: req.user.id,
      adjustedByRole: req.user.role,
    });
    await business.save();

    return res.status(201).json({
      success: true,
      message: `Wallet ${numericAmount > 0 ? "credited" : "debited"} by manual adjustment`,
      data: { balance: newBalance },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to adjust wallet balance", error: error.message });
  }
};