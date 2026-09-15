// // // import express from "express";
// // // import BusinessProfileModel from "../Schema/bussiness-profile.js";
// // // import DealModel from "../Schema/deals.schema.js";
// // // import crypto from "crypto"; // only if needed for comparisons
// // // import { User } from "../Schema/user.schema.js";

// // // const router = express.Router();


// // // // GET /api/public/onboarding/:token
// // // router.get("/onboarding/:token", async (req, res) => {
// // //   const owner = await User.findOne({ onboardingApprovalToken: req.params.token }).populate("businessProfile", "businessName");
// // //   if (!owner) return res.status(404).json({ error: "Invalid or already-used link" });
// // //   if (owner.onboardingTokenExpiresAt < new Date()) return res.status(410).json({ error: "This link has expired" });
// // //   res.json({
// // //     status: owner.onboardingStatus,
// // //     shopName: owner.businessProfile?.businessName,
// // //     onboardedBy: owner.onboardedByStaffName,
// // //     onboardedByRole: owner.onboardedByStaffRole,
// // //   });
// // // });


// // // /**
// // //  * Strip protocol / www / port so "https://www.washngloss.ca:443",
// // //  * "www.washngloss.ca" and "washngloss.ca" all resolve to the same value.
// // //  */
// // // function normalizeDomain(raw) {
// // //   if (!raw) return "";
// // //   return raw
// // //     .replace(/^https?:\/\//, "")
// // //     .replace(/^www\./, "")
// // //     .split(":")[0]
// // //     .split("/")[0]
// // //     .toLowerCase()
// // //     .trim();
// // // }

// // // /**
// // //  * GET /api/public/business?domain=washngloss.ca
// // //  * Resolves a business by the domain the storefront is currently
// // //  * running on. Returns only public-safe marketing fields.
// // //  */
// // // router.get("/business", async (req, res) => {
// // //   try {
// // //     const domain = normalizeDomain(req.query.domain);
// // //     console.log("Domain from query:", req.query.domain, "Normalized:", domain);
// // //     if (!domain) {
// // //       console.log("No domain provided in query param.");
// // //       return res.status(400).json({ error: "domain query param required" });
// // //     }

// // //     const business = await BusinessProfileModel.findOne({
// // //       $or: [{ domainName: domain }, { "domainDetails.domainName": domain }],

// // //     }).select(
// // //       "businessName businessLogo bannerImage businessPhone businessEmail city businessAddress perDayOpenHours specialDayOpenHours"
// // //     );

// // //     console.log("Business lookup result:", business);

// // //     if (!business) {
// // //       console.log(`No business found for domain "${domain}"`);
// // //       return res.status(404).json({ error: "Site not found for this domain" });
// // //     }

// // //     res.json({
// // //       _id: business._id,
// // //       name: business.businessName,
// // //       logo: business.businessLogo,
// // //       banner: business.bannerImage,
// // //       phone: business.businessPhone,
// // //       email: business.businessEmail,
// // //       city: business.city,
// // //       address: business.businessAddress,
// // //       perDayOpenHours: business.perDayOpenHours || [],
// // //       specialDayOpenHours: business.specialDayOpenHours || [],
// // //     });
// // //   } catch (err) {
// // //     console.error("public/business error:", err);
// // //     res.status(500).json({ error: "Server error" });
// // //   }
// // // });

// // // /**
// // //  * GET /api/public/business/:id/deals
// // //  * Active (non-expired) deals for a business, newest first.
// // //  */
// // // router.get("/business/:id/deals", async (req, res) => {
// // //   try {
// // //     const deals = await DealModel.find({
// // //       createdBy: req.params.id,
// // //       offerEndsOnDate: { $gte: new Date() },
// // //     })
// // //       .select(
// // //         "dealType partName subServiceName description discountedPrice originalPrice discountPercentage offerEndsOnDate dealImage selectedVehicle"
// // //       )
// // //       .sort({ createdAt: -1 })
// // //       .limit(20);

// // //     res.json(deals);
// // //   } catch (err) {
// // //     console.error("public/deals error:", err);
// // //     res.status(500).json({ error: "Server error" });
// // //   }
// // // });

// // // /**
// // //  * GET /api/public/business/:id/services
// // //  * Active services this business offers, with sub-service pricing.
// // //  */
// // // router.get("/business/:id/services", async (req, res) => {
// // //   try {
// // //     const business = await BusinessProfileModel.findById(req.params.id)
// // //       .select("myServices")
// // //       .populate("myServices.service", "name slug description icon");

// // //     if (!business) {
// // //       return res.status(404).json({ error: "Not found" });
// // //     }

// // //     const services = business.myServices
// // //       .filter((s) => s.status === "Active")
// // //       .map((s) => ({
// // //         id: s.service?._id,
// // //         name: s.service?.name,
// // //         slug: s.service?.slug,
// // //         description: s.service?.description,
// // //         icon: s.service?.icon,
// // //         subServices: s.subServices,
// // //       }));

// // //     res.json(services);
// // //   } catch (err) {
// // //     console.error("public/services error:", err);
// // //     res.status(500).json({ error: "Server error" });
// // //   }
// // // });

// // // export default router;


// // import express from "express";
// // import BusinessProfileModel from "../Schema/bussiness-profile.js";
// // import DealModel from "../Schema/deals.schema.js";
// // import { User } from "../Schema/user.schema.js";

// // const router = express.Router();

// // /**
// //  * Strip protocol / www / port so "https://www.washngloss.ca:443",
// //  * "www.washngloss.ca" and "washngloss.ca" all resolve to the same value.
// //  */
// // function normalizeDomain(raw) {
// //   if (!raw) return "";
// //   return raw
// //     .replace(/^https?:\/\//, "")
// //     .replace(/^www\./, "")
// //     .split(":")[0]
// //     .split("/")[0]
// //     .toLowerCase()
// //     .trim();
// // }

// // /**
// //  * GET /api/public/business?domain=washngloss.ca
// //  * Resolves a business by the domain the storefront is currently
// //  * running on. Returns only public-safe marketing fields.
// //  */
// // router.get("/business", async (req, res) => {
// //   try {
// //     const domain = normalizeDomain(req.query.domain);
// //     console.log("Domain from query:", req.query.domain, "Normalized:", domain);
// //     if (!domain) {
// //       console.log("No domain provided in query param.");
// //       return res.status(400).json({ error: "domain query param required" });
// //     }

// //     const business = await BusinessProfileModel.findOne({
// //       $or: [{ domainName: domain }, { "domainDetails.domainName": domain }],

// //     }).select(
// //       "businessName businessLogo bannerImage businessPhone businessEmail city businessAddress perDayOpenHours specialDayOpenHours"
// //     );

// //     console.log("Business lookup result:", business);

// //     if (!business) {
// //       console.log(`No business found for domain "${domain}"`);
// //       return res.status(404).json({ error: "Site not found for this domain" });
// //     }

// //     res.json({
// //       _id: business._id,
// //       name: business.businessName,
// //       logo: business.businessLogo,
// //       banner: business.bannerImage,
// //       phone: business.businessPhone,
// //       email: business.businessEmail,
// //       city: business.city,
// //       address: business.businessAddress,
// //       perDayOpenHours: business.perDayOpenHours || [],
// //       specialDayOpenHours: business.specialDayOpenHours || [],
// //     });
// //   } catch (err) {
// //     console.error("public/business error:", err);
// //     res.status(500).json({ error: "Server error" });
// //   }
// // });

// // /**
// //  * GET /api/public/business/:id/deals
// //  * Active (non-expired) deals for a business, newest first.
// //  */
// // router.get("/business/:id/deals", async (req, res) => {
// //   try {
// //     const deals = await DealModel.find({
// //       createdBy: req.params.id,
// //       offerEndsOnDate: { $gte: new Date() },
// //     })
// //       .select(
// //         "dealType partName subServiceName description discountedPrice originalPrice discountPercentage offerEndsOnDate dealImage selectedVehicle"
// //       )
// //       .sort({ createdAt: -1 })
// //       .limit(20);

// //     res.json(deals);
// //   } catch (err) {
// //     console.error("public/deals error:", err);
// //     res.status(500).json({ error: "Server error" });
// //   }
// // });

// // /**
// //  * GET /api/public/business/:id/services
// //  * Active services this business offers, with sub-service pricing.
// //  */
// // router.get("/business/:id/services", async (req, res) => {
// //   try {
// //     const business = await BusinessProfileModel.findById(req.params.id)
// //       .select("myServices")
// //       .populate("myServices.service", "name slug description icon");

// //     if (!business) {
// //       return res.status(404).json({ error: "Not found" });
// //     }

// //     const services = business.myServices
// //       .filter((s) => s.status === "Active")
// //       .map((s) => ({
// //         id: s.service?._id,
// //         name: s.service?.name,
// //         slug: s.service?.slug,
// //         description: s.service?.description,
// //         icon: s.service?.icon,
// //         subServices: s.subServices,
// //       }));

// //     res.json(services);
// //   } catch (err) {
// //     console.error("public/services error:", err);
// //     res.status(500).json({ error: "Server error" });
// //   }
// // });

// // /**
// //  * ─── Shop Owner onboarding approval (Admin/Staff "Onboard" flow) ───────────
// //  *
// //  * When Admin/Staff onboards a shop owner (autoShopOwnerController.createAutoShopOwner)
// //  * the owner is created with onboardingStatus="pending" and gets an SMS with a
// //  * link to this flow. No auth — the token itself is the credential, and it is
// //  * single-use (cleared once approved/rejected) + time-limited.
// //  */

// // function onboardingStatusMessage(status) {
// //   if (status === "approved") return "You have already approved this onboarding request.";
// //   if (status === "rejected") return "You have already rejected this onboarding request.";
// //   return null;
// // }

// // /**
// //  * GET /api/public/onboarding/:token
// //  * Returns enough info to render the approve/reject page.
// //  */
// // router.get("/onboarding/:token", async (req, res) => {
// //   try {
// //     const { token } = req.params;
// //     if (!token) {
// //       return res.status(400).json({ error: "Token is required" });
// //     }

// //     const owner = await User.findOne({
// //       onboardingApprovalToken: token,
// //       role: "autoshopowner",
// //     })
// //       .populate({ path: "businessProfile", select: "businessName city businessAddress" })
// //       .select(
// //         "name email onboardingStatus onboardingTokenExpiresAt onboardedByStaffName onboardedByStaffRole businessProfile"
// //       );

// //     if (!owner) {
// //       return res.status(404).json({ error: "This onboarding link is invalid or has already been used." });
// //     }

// //     if (owner.onboardingTokenExpiresAt && owner.onboardingTokenExpiresAt < new Date()) {
// //       return res.status(410).json({ error: "This onboarding link has expired. Please ask Auto Daddy to resend it." });
// //     }

// //     return res.json({
// //       status: owner.onboardingStatus,
// //       alreadyResponded: owner.onboardingStatus !== "pending",
// //       infoMessage: onboardingStatusMessage(owner.onboardingStatus),
// //       shopOwnerName: owner.name || null,
// //       shopName: owner.businessProfile?.businessName || null,
// //       city: owner.businessProfile?.city || null,
// //       address: owner.businessProfile?.businessAddress || null,
// //       onboardedByName: owner.onboardedByStaffName,
// //       onboardedByRole: owner.onboardedByStaffRole,
// //     });
// //   } catch (err) {
// //     console.error("public/onboarding GET error:", err);
// //     res.status(500).json({ error: "Server error" });
// //   }
// // });

// // /**
// //  * Shared handler for approve/reject so both routes stay in lock-step.
// //  */
// // async function respondToOnboarding(req, res, nextStatus) {
// //   try {
// //     const { token } = req.params;
// //     if (!token) {
// //       return res.status(400).json({ error: "Token is required" });
// //     }

// //     const owner = await User.findOne({
// //       onboardingApprovalToken: token,
// //       role: "autoshopowner",
// //     });

// //     if (!owner) {
// //       return res.status(404).json({ error: "This onboarding link is invalid or has already been used." });
// //     }

// //     if (owner.onboardingTokenExpiresAt && owner.onboardingTokenExpiresAt < new Date()) {
// //       return res.status(410).json({ error: "This onboarding link has expired. Please ask Auto Daddy to resend it." });
// //     }

// //     if (owner.onboardingStatus !== "pending") {
// //       return res.status(409).json({
// //         error: onboardingStatusMessage(owner.onboardingStatus) || "This request has already been responded to.",
// //         status: owner.onboardingStatus,
// //       });
// //     }

// //     owner.onboardingStatus = nextStatus;
// //     owner.onboardingRespondedAt = new Date();
// //     // Single-use: clear the token so the link can't be replayed.
// //     owner.onboardingApprovalToken = null;

// //     // A rejected onboarding shouldn't leave the account active.
// //     if (nextStatus === "rejected") {
// //       owner.isDisabled = true;
// //     }

// //     await owner.save();

// //     return res.json({ success: true, status: owner.onboardingStatus });
// //   } catch (err) {
// //     console.error(`public/onboarding ${nextStatus} error:`, err);
// //     res.status(500).json({ error: "Server error" });
// //   }
// // }

// // // POST /api/public/onboarding/:token/approve
// // router.post("/onboarding/:token/approve", (req, res) => respondToOnboarding(req, res, "approved"));

// // // POST /api/public/onboarding/:token/reject
// // router.post("/onboarding/:token/reject", (req, res) => respondToOnboarding(req, res, "rejected"));

// // export default router;

// import express from "express";
// import BusinessProfileModel from "../Schema/bussiness-profile.js";
// import DealModel from "../Schema/deals.schema.js";
// import { User } from "../Schema/user.schema.js";
// import {
//   getCarOwnerOnboardingByToken,
//   approveCarOwnerOnboarding,
//   rejectCarOwnerOnboarding,
// } from "../Controllers/AutoShops/customers.controller.js";

// const router = express.Router();

// /**
//  * Strip protocol / www / port so "https://www.washngloss.ca:443",
//  * "www.washngloss.ca" and "washngloss.ca" all resolve to the same value.
//  */
// function normalizeDomain(raw) {
//   if (!raw) return "";
//   return raw
//     .replace(/^https?:\/\//, "")
//     .replace(/^www\./, "")
//     .split(":")[0]
//     .split("/")[0]
//     .toLowerCase()
//     .trim();
// }

// /**
//  * GET /api/public/business?domain=washngloss.ca
//  * Resolves a business by the domain the storefront is currently
//  * running on. Returns only public-safe marketing fields.
//  */
// router.get("/business", async (req, res) => {
//   try {
//     const domain = normalizeDomain(req.query.domain);
//     console.log("Domain from query:", req.query.domain, "Normalized:", domain);
//     if (!domain) {
//       console.log("No domain provided in query param.");
//       return res.status(400).json({ error: "domain query param required" });
//     }

//     const business = await BusinessProfileModel.findOne({
//       $or: [{ domainName: domain }, { "domainDetails.domainName": domain }],

//     }).select(
//       "businessName businessLogo bannerImage businessPhone businessEmail city businessAddress perDayOpenHours specialDayOpenHours"
//     );

//     console.log("Business lookup result:", business);

//     if (!business) {
//       console.log(`No business found for domain "${domain}"`);
//       return res.status(404).json({ error: "Site not found for this domain" });
//     }

//     res.json({
//       _id: business._id,
//       name: business.businessName,
//       logo: business.businessLogo,
//       banner: business.bannerImage,
//       phone: business.businessPhone,
//       email: business.businessEmail,
//       city: business.city,
//       address: business.businessAddress,
//       perDayOpenHours: business.perDayOpenHours || [],
//       specialDayOpenHours: business.specialDayOpenHours || [],
//     });
//   } catch (err) {
//     console.error("public/business error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// /**
//  * GET /api/public/business/:id/deals
//  * Active (non-expired) deals for a business, newest first.
//  */
// router.get("/business/:id/deals", async (req, res) => {
//   try {
//     const deals = await DealModel.find({
//       createdBy: req.params.id,
//       offerEndsOnDate: { $gte: new Date() },
//     })
//       .select(
//         "dealType partName subServiceName description discountedPrice originalPrice discountPercentage offerEndsOnDate dealImage selectedVehicle"
//       )
//       .sort({ createdAt: -1 })
//       .limit(20);

//     res.json(deals);
//   } catch (err) {
//     console.error("public/deals error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// /**
//  * GET /api/public/business/:id/services
//  * Active services this business offers, with sub-service pricing.
//  */
// router.get("/business/:id/services", async (req, res) => {
//   try {
//     const business = await BusinessProfileModel.findById(req.params.id)
//       .select("myServices")
//       .populate("myServices.service", "name slug description icon");

//     if (!business) {
//       return res.status(404).json({ error: "Not found" });
//     }

//     const services = business.myServices
//       .filter((s) => s.status === "Active")
//       .map((s) => ({
//         id: s.service?._id,
//         name: s.service?.name,
//         slug: s.service?.slug,
//         description: s.service?.description,
//         icon: s.service?.icon,
//         subServices: s.subServices,
//       }));

//     res.json(services);
//   } catch (err) {
//     console.error("public/services error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// /**
//  * ─── Shop Owner onboarding approval (Admin/Staff "Onboard" flow) ───────────
//  *
//  * When Admin/Staff onboards a shop owner (autoShopOwnerController.createAutoShopOwner)
//  * the owner is created with onboardingStatus="pending" and gets an SMS with a
//  * link to this flow. No auth — the token itself is the credential, and it is
//  * single-use (cleared once approved/rejected) + time-limited.
//  */

// function onboardingStatusMessage(status) {
//   if (status === "approved") return "You have already approved this onboarding request.";
//   if (status === "rejected") return "You have already rejected this onboarding request.";
//   return null;
// }

// /**
//  * GET /api/public/onboarding/:token
//  * Returns enough info to render the approve/reject page.
//  */
// router.get("/onboarding/:token", async (req, res) => {
//   try {
//     const { token } = req.params;
//     if (!token) {
//       return res.status(400).json({ error: "Token is required" });
//     }

//     const owner = await User.findOne({
//       onboardingApprovalToken: token,
//       role: "autoshopowner",
//     })
//       .populate({ path: "businessProfile", select: "businessName city businessAddress" })
//       .select(
//         "name email onboardingStatus onboardingTokenExpiresAt onboardedByStaffName onboardedByStaffRole businessProfile"
//       );

//     if (!owner) {
//       return res.status(404).json({ error: "This onboarding link is invalid or has already been used." });
//     }

//     if (owner.onboardingTokenExpiresAt && owner.onboardingTokenExpiresAt < new Date()) {
//       return res.status(410).json({ error: "This onboarding link has expired. Please ask Auto Daddy to resend it." });
//     }

//     return res.json({
//       status: owner.onboardingStatus,
//       alreadyResponded: owner.onboardingStatus !== "pending",
//       infoMessage: onboardingStatusMessage(owner.onboardingStatus),
//       shopOwnerName: owner.name || null,
//       shopName: owner.businessProfile?.businessName || null,
//       city: owner.businessProfile?.city || null,
//       address: owner.businessProfile?.businessAddress || null,
//       onboardedByName: owner.onboardedByStaffName,
//       onboardedByRole: owner.onboardedByStaffRole,
//     });
//   } catch (err) {
//     console.error("public/onboarding GET error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// /**
//  * Shared handler for approve/reject so both routes stay in lock-step.
//  */
// async function respondToOnboarding(req, res, nextStatus) {
//   try {
//     const { token } = req.params;
//     if (!token) {
//       return res.status(400).json({ error: "Token is required" });
//     }

//     const owner = await User.findOne({
//       onboardingApprovalToken: token,
//       role: "autoshopowner",
//     });

//     if (!owner) {
//       return res.status(404).json({ error: "This onboarding link is invalid or has already been used." });
//     }

//     if (owner.onboardingTokenExpiresAt && owner.onboardingTokenExpiresAt < new Date()) {
//       return res.status(410).json({ error: "This onboarding link has expired. Please ask Auto Daddy to resend it." });
//     }

//     if (owner.onboardingStatus !== "pending") {
//       return res.status(409).json({
//         error: onboardingStatusMessage(owner.onboardingStatus) || "This request has already been responded to.",
//         status: owner.onboardingStatus,
//       });
//     }

//     owner.onboardingStatus = nextStatus;
//     owner.onboardingRespondedAt = new Date();
//     // Single-use: clear the token so the link can't be replayed.
//     owner.onboardingApprovalToken = null;

//     // A rejected onboarding shouldn't leave the account active.
//     if (nextStatus === "rejected") {
//       owner.isDisabled = true;
//     }

//     await owner.save();

//     return res.json({ success: true, status: owner.onboardingStatus });
//   } catch (err) {
//     console.error(`public/onboarding ${nextStatus} error:`, err);
//     res.status(500).json({ error: "Server error" });
//   }
// }

// // POST /api/public/onboarding/:token/approve
// router.post("/onboarding/:token/approve", (req, res) => respondToOnboarding(req, res, "approved"));

// // POST /api/public/onboarding/:token/reject
// router.post("/onboarding/:token/reject", (req, res) => respondToOnboarding(req, res, "rejected"));

// /**
//  * ─── Car Owner onboarding approval (Shop Owner "Onboard Customer" flow) ────
//  * Same idea as the Shop Owner flow above, but the pending/approved/rejected
//  * state lives on business.myCustomers[] (see customers.controller.js ->
//  * onboardCustomer), not on the User doc directly.
//  */
// router.get("/car-owner-onboarding/:token", getCarOwnerOnboardingByToken);
// router.post("/car-owner-onboarding/:token/approve", approveCarOwnerOnboarding);
// router.post("/car-owner-onboarding/:token/reject", rejectCarOwnerOnboarding);

// export default router;

import express from "express";
import BusinessProfileModel from "../Schema/bussiness-profile.js";
import DealModel from "../Schema/deals.schema.js";
import { User } from "../Schema/user.schema.js";
import { submitContactMessage } from "../Controllers/Admin/ ContactMessages.controller.js";
import {
  getCarOwnerOnboardingByToken,
  approveCarOwnerOnboarding,
  rejectCarOwnerOnboarding,
} from "../Controllers/AutoShops/customers.controller.js";

const router = express.Router();

/**
 * Strip protocol / www / port so "https://www.washngloss.ca:443",
 * "www.washngloss.ca" and "washngloss.ca" all resolve to the same value.
 */
function normalizeDomain(raw) {
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(":")[0]
    .split("/")[0]
    .toLowerCase()
    .trim();
}

/**
 * GET /api/public/business?domain=washngloss.ca
 * Resolves a business by the domain the storefront is currently
 * running on. Returns only public-safe marketing fields.
 */
router.get("/business", async (req, res) => {
  try {
    const domain = normalizeDomain(req.query.domain);
    console.log("Domain from query:", req.query.domain, "Normalized:", domain);
    if (!domain) {
      console.log("No domain provided in query param.");
      return res.status(400).json({ error: "domain query param required" });
    }

    const business = await BusinessProfileModel.findOne({
      $or: [{ domainName: domain }, { "domainDetails.domainName": domain }],

    }).select(
      "businessName businessLogo bannerImage businessPhone businessEmail city businessAddress perDayOpenHours specialDayOpenHours"
    );

    console.log("Business lookup result:", business);

    if (!business) {
      console.log(`No business found for domain "${domain}"`);
      return res.status(404).json({ error: "Site not found for this domain" });
    }

    res.json({
      _id: business._id,
      name: business.businessName,
      logo: business.businessLogo,
      banner: business.bannerImage,
      phone: business.businessPhone,
      email: business.businessEmail,
      city: business.city,
      address: business.businessAddress,
      perDayOpenHours: business.perDayOpenHours || [],
      specialDayOpenHours: business.specialDayOpenHours || [],
    });
  } catch (err) {
    console.error("public/business error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/public/business/:id/deals
 * Active (non-expired) deals for a business, newest first.
 */
router.get("/business/:id/deals", async (req, res) => {
  try {
    const deals = await DealModel.find({
      createdBy: req.params.id,
      offerEndsOnDate: { $gte: new Date() },
    })
      .select(
        "dealType partName subServiceName description discountedPrice originalPrice discountPercentage offerEndsOnDate dealImage selectedVehicle"
      )
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(deals);
  } catch (err) {
    console.error("public/deals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/public/business/:id/services
 * Active services this business offers, with sub-service pricing.
 */
router.get("/business/:id/services", async (req, res) => {
  try {
    const business = await BusinessProfileModel.findById(req.params.id)
      .select("myServices")
      .populate("myServices.service", "name slug description icon");

    if (!business) {
      return res.status(404).json({ error: "Not found" });
    }

    const services = business.myServices
      .filter((s) => s.status === "Active")
      .map((s) => ({
        id: s.service?._id,
        name: s.service?.name,
        slug: s.service?.slug,
        description: s.service?.description,
        icon: s.service?.icon,
        subServices: s.subServices,
      }));

    res.json(services);
  } catch (err) {
    console.error("public/services error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ─── Shop Owner onboarding approval (Admin/Staff "Onboard" flow) ───────────
 *
 * When Admin/Staff onboards a shop owner (autoShopOwnerController.createAutoShopOwner)
 * the owner is created with onboardingStatus="pending" and gets an SMS with a
 * link to this flow. No auth — the token itself is the credential, and it is
 * single-use (cleared once approved/rejected) + time-limited.
 */

function onboardingStatusMessage(status) {
  if (status === "approved") return "You have already approved this onboarding request.";
  if (status === "rejected") return "You have already rejected this onboarding request.";
  return null;
}

/**
 * GET /api/public/onboarding/:token
 * Returns enough info to render the approve/reject page.
 */
router.get("/onboarding/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const owner = await User.findOne({
      onboardingApprovalToken: token,
      role: "autoshopowner",
    })
      .populate({ path: "businessProfile", select: "businessName city businessAddress" })
      .select(
        "name email onboardingStatus onboardingTokenExpiresAt onboardedByStaffName onboardedByStaffRole businessProfile"
      );

    if (!owner) {
      return res.status(404).json({ error: "This onboarding link is invalid or has already been used." });
    }

    if (owner.onboardingTokenExpiresAt && owner.onboardingTokenExpiresAt < new Date()) {
      return res.status(410).json({ error: "This onboarding link has expired. Please ask Auto Daddy to resend it." });
    }

    return res.json({
      status: owner.onboardingStatus,
      alreadyResponded: owner.onboardingStatus !== "pending",
      infoMessage: onboardingStatusMessage(owner.onboardingStatus),
      shopOwnerName: owner.name || null,
      shopName: owner.businessProfile?.businessName || null,
      city: owner.businessProfile?.city || null,
      address: owner.businessProfile?.businessAddress || null,
      onboardedByName: owner.onboardedByStaffName,
      onboardedByRole: owner.onboardedByStaffRole,
    });
  } catch (err) {
    console.error("public/onboarding GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Shared handler for approve/reject so both routes stay in lock-step.
 */
async function respondToOnboarding(req, res, nextStatus) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const owner = await User.findOne({
      onboardingApprovalToken: token,
      role: "autoshopowner",
    });

    if (!owner) {
      return res.status(404).json({ error: "This onboarding link is invalid or has already been used." });
    }

    if (owner.onboardingTokenExpiresAt && owner.onboardingTokenExpiresAt < new Date()) {
      return res.status(410).json({ error: "This onboarding link has expired. Please ask Auto Daddy to resend it." });
    }

    if (owner.onboardingStatus !== "pending") {
      return res.status(409).json({
        error: onboardingStatusMessage(owner.onboardingStatus) || "This request has already been responded to.",
        status: owner.onboardingStatus,
      });
    }

    owner.onboardingStatus = nextStatus;
    owner.onboardingRespondedAt = new Date();
    // Single-use: clear the token so the link can't be replayed.
    owner.onboardingApprovalToken = null;

    // A rejected onboarding shouldn't leave the account active.
    if (nextStatus === "rejected") {
      owner.isDisabled = true;
    }

    await owner.save();

    return res.json({ success: true, status: owner.onboardingStatus });
  } catch (err) {
    console.error(`public/onboarding ${nextStatus} error:`, err);
    res.status(500).json({ error: "Server error" });
  }
}

// POST /api/public/onboarding/:token/approve
router.post("/onboarding/:token/approve", (req, res) => respondToOnboarding(req, res, "approved"));

// POST /api/public/onboarding/:token/reject
router.post("/onboarding/:token/reject", (req, res) => respondToOnboarding(req, res, "rejected"));

// POST /api/public/contact — the autodaddy.ca "Contact Us" form.
router.post("/contact", submitContactMessage);

/**
 * ─── Car Owner onboarding approval (Shop Owner "Onboard Customer" flow) ────
 * Same idea as the Shop Owner flow above, but the pending/approved/rejected
 * state lives on business.myCustomers[] (see customers.controller.js ->
 * onboardCustomer), not on the User doc directly.
 */
router.get("/car-owner-onboarding/:token", getCarOwnerOnboardingByToken);
router.post("/car-owner-onboarding/:token/approve", approveCarOwnerOnboarding);
router.post("/car-owner-onboarding/:token/reject", rejectCarOwnerOnboarding);

export default router;