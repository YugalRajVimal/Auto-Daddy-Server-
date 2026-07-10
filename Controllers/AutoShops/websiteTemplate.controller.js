/**
 * Fetch website templates for auto shops.
 * GET /api/website-templates
 * Returns either the business's selected template (if chosen/purchased) or all templates.
 */


import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import WebsiteTemplateSchema from "../../Schema/WebsiteTemplateSchema.js";


/**
 * Fetch all website templates, but if the business has already selected one, only return that template.
 * Now correctly gets businessProfileId by looking up the user by their id
 */
async function fetchWebsiteTemplates(req, res) {
  try {
    // req.user only contains id and role, so fetch the full User and populate businessProfile
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User id missing in request" });
    }

    // Fetch and populate the businessProfile
    const user = await User.findById(userId).populate("businessProfile").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const business = user.businessProfile || null;
    const selectedTemplateId = business?.websiteTemplateId || null;

    if (selectedTemplateId) {
      // If a template is already selected, return only that template
      const selectedTemplate = await WebsiteTemplateSchema.findById(selectedTemplateId).lean();
      return res.status(200).json({
        success: true,
        hasPurchasedTemplate: true,
        selectedTemplate
      });
    } else {
      // Otherwise, return all templates for selection
      const templates = await WebsiteTemplateSchema.find({}).lean();
      return res.status(200).json({
        success: true,
        hasPurchasedTemplate: false,
        data: templates
      });
    }
  } catch (err) {
    console.error("[fetchWebsiteTemplates] Error:", err);
    return res.status(500).json({ message: "Failed to fetch website templates", error: err.message });
  }
}

/**
 * Select a website template for the business profile and save it.
 * POST /api/website-templates/select
 * Payload: { templateId }
 * Now correctly gets businessProfileId by looking up the user by their id
 */
async function selectWebsiteTemplate(req, res) {
  try {
    const { templateId } = req.body;
    // Validate templateId
    if (!templateId) {
      return res.status(400).json({ message: "templateId is required" });
    }

    // Make sure the template exists
    const template = await WebsiteTemplateSchema.findById(templateId);
    if (!template) {
      return res.status(404).json({ message: "Website template not found" });
    }

    // Get business profile by populating from User
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User id missing in request" });
    }
    const user = await User.findById(userId).populate("businessProfile").lean();
    if (!user || !user.businessProfile) {
      return res.status(403).json({ message: "No business profile associated with user" });
    }
    const businessProfileId = user.businessProfile._id;

    // Update chosen template in business profile
    const updatedBusiness = await BusinessProfileModel.findByIdAndUpdate(
      businessProfileId,
      { websiteTemplateId: templateId },
      { new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Website template selected successfully",
      websiteTemplateId: templateId,
      updatedBusiness
    });
  } catch (err) {
    console.error("[selectWebsiteTemplate] Error:", err);
    return res.status(500).json({ message: "Failed to select website template", error: err.message });
  }
}

export { fetchWebsiteTemplates, selectWebsiteTemplate };