import BusinessProfileModel from "../../Schema/bussiness-profile.js";

// Get all domain details for a business profile
// Route: GET /api/autoshops/domain-details/get
export const getDomainDetails = async (req, res) => {
  try {
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
 * Requires: req.user.id mapped to business
 */
export const addDomainDetails = async (req, res) => {
  try {
    const businessId = req.user.businessId || req.user.id; // Adjust logic as needed for your auth
    const { domainName, expiryDate, provider, status } = req.body;

    if (!domainName || !expiryDate || !provider) {
      return res.status(400).json({ success: false, message: "domainName, expiryDate, and provider are required." });
    }

    const domainDetailsObj = {
      domainName,
      expiryDate,
      provider,
      status: status || "Active"
    };

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found." });
    }

    business.domainDetails.push(domainDetailsObj);
    await business.save();

    return res.status(200).json({ success: true, data: business.domainDetails, message: "Domain details added." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add domain details.", error: error.message });
  }
};

/**
 * Edit a domain detail entry on a business profile by its index or domain name.
 * Expects: req.body = { index?, domainName?, ...fieldsToUpdate }
 * Requires: req.user.id
 */
export const editDomainDetails = async (req, res) => {
  try {
    const businessId = req.user.businessId || req.user.id; // Adjust logic as needed
    const { index, domainName, ...updates } = req.body;

    if (typeof index === "undefined" && !domainName) {
      return res.status(400).json({ success: false, message: "Provide an index or domainName to identify the domain detail." });
    }

    const business = await BusinessProfileModel.findById(businessId);
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