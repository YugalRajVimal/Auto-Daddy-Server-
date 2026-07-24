import mongoose from "mongoose";
import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import Services from "../../Schema/services.schema.js";
import Dealer from "../../Schema/dealers.schema.js";

/**
 * Create a new deal (Service, Parts, or Salvages) and link it to the creator's business profile.
 * Handles dealImage upload (single image, field "dealImage").
 * Saves dealImage path in db (DealModel.dealImage). Deletes uploaded image if creation fails.
 */
export const createDeal = async (req, res) => {
  let uploadedDealImage;
  try {
    console.log("Starting createDeal (services-rewrite)... Step 1: Fetching user.");
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
    if (!businessProfile) {
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    if (req.file?.path) {
      uploadedDealImage = req.file.path;
    }

    let {
      dealType,
      serviceId,
      productName,
      partName,
      description,
      discountedPrice,
      originalPrice,
      offerEndsOnDate,
      offerEndOn, // for Services, allow both naming variations
      vehicleId,
      vehicleName,
      vehicleModel,
      vehicleYear
    } = req.body;
    console.log("Step 3: Raw body values:", req.body);

    dealType = typeof dealType === "string" ? dealType.trim() : undefined;
    const subServiceName = typeof productName === "string" ? productName.trim() : undefined;
    partName = typeof partName === "string" ? partName.trim() : undefined;
    description = typeof description === "string" ? description.trim() : undefined;
    discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
    originalPrice = typeof originalPrice === "string" ? Number(originalPrice) : originalPrice;
    const discountPercentage = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
    serviceId = typeof serviceId === "string" ? serviceId.trim() : undefined;
    vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : undefined;
    vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : undefined;
    vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : undefined;
    vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : vehicleYear;

    const allowedDealTypes = ["Service", "Parts", "Salvages"];
    if (!dealType || !allowedDealTypes.includes(dealType)) {
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({
        success: false,
        message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'."
      });
    }

    let dealDoc = {
      dealType,
      createdBy: businessProfile._id,
      ...(uploadedDealImage && { dealImage: uploadedDealImage }),
    };

    // Services Deal Logic
    if (dealType === "Service") {
      // Required: serviceId, subServiceName, discountPercentage, offerEndOn (or offerEndsOnDate), and image
      if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "serviceId is required and must be a valid MongoDB ObjectId for 'Service' deals.",
        });
      }

      const serviceExists = await Services.exists({ _id: serviceId });
      if (!serviceExists) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(404).json({
          success: false,
          message: "The specified serviceId does not correspond to a valid service.",
        });
      }

      // Sub-service name must be present and non-empty
      if (!subServiceName || typeof subServiceName !== "string" || !subServiceName.trim()) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: "subServiceName is required for 'Service' deals." });
      }

      // Discount percentage required and must be number between 0 and 100
      if (
        typeof discountPercentage !== "number" ||
        isNaN(discountPercentage) ||
        discountPercentage < 0 ||
        discountPercentage > 100
      ) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "discountPercentage is required for 'Service' deals and must be a number between 0 and 100."
        });
      }

      // Offer end date
      let endsOn = offerEndOn || offerEndsOnDate;
      if (!endsOn || typeof endsOn !== "string") {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "offerEndOn (or offerEndsOnDate) is required for 'Service' deals and must be a string in ISO format."
        });
      }
      let offerEndsDate = new Date(endsOn);
      if (isNaN(offerEndsDate.getTime()) || offerEndsDate <= new Date()) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "offerEndOn/offerEndsOnDate must be a valid ISO date string and must be in the future.",
        });
      }

      // Check for duplicate (same serviceId, subServiceName, business)
      const duplicate = await DealModel.findOne({
        dealType,
        createdBy: businessProfile._id,
        serviceId,
        subServiceName
      }).lean();
      if (duplicate) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "A Service deal with these values already exists for your business profile.",
        });
      }

      dealDoc = {
        ...dealDoc,
        serviceId,
        subServiceName,
        discountPercentage,
        offerEndsOnDate: offerEndsDate,
        // For service deals, include the image under 'dealImage' (already handled), ignore other fields
      };

      // Allow description but not required for service deals, default to subServiceName if present
      if (description && typeof description === "string" && description.trim()) {
        dealDoc.description = description.trim();
      } else {
        dealDoc.description = subServiceName;
      }
    }
    // Parts and Salvages Deal Logic
    else if (dealType === "Parts" || dealType === "Salvages") {
      if (!partName) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
      }
      if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: `vehicleId is required and must be a valid MongoDB ObjectId for '${dealType}' deals.` });
      }
      if (!vehicleName || !vehicleModel || !vehicleYear) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals.",
        });
      }
      if (!description || typeof description !== "string" || !description.trim()) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
      }
      if (
        originalPrice === undefined || originalPrice === null ||
        typeof originalPrice !== "number" || isNaN(originalPrice) || originalPrice < 0
      ) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "originalPrice is required and must be a number greater than or equal to zero.",
        });
      }
      if (
        discountedPrice === undefined || discountedPrice === null ||
        typeof discountedPrice !== "number" || isNaN(discountedPrice) || discountedPrice < 0
      ) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "discountedPrice is required and must be a number greater than or equal to zero.",
        });
      }
      if (discountedPrice > originalPrice) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: "discountedPrice cannot be greater than originalPrice." });
      }

      // Offer end date (required)
      if (!offerEndsOnDate || typeof offerEndsOnDate !== "string") {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: "offerEndsOnDate is required and must be a string in ISO format." });
      }
      const offerEndsDate = new Date(offerEndsOnDate);
      if (isNaN(offerEndsDate.getTime()) || offerEndsDate <= new Date()) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "offerEndsOnDate must be a valid ISO date string and must be in the future.",
        });
      }

      // Check for duplicate (partName + vehicle + business)
      const duplicate = await DealModel.findOne({
        dealType,
        createdBy: businessProfile._id,
        partName,
        vehicle: vehicleId
      }).lean();
      if (duplicate) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "A deal with these values already exists for your business profile.",
        });
      }

      dealDoc = {
        ...dealDoc,
        partName,
        description,
        originalPrice,
        discountedPrice,
        offerEndsOnDate: offerEndsDate,
        vehicle: vehicleId,
        selectedVehicle: {
          id: vehicleId,
          name: vehicleName,
          model: vehicleModel,
          year: vehicleYear
        }
      };
    }

    // Save the document
    const newDeal = await DealModel.create(dealDoc);

    if (!Array.isArray(businessProfile.myDeals)) businessProfile.myDeals = [];
    businessProfile.myDeals.push(newDeal._id);
    await businessProfile.save();

    return res.status(201).json({ success: true, message: "Deal created successfully", data: newDeal });
  } catch (error) {
    if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error?.name === "ValidationError" ? "Validation error creating deal" : "Error creating deal",
      error: error.message,
    });
  }
};

/**
 * Edit an existing deal (only if current business profile created it).
 *
 * For 'Service' dealType: allows updating serviceId, subServiceName, discountPercentage, offerEndOn, and image.
 * For 'Parts' or 'Salvages': like before.
 */
export const editDeal = async (req, res) => {
  let uploadedDealImage, oldDealImage;
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
    if (!businessProfile) {
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }
    const businessProfileId = businessProfile._id;

    const { id } = req.params;

    let deal = await DealModel.findOne({ _id: id, createdBy: businessProfileId });
    if (!deal) {
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
    }
    let updates = {};
    oldDealImage = deal.dealImage;

    if (req.file?.path) {
      uploadedDealImage = req.file.path;
      updates.dealImage = uploadedDealImage;
    }

    let {
      dealType,
      serviceId,
      subServiceName,
      partName,
      description,
      discountedPrice,
      originalPrice,
      discountPercentage,
      offerEndsOnDate,
      offerEndOn,
      vehicleId,
      vehicleName,
      vehicleModel,
      vehicleYear,
    } = req.body;

    const allowedDealTypes = ["Service", "Parts", "Salvages"];
    dealType = typeof dealType === "string" ? dealType.trim() : deal.dealType;
    updates.dealType = dealType;
    if (!allowedDealTypes.includes(dealType)) {
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({ success: false, message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'." });
    }

    if (dealType === "Service") {
      // Validate and update serviceId
      serviceId = typeof serviceId === "undefined" || serviceId === null ? deal.serviceId : (typeof serviceId === "string" ? serviceId.trim() : serviceId);
      if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "serviceId is required and must be a valid ObjectId for 'Service' deals.",
        });
      }
      const serviceExists = await Services.exists({ _id: serviceId });
      if (!serviceExists) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(404).json({
          success: false,
          message: "The specified serviceId does not correspond to a valid service.",
        });
      }
      updates.serviceId = serviceId;

      // subServiceName
      subServiceName = typeof subServiceName === "undefined" || subServiceName === null
        ? deal.subServiceName
        : (typeof subServiceName === "string" ? subServiceName.trim() : subServiceName);
      if (!subServiceName) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: "subServiceName is required for 'Service' deals." });
      }
      updates.subServiceName = subServiceName;

      // discountPercentage
      if (typeof discountPercentage === "undefined" || discountPercentage === null) {
        discountPercentage = deal.discountPercentage;
      } else {
        discountPercentage = typeof discountPercentage === "string" ? Number(discountPercentage) : discountPercentage;
      }
      if (
        typeof discountPercentage !== "number" ||
        isNaN(discountPercentage) ||
        discountPercentage < 0 ||
        discountPercentage > 100
      ) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "discountPercentage is required for 'Service' deals and must be a number between 0 and 100."
        });
      }
      updates.discountPercentage = discountPercentage;

      // offerEndOn (allow "offerEndOn" or "offerEndsOnDate" key)
      let endsOn = offerEndOn || offerEndsOnDate || deal.offerEndOn || deal.offerEndsOnDate;
      if (!endsOn || typeof endsOn !== "string") {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "offerEndOn (or offerEndsOnDate) is required for 'Service' deals and must be in ISO format."
        });
      }
      let offerEndsDate = new Date(endsOn);
      if (isNaN(offerEndsDate.getTime()) || offerEndsDate <= new Date()) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "offerEndOn/offerEndsOnDate must be a valid ISO date string and must be in the future.",
        });
      }
      updates.offerEndOn = offerEndsDate;
      // Remove non-service fields if previously set
      updates.partName = undefined;
      updates.vehicle = undefined;
      updates.selectedVehicle = undefined;

      // Check for duplicate
      const duplicate = await DealModel.findOne({
        dealType,
        createdBy: businessProfileId,
        serviceId: updates.serviceId,
        subServiceName: updates.subServiceName,
        _id: { $ne: id }
      }).lean();
      if (duplicate) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "A Service deal with these values already exists for your business profile.",
        });
      }

      // Allow updating description, otherwise default to subServiceName
      if (typeof description !== "undefined") {
        if (typeof description !== "string" || !description.trim()) {
          if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
          return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
        }
        updates.description = description.trim();
      } else {
        updates.description = updates.subServiceName;
      }
      // Remove fields not relevant for Service deal
      delete updates.originalPrice;
      delete updates.discountedPrice;
      delete updates.offerEndsOnDate;
    }
    else if (dealType === "Parts" || dealType === "Salvages") {
      partName = typeof partName === "string" ? partName.trim() : deal.partName;
      vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : deal.vehicle;
      vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : deal.selectedVehicle?.name;
      vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : deal.selectedVehicle?.model;
      vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : deal.selectedVehicle?.year;

      if (!partName) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
      }
      if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: `vehicleId is required and must be a valid ObjectId for '${dealType}' deals.`,
        });
      }
      if (!vehicleName || !vehicleModel || !vehicleYear) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals.",
        });
      }
      if (typeof description !== "undefined") {
        if (typeof description !== "string" || !description.trim()) {
          if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
          return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
        }
        updates.description = description.trim();
      }

      if (typeof originalPrice !== "undefined") {
        originalPrice = typeof originalPrice === "string" ? Number(originalPrice) : originalPrice;
        if (
          originalPrice === undefined || originalPrice === null ||
          typeof originalPrice !== "number" || isNaN(originalPrice) || originalPrice < 0
        ) {
          if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
          return res.status(400).json({
            success: false,
            message: "originalPrice is required and must be a number greater than or equal to zero.",
          });
        }
        updates.originalPrice = originalPrice;
      } else if (typeof updates.originalPrice === "undefined" && typeof deal.originalPrice !== "undefined") {
        updates.originalPrice = deal.originalPrice;
      }

      if (typeof discountedPrice !== "undefined") {
        discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
        if (
          discountedPrice === undefined || discountedPrice === null ||
          typeof discountedPrice !== "number" || isNaN(discountedPrice) || discountedPrice < 0
        ) {
          if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
          return res.status(400).json({
            success: false,
            message: "discountedPrice is required and must be a number greater than or equal to zero.",
          });
        }
        updates.discountedPrice = discountedPrice;
      } else if (typeof updates.discountedPrice === "undefined" && typeof deal.discountedPrice !== "undefined") {
        updates.discountedPrice = deal.discountedPrice;
      }

      let tempOriginalPrice = typeof updates.originalPrice === "number" ? updates.originalPrice : deal.originalPrice;
      let tempDiscountedPrice = typeof updates.discountedPrice === "number" ? updates.discountedPrice : deal.discountedPrice;
      if (typeof tempOriginalPrice === "number" && typeof tempDiscountedPrice === "number" && tempDiscountedPrice > tempOriginalPrice) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: "discountedPrice cannot be greater than originalPrice." });
      }

      if (typeof offerEndsOnDate !== "undefined") {
        const offerDate = typeof offerEndsOnDate === "string" ? new Date(offerEndsOnDate) : offerEndsOnDate;
        if (!offerDate || isNaN(offerDate.getTime()) || offerDate <= new Date()) {
          if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
          return res.status(400).json({
            success: false,
            message: "offerEndsOnDate must be a valid ISO date string and must be in the future.",
          });
        }
        updates.offerEndsOnDate = offerDate;
      }

      updates.partName = partName;
      updates.vehicle = vehicleId;
      updates.selectedVehicle = { id: vehicleId, name: vehicleName, model: vehicleModel, year: vehicleYear };
      updates.serviceId = undefined;
      updates.subServiceName = undefined;
      updates.discountPercentage = undefined;
      updates.offerEndOn = undefined;

      // Check for duplicate partName+vehicle
      const duplicate = await DealModel.findOne({
        dealType,
        createdBy: businessProfileId,
        partName,
        vehicle: vehicleId,
        _id: { $ne: id }
      }).lean();
      if (duplicate) {
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "A deal with these values already exists for your business profile.",
        });
      }
    }

    // Remove dealType switcher fields
    if (dealType === "Service") {
      delete updates.partName;
      delete updates.vehicle;
      delete updates.selectedVehicle;
    } else if (dealType === "Parts" || dealType === "Salvages") {
      delete updates.serviceId;
      delete updates.subServiceName;
      delete updates.discountPercentage;
      delete updates.offerEndOn;
    }
    delete updates.createdBy;

    const updatedDeal = await DealModel.findOneAndUpdate(
      { _id: id, createdBy: businessProfileId },
      updates,
      { new: true }
    );

    if (!updatedDeal) {
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
    }

    if (uploadedDealImage && oldDealImage && uploadedDealImage !== oldDealImage) {
      await deleteUploadedFile(oldDealImage);
    }

    return res.status(200).json({ success: true, message: "Deal updated", data: updatedDeal });
  } catch (error) {
    if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
    return res.status(500).json({ success: false, message: "Error updating deal", error: error.message });
  }
};

/**
 * Delete a deal by ID (only if created by the current business profile).
 */
export const deleteDeal = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
    if (!businessProfile) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }
    const businessProfileId = businessProfile._id;
    const { id } = req.params;

    const deal = await DealModel.findOneAndDelete({ _id: id, createdBy: businessProfileId });
    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
    }

    // Clean up the deal's image file on disk (new — previously never removed on delete).
    if (deal.dealImage) {
      await deleteUploadedFile(deal.dealImage);
    }

    await BusinessProfileModel.findByIdAndUpdate(businessProfileId, { $pull: { myDeals: deal._id } });
    return res.status(200).json({ success: true, message: "Deal deleted" });
  } catch (error) {
    console.error("[deleteDeal] Error:", error);
    return res.status(500).json({ success: false, message: "Error deleting deal", error: error.message });
  }
};

/**
 * Fetch all deals for the current business profile (BusinessProfile.myDeals).
 */
export const fetchMyDeals = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
    if (!businessProfile) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const dealIds = (businessProfile.myDeals || []).map((id) =>
      typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
    );

    const deals = await DealModel.find({
      _id: { $in: dealIds },
      createdBy: businessProfile._id,
    })
      .populate({ path: "serviceId", select: "name shopType status subServices", strictPopulate: false })
      .populate({ path: "createdBy", select: "name _id", strictPopulate: false })
      .lean();

    let serviceDeals = [];
    let partsDeals = [];

    for (const deal of deals) {
      // Format createdAt as an ISO string, or null if not present
      const createdAt = deal.createdAt ? deal.createdAt : null;

      if (deal.dealType === "Service") {
        let serviceObj = null;
        if (deal.serviceId && deal.serviceId.name) {
          serviceObj = {
            _id: deal.serviceId._id,
            name: deal.serviceId.name,
            shopType: deal.serviceId.shopType,
            status: deal.serviceId.status,
          };
        }
        serviceDeals.push({
          dealType: deal.dealType,
          service: serviceObj,
          serviceId: serviceObj ? serviceObj._id : (deal.serviceId && deal.serviceId._id ? deal.serviceId._id : deal.serviceId),
          description: deal.description,
          originalPrice: deal.originalPrice,
          discountedPrice: deal.discountedPrice,
          discountPercentage: deal.discountPercentage, // <-- Added
          offerEndsOnDate: deal.offerEndsOnDate,
          createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
          dealImage: deal.dealImage ?? null,
          _id: deal._id,
          createdAt: createdAt, // Send createdAt for Service deals
        });
      }

      if (deal.dealType === "Parts" || deal.dealType === "Salvages") {
        let selectedVehicle = null;
        if (
          deal.selectedVehicle &&
          typeof deal.selectedVehicle === "object" &&
          deal.selectedVehicle.id &&
          deal.selectedVehicle.name &&
          deal.selectedVehicle.model &&
          deal.selectedVehicle.year
        ) {
          selectedVehicle = {
            id: deal.selectedVehicle.id,
            name: deal.selectedVehicle.name,
            model: deal.selectedVehicle.model,
            year: deal.selectedVehicle.year,
          };
        }

        partsDeals.push({
          dealType: deal.dealType,
          partName: deal.partName,
          selectedVehicle,
          description: deal.description,
          originalPrice: deal.originalPrice,
          discountedPrice: deal.discountedPrice,
          discountPercentage: deal.discountPercentage, // <-- Added
          offerEndsOnDate: deal.offerEndsOnDate,
          createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
          dealImage: deal.dealImage ?? null,
          _id: deal._id,
          createdAt: createdAt, // Send createdAt for Parts/Salvages deals
        });
      }
    }

    serviceDeals.sort((a, b) => {
      const nameA = a.service && a.service.name ? String(a.service.name) : "";
      const nameB = b.service && b.service.name ? String(b.service.name) : "";
      return nameA.localeCompare(nameB);
    });
    partsDeals.sort((a, b) => {
      if (a.partName && b.partName) return String(a.partName).localeCompare(String(b.partName));
      if (a.partName) return -1;
      if (b.partName) return 1;
      return 0;
    });

    console.log(serviceDeals);
    return res.status(200).json({ success: true, serviceDeals, partsDeals });
  } catch (error) {
    console.error("[fetchMyDeals] Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching deals", error: error.message });
  }
};

/**
 * Fetch all ACTIVE Dealers.
 * Returns a list of dealer records where status is 'Active'.
 */


export const getAllDealers = async (req, res) => {
  try {
    const dealers = await Dealer.find({ status: "Active" }).lean();
    return res.status(200).json({ success: true, data: dealers });
  } catch (error) {
    console.error("[getAllDealers] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dealers",
      error: error.message,
    });
  }
};