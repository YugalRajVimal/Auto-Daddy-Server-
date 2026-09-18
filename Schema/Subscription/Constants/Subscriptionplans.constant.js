// /**
//  * Static subscription plan catalog. Kept as code (not a DB collection)
//  * since there are only two fixed plans with fixed pricing/features — if
//  * you later want admin-editable plans/pricing, this can be migrated to
//  * a Mongoose collection with the same shape.
//  *
//  * `days` is what actually drives the business's subscriptionExpiresAt
//  * math. `price` is in CAD (matches the "CAD 15" note on the bi-weekly
//  * plan) — adjust ISO currency code below if that's wrong.
//  */

// export const CURRENCY = "CAD";

// // Adjust to your actual applicable tax rate (this assumes Ontario HST).
// // Applied uniformly to both plans in computeSubscriptionAmounts() below.
// export const HST_RATE = 0.13;

// export const SUBSCRIPTION_PLANS = {
//   yearly: {
//     id: "yearly",
//     name: "Yearly Plan",
//     price: 365, // CAD, matches "$365 Yearly plan"
//     days: 365,
//     billingCycle: "yearly",
//     features: [
//       "Website (for 365 days)",
//       "Free Software (for 365 days)",
//       "Job Cards (Unlimited)",
//       "Deals Marketplace (Service deals)",
//       "Mobile App (For You and Customers)",
//     ],
//   },
//   biweekly: {
//     id: "biweekly",
//     name: "Bi-weekly Plan",
//     price: 15, // CAD, matches "$15 Bi-weekly plan"
//     days: 14,
//     billingCycle: "biweekly",
//     features: [
//       "Website (for 365 days)",
//       "Free Software (for 365 days)",
//       "Job Cards (Unlimited)",
//       "Deals Marketplace (Service deals)",
//       "Mobile App (For You and Customers)",
//       "26 Void cheques of CAD 15 (for 26 bi-weekly payments)",
//     ],
//   },
// };

// export function getPlanById(planId) {
//   return SUBSCRIPTION_PLANS[planId] || null;
// }

// export function getAllPlans() {
//   return Object.values(SUBSCRIPTION_PLANS);
// }

// /**
//  * Computes the amount breakdown for a plan, matching the shape of
//  * subscriptionSchema on BusinessProfileModel (subTotal, hst, hstAmount, total).
//  */
// export function computeSubscriptionAmounts(plan) {
//   const subTotal = plan.price;
//   const hstAmount = Math.round(subTotal * HST_RATE * 100) / 100; // round to cents
//   const total = Math.round((subTotal + hstAmount) * 100) / 100;
//   return {
//     amount: plan.price,
//     subTotal,
//     hst: HST_RATE,
//     hstAmount,
//     total,
//   };
// }

import { getPlatformSettings } from "../../PlatformSettings/platformSettings.service.js";

export const CURRENCY = "CAD";

/**
 * Website subscription is now the ONLY plan here — optional, CAD 365/year
 * by default, fully admin-editable via PlatformSettings. Software/job-card
 * access is handled entirely by the wallet system, not this file.
 */
export async function getYearlyPlan() {
  const settings = await getPlatformSettings();
  return {
    id: "yearly",
    name: "Website Subscription — Yearly",
    price: settings.websiteSubscriptionPrice,
    days: settings.websiteSubscriptionDays,
    billingCycle: "yearly",
    features: [
      `Website (for ${settings.websiteSubscriptionDays} days)`,
      "Deals Marketplace (Service deals)",
      "Mobile App (For You and Customers)",
    ],
    _hstRate: settings.websiteSubscriptionHstRate,
  };
}

export async function getPlanById(planId) {
  if (planId !== "yearly") return null;
  return getYearlyPlan();
}

export async function getAllPlans() {
  return [await getYearlyPlan()];
}

export function computeSubscriptionAmounts(plan) {
  const subTotal = plan.price;
  const hstRate = plan._hstRate ?? 0.13;
  const hstAmount = Math.round(subTotal * hstRate * 100) / 100;
  const total = Math.round((subTotal + hstAmount) * 100) / 100;
  return { amount: plan.price, subTotal, hst: hstRate, hstAmount, total };
}