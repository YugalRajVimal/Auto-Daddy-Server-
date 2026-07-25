import express from "express";
import BusinessProfileModel from "../Schema/bussiness-profile.js";
import DealModel from "../Schema/deals.schema.js";

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

export default router;
