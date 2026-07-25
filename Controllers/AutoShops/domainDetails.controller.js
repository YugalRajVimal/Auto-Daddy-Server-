import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";


// Get all domain details for a business profile
// Route: GET /api/autoshops/domain-details/get
export const getDomainDetails = async (req, res) => {
  try {
    // req.user.id holds the User _id
    const user = await User.findById(req.user.id).select("businessProfile");
    if (!user || !user.businessProfile) {
      return res.status(404).json({ success: false, message: "Business profile not found." });
    }

    const business = await BusinessProfileModel.findById(user.businessProfile).select("domainDetails");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found." });
    }

    return res.status(200).json({ success: true, data: business.domainDetails });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch domain details.", error: error.message });
  }
};

/**
 * Add new domain details to a business profile
 * Expects: req.body = { domainName, expiryDate, provider, status? }
 * Requires: req.user.id store id for User schema, then fetch business profile
 */
export const addDomainDetails = async (req, res) => {
  try {
    // Get the user's businessProfile via User schema
    const user = await User.findById(req.user.id).select("businessProfile");
    console.log("[addDomainDetails] User fetched:", user);
    if (!user || !user.businessProfile) {
      console.log("[addDomainDetails] Business profile not found for user:", req.user.id);
      return res.status(404).json({ success: false, message: "Business profile not found." });
    }

    const { domainName, expiryDate, provider, status } = req.body;
    console.log("[addDomainDetails] Request body:", req.body);

    if (!domainName || !expiryDate || !provider) {
      console.log("[addDomainDetails] Missing fields - domainName:", domainName, "expiryDate:", expiryDate, "provider:", provider);
      return res.status(400).json({ success: false, message: "domainName, expiryDate, and provider are required." });
    }

    const domainDetailsObj = {
      domainName,
      expiryDate,
      provider,
      status: status || "Active"
    };
    console.log("[addDomainDetails] Domain details object to add:", domainDetailsObj);

    const business = await BusinessProfileModel.findById(user.businessProfile);
    console.log("[addDomainDetails] Business fetched:", business);
    if (!business) {
      console.log("[addDomainDetails] Business not found for profile id:", user.businessProfile);
      return res.status(404).json({ success: false, message: "Business not found." });
    }

    business.domainDetails.push(domainDetailsObj);
    await business.save();

    console.log("[addDomainDetails] Domain details added successfully.");
    return res.status(200).json({ success: true, data: business.domainDetails, message: "Domain details added." });
  } catch (error) {
    console.log("[addDomainDetails] Error occurred:", error);
    return res.status(500).json({ success: false, message: "Failed to add domain details.", error: error.message });
  }
};

/**
 * Edit a domain detail entry on a business profile by its index or domain name.
 * Expects: req.body = { index?, domainName?, ...fieldsToUpdate }
 * Requires: req.user.id -> User -> businessProfile
 */
export const editDomainDetails = async (req, res) => {
  try {
    // Get user's business profile from User
    const user = await User.findById(req.user.id).select("businessProfile");
    if (!user || !user.businessProfile) {
      return res.status(404).json({ success: false, message: "Business profile not found." });
    }

    const { index, domainName, ...updates } = req.body;

    if (typeof index === "undefined" && !domainName) {
      return res.status(400).json({ success: false, message: "Provide an index or domainName to identify the domain detail." });
    }

    const business = await BusinessProfileModel.findById(user.businessProfile);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found." });
    }

    let domainDetails = business.domainDetails;
    let entryIndex = typeof index !== "undefined"
      ? index
      : domainDetails.findIndex(d => d.domainName === domainName);

    if (entryIndex === -1 || !domainDetails[entryIndex]) {
      return res.status(404).json({ success: false, message: "Domain detail not found." });
    }

    // Apply updates only to allowed fields
    const allowedFields = ["domainName", "expiryDate", "provider", "status"];
    for (let key of allowedFields) {
      if (key in updates) {
        domainDetails[entryIndex][key] = updates[key];
      }
    }

    await business.save();
    return res.status(200).json({ success: true, data: business.domainDetails[entryIndex], message: "Domain details updated." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update domain details.", error: error.message });
  }
};