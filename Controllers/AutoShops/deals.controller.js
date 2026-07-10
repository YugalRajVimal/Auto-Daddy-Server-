// import mongoose, { Types } from "mongoose";
// import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
// import BusinessProfileModel from "../../Schema/bussiness-profile.js";
// import { User } from "../../Schema/user.schema.js";
// import { VehicleModel } from "../../Schema/vehicles.schema.js";
// import servicesSchema from "../../Schema/services.schema.js";
// import DealModel from "../../Schema/deals.schema.js";
// import JobCard from "../../Schema/jobCard.schema.js";
// import Services from "../../Schema/services.schema.js";
// import counterSchema from "../../Schema/counter.schema.js";
// // import CarDetailsModel from "../../Schema/CarDetails.schema.js";
// import WebsiteTemplateSchema from "../../Schema/WebsiteTemplateSchema.js";
// import DashboardDataModel from "../../Schema/dashboardData.schema.js";
// import canadianMunicipalities from "../cityData.js";
// import CarCompany from "../../Schema/car-company-schema.js";
// import axios from "axios";
// import InviteHelpSchema from "../../Schema/InviteHelp.schema.js";
// /**
//  * Create a new deal (Service, Parts, or Salvages) and link it to the creator's business profile.
//  * Handles dealImage upload (single image, field "dealImage").
//  * Saves dealImage path in db (DealModel.dealImage). Deletes uploaded image if creation fails.
//  * Console.log checks at every step for debugging.
//  * 
//  * Now also supports originalPrice (required, like discountedPrice).
//  * Now supports dealType = "Salvages".
//  */
// export const createDeal =async (req, res) => {
//     let uploadedDealImage;
//     try {
//         console.log("Starting createDeal... Step 1: Fetching user.");
//         const userId = req.user.id;
//         const user = await User.findById(userId).lean();
//         if (!user) {
//             console.log("User not found for id:", userId);
//             if (req.file?.path) await deleteUploadedFile(req.file.path);
//             return res.status(404).json({ success: false, message: "User not found" });
//         }
//         console.log("User found:", user._id);

//         console.log("Step 2: Fetching business profile.");
//         const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
//         if (!businessProfile) {
//             console.log("Business profile not found for:", user.businessProfile);
//             if (req.file?.path) await deleteUploadedFile(req.file.path);
//             return res.status(404).json({ success: false, message: "Business profile not found" });
//         }
//         console.log("Business profile found:", businessProfile._id);

//         // Save image path for DB (not URL!), remove on error below if need be
//         if (req.file?.path) {
//             uploadedDealImage = req.file.path;
//             console.log("Deal image uploaded at path:", uploadedDealImage);
//         }

//         let {
//             dealType,
//             serviceId,
//             partName,
//             description,
//             discountedPrice,
//             originalPrice,
//             offerEndsOnDate,
//             vehicleId,
//             vehicleName,
//             vehicleModel,
//             vehicleYear
//         } = req.body;
//         console.log("Step 3: Raw body values:", req.body);

//         dealType = typeof dealType === "string" ? dealType.trim() : undefined;
//         partName = typeof partName === "string" ? partName.trim() : undefined;
//         description = typeof description === "string" ? description.trim() : undefined;
//         discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
//         originalPrice = typeof originalPrice === "string" ? Number(originalPrice) : originalPrice;
//         serviceId = typeof serviceId === "string" ? serviceId.trim() : undefined;
//         vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : undefined;
//         vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : undefined;
//         vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : undefined;
//         vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : vehicleYear;
//         console.log("Step 4: Normalized and prepared fields:",
//             { dealType, serviceId, partName, description, discountedPrice, originalPrice, offerEndsOnDate, vehicleId, vehicleName, vehicleModel, vehicleYear }
//         );

//         // Validate dealType
//         const allowedDealTypes = ["Service", "Parts", "Salvages"];
//         if (!dealType || !allowedDealTypes.includes(dealType)) {
//             console.log("Invalid dealType:", dealType);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({ success: false, message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'." });
//         }
//         console.log("dealType validated:", dealType);

//         // Validate dealType fields
//         if (dealType === "Service") {
//             console.log("Step 5: Validating Service dealType...");
//             if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
//                 console.log("Invalid or missing servicesId:", serviceId);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: "servicesId is required and must be a valid MongoDB ObjectId for 'Service' deals."
//                 });
//             }
//             const serviceExists = await Services.exists({ _id: serviceId });
//             console.log("Service exists check:", serviceExists);
//             if (!serviceExists) {
//                 console.log("servicesId does not correspond to a valid service.", serviceId);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(404).json({
//                     success: false,
//                     message: "The specified servicesId does not correspond to a valid service."
//                 });
//             }
//         } else if (dealType === "Parts" || dealType === "Salvages") {
//             // Salvages and Parts must have partName, vehicleId, vehicleName, vehicleModel, vehicleYear
//             console.log(`Step 5: Validating ${dealType} dealType...`);
//             if (!partName) {
//                 console.log(`Missing partName for ${dealType} deal.`);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
//             }
//             if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
//                 console.log(`Invalid or missing vehicleId:`, vehicleId);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({ success: false, message: `vehicleId is required and must be a valid MongoDB ObjectId for '${dealType}' deals.` });
//             }
//             if (!vehicleName || !vehicleModel || !vehicleYear) {
//                 console.log("One or more required vehicle fields missing.",
//                     { vehicleName, vehicleModel, vehicleYear }
//                 );
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals."
//                 });
//             }
//         }

//         if (!description || typeof description !== "string" || !description.trim()) {
//             console.log("Missing or empty description.");
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
//         }
//         console.log("description validated.");

//         // Validate originalPrice
//         if (
//             originalPrice === undefined ||
//             originalPrice === null ||
//             typeof originalPrice !== "number" ||
//             isNaN(originalPrice) ||
//             originalPrice < 0
//         ) {
//             console.log("Invalid originalPrice:", originalPrice);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({
//                 success: false,
//                 message: "originalPrice is required and must be a number greater than or equal to zero."
//             });
//         }
//         console.log("originalPrice validated:", originalPrice);

//         // Validate discountedPrice
//         if (
//             discountedPrice === undefined ||
//             discountedPrice === null ||
//             typeof discountedPrice !== "number" ||
//             isNaN(discountedPrice) ||
//             discountedPrice < 0
//         ) {
//             console.log("Invalid discountedPrice:", discountedPrice);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({
//                 success: false,
//                 message: "discountedPrice is required and must be a number greater than or equal to zero."
//             });
//         }
//         console.log("discountedPrice validated:", discountedPrice);

//         // discountedPrice should not be more than originalPrice
//         if (discountedPrice > originalPrice) {
//             console.log(`discountedPrice (${discountedPrice}) is greater than originalPrice (${originalPrice})`);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({
//                 success: false,
//                 message: "discountedPrice cannot be greater than originalPrice."
//             });
//         }

//         if (!offerEndsOnDate || typeof offerEndsOnDate !== "string") {
//             console.log("Missing or invalid offerEndsOnDate.");
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({ success: false, message: "offerEndsOnDate is required and must be a string in ISO format." });
//         }
//         const offerEndsDate = new Date(offerEndsOnDate);
//         if (isNaN(offerEndsDate.getTime()) || offerEndsDate <= new Date()) {
//             console.log("offerEndsOnDate is invalid or in the past:", offerEndsOnDate);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({
//                 success: false,
//                 message: "offerEndsOnDate must be a valid ISO date string and must be in the future."
//             });
//         }
//         console.log("offerEndsOnDate validated:", offerEndsDate);

//         // Ensure uniqueness for (dealType, createdBy, deal-differentiator)
//         let uniqueQuery = {
//             dealType,
//             createdBy: businessProfile._id
//         };
//         if (dealType === "Service") {
//             uniqueQuery.serviceId = serviceId;
//         } else {
//             uniqueQuery.partName = partName;
//             uniqueQuery.vehicle = vehicleId;
//         }
//         console.log("Checking for deal uniqueness with:", uniqueQuery);

//         const duplicate = await DealModel.findOne(uniqueQuery).lean();
//         if (duplicate) {
//             console.log("Duplicate deal detected:", duplicate._id);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({
//                 success: false,
//                 message: "A deal with these values already exists for your business profile."
//             });
//         }
//         console.log("No duplicate found. Proceeding...");

//         // Prepare deal doc, always include dealImage path if present
//         let dealDoc = {
//             dealType,
//             description,
//             originalPrice,
//             discountedPrice,
//             offerEndsOnDate: offerEndsDate,
//             createdBy: businessProfile._id,
//             ...(uploadedDealImage && { dealImage: uploadedDealImage })
//         };

//         if (dealType === "Service") {
//             dealDoc.serviceId = serviceId;
//         } else { // Parts or Salvages
//             dealDoc.partName = partName;
//             dealDoc.vehicle = vehicleId;
//             dealDoc.selectedVehicle = {
//                 id: vehicleId,
//                 name: vehicleName,
//                 model: vehicleModel,
//                 year: vehicleYear
//             };
//         }
//         console.log("Deal doc prepared:", dealDoc);

//         const newDeal = await DealModel.create(dealDoc);
//         console.log("Deal created in DB:", newDeal._id);

//         if (!Array.isArray(businessProfile.myDeals)) businessProfile.myDeals = [];
//         businessProfile.myDeals.push(newDeal._id);
//         await businessProfile.save();
//         console.log("Deal ID pushed to businessProfile.myDeals and saved.");

//         return res.status(201).json({
//             success: true,
//             message: "Deal created successfully",
//             data: newDeal
//         });
//     } catch (error) {
//         console.log("Error caught in createDeal:", error);
//         if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//         return res.status(500).json({
//             success: false,
//             message: error?.name === "ValidationError" ? "Validation error creating deal" : "Error creating deal",
//             error: error.message
//         });
//     }
// }

// /**
//  * Edit an existing deal (only if current business profile created it).
//  * Allows changing all fields except createdBy.
//  * Updates or replaces dealImage path in db (DealModel.dealImage).
//  * Deletes the old image file on replacement. On validation/DB error with a new upload, deletes the new image file.
//  * Console.log checks at every step for debugging.
//  *
//  * Now also supports originalPrice and dealType = "Salvages".
//  */
// export const editDeal =async(req, res)=>{
//     let uploadedDealImage, oldDealImage;
//     try {
//         console.log("Starting editDeal... Step 1: Fetching user.");
//         const userId = req.user.id;
//         const user = await User.findById(userId).lean();
//         if (!user) {
//             console.log("User not found for id:", userId);
//             if (req.file?.path) await deleteUploadedFile(req.file.path);
//             return res.status(404).json({ success: false, message: "User not found" });
//         }
//         console.log("User found:", user._id);

//         console.log("Step 2: Fetching business profile.");
//         const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
//         if (!businessProfile) {
//             console.log("Business profile not found for:", user.businessProfile);
//             if (req.file?.path) await deleteUploadedFile(req.file.path);
//             return res.status(404).json({ success: false, message: "Business profile not found" });
//         }
//         const businessProfileId = businessProfile._id;
//         console.log("Business profile found:", businessProfileId);

//         const { id } = req.params;
//         console.log("Editing deal with id:", id);

//         // Get deal (must be owned)
//         let deal = await DealModel.findOne({ _id: id, createdBy: businessProfileId });
//         if (!deal) {
//             console.log("No deal found for this business profile and id:", id);
//             if (req.file?.path) await deleteUploadedFile(req.file.path);
//             return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
//         }
//         let updates = {};
//         oldDealImage = deal.dealImage;
//         console.log("Current deal fetched. Old dealImage:", oldDealImage);

//         // Handle new image: save path in DB and delete old if needed later
//         if (req.file?.path) {
//             uploadedDealImage = req.file.path;
//             updates.dealImage = uploadedDealImage;
//             console.log("New deal image uploaded at path:", uploadedDealImage);
//         }

//         // Parse/validate fields
//         let {
//             dealType,
//             servicesId,
//             partName,
//             description,
//             discountedPrice,
//             originalPrice,
//             offerEndsOnDate,
//             vehicleId,
//             vehicleName,
//             vehicleModel,
//             vehicleYear
//         } = req.body;
//         console.log("Step 3: Raw body values:", req.body);

//         // Only allow dealType update to allowed set
//         const allowedDealTypes = ["Service", "Parts", "Salvages"];
//         dealType = typeof dealType === "string" ? dealType.trim() : deal.dealType;
//         updates.dealType = dealType;
//         if (!allowedDealTypes.includes(dealType)) {
//             console.log("Invalid dealType in edit:", dealType);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({ success: false, message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'." });
//         }
//         console.log("Prepared dealType for update:", dealType);

//         if (dealType === "Service") {
//             console.log("Step 4: Processing Service type update...");
//             if (typeof servicesId === "undefined" || servicesId === null) {
//                 servicesId = deal.servicesId;
//             }
//             if (!servicesId || !mongoose.Types.ObjectId.isValid(servicesId)) {
//                 console.log("Invalid or missing servicesId in edit:", servicesId);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: "servicesId is required and must be a valid ObjectId for 'Service' deals."
//                 });
//             }
//             const serviceExists = await Services.exists({ _id: servicesId });
//             console.log("Service exists check:", serviceExists);
//             if (!serviceExists) {
//                 console.log("servicesId does not correspond to a valid service:", servicesId);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(404).json({
//                     success: false,
//                     message: "The specified servicesId does not correspond to a valid service."
//                 });
//             }
//             updates.servicesId = servicesId;
//             updates.partName = undefined;
//             updates.vehicle = undefined;
//             updates.selectedVehicle = undefined;
//         }

//         if (dealType === "Parts" || dealType === "Salvages") {
//             console.log(`Step 4: Processing ${dealType} type update...`);
//             partName = typeof partName === "string" ? partName.trim() : deal.partName;
//             vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : deal.vehicle;
//             vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : deal.selectedVehicle?.name;
//             vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : deal.selectedVehicle?.model;
//             vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : deal.selectedVehicle?.year;

//             if (!partName) {
//                 console.log(`Missing partName for ${dealType} edit.`);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
//             }
//             if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
//                 console.log(`Invalid or missing vehicleId for ${dealType} edit:`, vehicleId);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: `vehicleId is required and must be a valid ObjectId for '${dealType}' deals.`
//                 });
//             }
//             if (!vehicleName || !vehicleModel || !vehicleYear) {
//                 console.log("Missing vehicular detail(s) in edit:",
//                     { vehicleName, vehicleModel, vehicleYear }
//                 );
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals."
//                 });
//             }
//             updates.partName = partName;
//             updates.vehicle = vehicleId;
//             updates.selectedVehicle = {
//                 id: vehicleId,
//                 name: vehicleName,
//                 model: vehicleModel,
//                 year: vehicleYear
//             };
//             updates.servicesId = undefined;
//         }

//         // Common updates
//         if (typeof description !== "undefined") {
//             if (typeof description !== "string" || !description.trim()) {
//                 console.log("Description missing/invalid in edit.");
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
//             }
//             updates.description = description.trim();
//         }

//         // Handle originalPrice (can be updated only if provided)
//         if (typeof originalPrice !== "undefined") {
//             originalPrice = typeof originalPrice === "string" ? Number(originalPrice) : originalPrice;
//             if (
//                 originalPrice === undefined ||
//                 originalPrice === null ||
//                 typeof originalPrice !== "number" ||
//                 isNaN(originalPrice) ||
//                 originalPrice < 0
//             ) {
//                 console.log("originalPrice is missing or invalid in edit:", originalPrice);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: "originalPrice is required and must be a number greater than or equal to zero."
//                 });
//             }
//             updates.originalPrice = originalPrice;
//             console.log("originalPrice processed for update:", originalPrice);
//         } else if (typeof updates.originalPrice === "undefined" && typeof deal.originalPrice !== "undefined") {
//             updates.originalPrice = deal.originalPrice;
//         }

//         if (typeof discountedPrice !== "undefined") {
//             discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
//             if (
//                 discountedPrice === undefined ||
//                 discountedPrice === null ||
//                 typeof discountedPrice !== "number" ||
//                 isNaN(discountedPrice) ||
//                 discountedPrice < 0
//             ) {
//                 console.log("discountedPrice is missing or invalid in edit:", discountedPrice);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: "discountedPrice is required and must be a number greater than or equal to zero."
//                 });
//             }
//             updates.discountedPrice = discountedPrice;
//             console.log("discountedPrice processed for update:", discountedPrice);
//         } else if (typeof updates.discountedPrice === "undefined" && typeof deal.discountedPrice !== "undefined") {
//             updates.discountedPrice = deal.discountedPrice;
//         }

//         // discountedPrice should not be more than originalPrice
//         let tempOriginalPrice = (typeof updates.originalPrice === "number" ? updates.originalPrice : deal.originalPrice);
//         let tempDiscountedPrice = (typeof updates.discountedPrice === "number" ? updates.discountedPrice : deal.discountedPrice);
//         if (typeof tempOriginalPrice === "number" && typeof tempDiscountedPrice === "number" && tempDiscountedPrice > tempOriginalPrice) {
//             console.log(`discountedPrice (${tempDiscountedPrice}) is greater than originalPrice (${tempOriginalPrice})`);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({
//                 success: false,
//                 message: "discountedPrice cannot be greater than originalPrice."
//             });
//         }

//         if (typeof offerEndsOnDate !== "undefined") {
//             const offerDate = typeof offerEndsOnDate === "string" ? new Date(offerEndsOnDate) : offerEndsOnDate;
//             if (!offerDate || isNaN(offerDate.getTime()) || offerDate <= new Date()) {
//                 console.log("offerEndsOnDate invalid in edit:", offerEndsOnDate);
//                 if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//                 return res.status(400).json({
//                     success: false,
//                     message: "offerEndsOnDate must be a valid ISO date string and must be in the future."
//                 });
//             }
//             updates.offerEndsOnDate = offerDate;
//             console.log("offerEndsOnDate processed for update:", offerDate);
//         }

//         // Check for duplicate except self
//         let duplicateQuery = { dealType, createdBy: businessProfileId, _id: { $ne: id } };
//         if (dealType === "Service") {
//             duplicateQuery.servicesId = updates.servicesId;
//         }
//         if (dealType === "Parts" || dealType === "Salvages") {
//             duplicateQuery.partName = updates.partName;
//             duplicateQuery.vehicle = updates.vehicle;
//         }
//         console.log("Checking for duplicate deal in editDeal. Query:", duplicateQuery);

//         const duplicateDeal = await DealModel.findOne(duplicateQuery).lean();
//         if (duplicateDeal) {
//             console.log("Duplicate deal found in editDeal:", duplicateDeal._id);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(400).json({
//                 success: false,
//                 message: "A deal with these values already exists for your business profile."
//             });
//         }
//         console.log("No duplicate found. Proceeding to update...");

//         // Remove fields not needed in update
//         if (dealType === "Service") {
//             delete updates.partName;
//             delete updates.vehicle;
//             delete updates.selectedVehicle;
//         } else if (dealType === "Parts" || dealType === "Salvages") {
//             delete updates.servicesId;
//         }
//         delete updates.createdBy;
//         console.log("Final update fields:", updates);

//         const updatedDeal = await DealModel.findOneAndUpdate(
//             { _id: id, createdBy: businessProfileId },
//             updates,
//             { new: true }
//         );
//         if (!updatedDeal) {
//             console.log("Failed to update the deal - not found or not permitted:", id);
//             if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//             return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
//         }
//         console.log("Deal updated successfully. ID:", updatedDeal._id);

//         // Remove old deal image if replaced (detect by comparing path)
//         if (uploadedDealImage && oldDealImage && uploadedDealImage !== oldDealImage) {
//             console.log("Deleting old deal image:", oldDealImage);
//             await deleteUploadedFile(oldDealImage);
//         }

//         return res.status(200).json({ success: true, message: "Deal updated", data: updatedDeal });
//     } catch (error) {
//         console.log("Error caught in editDeal:", error);
//         if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
//         return res.status(500).json({ success: false, message: "Error updating deal", error: error.message });
//     }
// }

// /**
//  * Delete a deal by ID (only if created by the current business profile).
//  * Removes the deal's _id from BusinessProfile.myDeals.
//  */
// export const deleteDeal=async(req, res) =>{
//     try {
//         const userId = req.user.id;
//         const user = await User.findById(userId).lean();
//         if (!user) {
//             return res.status(404).json({ success: false, message: "User not found" });
//         }
//         const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
//         if (!businessProfile) {
//             return res.status(404).json({ success: false, message: "Business profile not found" });
//         }
//         const businessProfileId = businessProfile._id;
//         const { id } = req.params;

//         // Delete only if createdBy matches
//         const deal = await DealModel.findOneAndDelete({ _id: id, createdBy: businessProfileId });
//         if (!deal) {
//             return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
//         }

//         await BusinessProfileModel.findByIdAndUpdate(
//             businessProfileId,
//             { $pull: { myDeals: deal._id } }
//         );
//         return res.status(200).json({ success: true, message: "Deal deleted" });
//     } catch (error) {
//         console.error("[deleteDeal] Error:", error);
//         return res.status(500).json({ success: false, message: "Error deleting deal", error: error.message });
//     }
// }

// /**
//  * Fetch all deals for the current business profile (BusinessProfile.myDeals).
//  * Returns full Deal documents as an array, grouped by dealType ("Service" or "Parts").
//  * Service deals include service info (servicesId), parts include partName and selectedVehicle fields.
//  */
// export const fetchMyDeals =async(req, res)=>{
//     try {
//         const userId = req.user.id;
//         const user = await User.findById(userId).lean();
//         if (!user) {
//             return res.status(404).json({ success: false, message: "User not found" });
//         }
//         const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
//         if (!businessProfile) {
//             return res.status(404).json({ success: false, message: "Business profile not found" });
//         }

//         // Prepare deals to fetch
//         const dealIds = (businessProfile.myDeals || []).map(id =>
//             typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
//         );

//         // Fetch all deals for this business
//         const deals = await DealModel.find({
//             _id: { $in: dealIds },
//             createdBy: businessProfile._id
//         })
//             .populate({ path: "serviceId", select: "name desc", strictPopulate: false })
//             .populate({ path: "createdBy", select: "name _id", strictPopulate: false })
//             .lean();

//         let serviceDeals = [];
//         let partsDeals = [];

//         for (const deal of deals) {
//             if (deal.dealType === "Service") {
//                 let serviceObj = null;
//                 if (deal.serviceId && (deal.serviceId.name || deal.serviceId.desc)) {
//                     serviceObj = {
//                         _id: deal.serviceId._id,
//                         name: deal.serviceId.name,
//                         desc: deal.serviceId.desc
//                     };
//                 }
//                 serviceDeals.push({
//                     dealType: deal.dealType,
//                     service: serviceObj,
//                     serviceId: serviceObj ? serviceObj._id : (deal.serviceId && deal.serviceId._id ? deal.serviceId._id : deal.serviceId),
//                     description: deal.description,
//                     discountedPrice: deal.discountedPrice,
//                     offerEndsOnDate: deal.offerEndsOnDate,
//                     createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
//                     dealImage: deal.dealImage ?? null, // pass dealImage
//                     _id: deal._id
//                 });
//             }

//             if (deal.dealType === "Parts") {
//                 // According to deals.schema.js:
//                 // selectedVehicle is an embedded document with id, name, model, year as strings/ids,
//                 // partName is required (string), description, discountedPrice, offerEndsOnDate.
//                 // We do NOT need to fetch and merge vehicle from VehicleModel, just return deal.selectedVehicle as per the schema.

//                 // selectedVehicle may be undefined/null for some entries; only send if valid object.
//                 let selectedVehicle = null;
//                 if (
//                     deal.selectedVehicle &&
//                     typeof deal.selectedVehicle === "object" &&
//                     deal.selectedVehicle.id &&
//                     deal.selectedVehicle.name &&
//                     deal.selectedVehicle.model &&
//                     deal.selectedVehicle.year
//                 ) {
//                     // Build selectedVehicle to match @deals.schema.js (id, name, model, year)
//                     selectedVehicle = {
//                         id: deal.selectedVehicle.id,
//                         name: deal.selectedVehicle.name,
//                         model: deal.selectedVehicle.model,
//                         year: deal.selectedVehicle.year
//                     };
//                 }

//                 partsDeals.push({
//                     dealType: deal.dealType,
//                     partName: deal.partName,
//                     selectedVehicle, // This matches the actual schema, no filtering for enable/disable
//                     description: deal.description,
//                     discountedPrice: deal.discountedPrice,
//                     offerEndsOnDate: deal.offerEndsOnDate,
//                     createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
//                     dealImage: deal.dealImage ?? null, // pass dealImage
//                     _id: deal._id
//                 });
//             }
//         }

//         // Sort services deals by service name, parts by partName
//         serviceDeals.sort((a, b) => {
//             const nameA = a.service && a.service.name ? String(a.service.name) : "";
//             const nameB = b.service && b.service.name ? String(b.service.name) : "";
//             return nameA.localeCompare(nameB);
//         });
//         partsDeals.sort((a, b) => {
//             if (a.partName && b.partName) return String(a.partName).localeCompare(String(b.partName));
//             if (a.partName) return -1;
//             if (b.partName) return 1;
//             return 0;
//         });

//         return res.status(200).json({
//             success: true,
//             serviceDeals,
//             partsDeals
//         });
//     } catch (error) {
//         console.error("[fetchMyDeals] Error:", error);
//         return res.status(500).json({ success: false, message: "Error fetching deals", error: error.message });
//     }
// }

import mongoose from "mongoose";
import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import Services from "../../Schema/services.schema.js";

/**
 * Create a new deal (Service, Parts, or Salvages) and link it to the creator's business profile.
 * Handles dealImage upload (single image, field "dealImage").
 * Saves dealImage path in db (DealModel.dealImage). Deletes uploaded image if creation fails.
 */
export const createDeal = async (req, res) => {
  let uploadedDealImage;
  try {
    console.log("Starting createDeal... Step 1: Fetching user.");
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      console.log("User not found for id:", userId);
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    console.log("User found:", user._id);

    console.log("Step 2: Fetching business profile.");
    const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
    if (!businessProfile) {
      console.log("Business profile not found for:", user.businessProfile);
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }
    console.log("Business profile found:", businessProfile._id);

    if (req.file?.path) {
      uploadedDealImage = req.file.path;
      console.log("Deal image uploaded at path:", uploadedDealImage);
    }

    let {
      dealType,
      serviceId,
      partName,
      description,
      discountedPrice,
      originalPrice,
      offerEndsOnDate,
      vehicleId,
      vehicleName,
      vehicleModel,
      vehicleYear,
    } = req.body;
    console.log("Step 3: Raw body values:", req.body);

    dealType = typeof dealType === "string" ? dealType.trim() : undefined;
    partName = typeof partName === "string" ? partName.trim() : undefined;
    description = typeof description === "string" ? description.trim() : undefined;
    discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
    originalPrice = typeof originalPrice === "string" ? Number(originalPrice) : originalPrice;
    serviceId = typeof serviceId === "string" ? serviceId.trim() : undefined;
    vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : undefined;
    vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : undefined;
    vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : undefined;
    vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : vehicleYear;
    console.log("Step 4: Normalized and prepared fields:", {
      dealType, serviceId, partName, description, discountedPrice, originalPrice,
      offerEndsOnDate, vehicleId, vehicleName, vehicleModel, vehicleYear,
    });

    const allowedDealTypes = ["Service", "Parts", "Salvages"];
    if (!dealType || !allowedDealTypes.includes(dealType)) {
      console.log("Invalid dealType:", dealType);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({ success: false, message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'." });
    }
    console.log("dealType validated:", dealType);

    if (dealType === "Service") {
      console.log("Step 5: Validating Service dealType...");
      if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        console.log("Invalid or missing serviceId:", serviceId);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "serviceId is required and must be a valid MongoDB ObjectId for 'Service' deals.",
        });
      }
      const serviceExists = await Services.exists({ _id: serviceId });
      console.log("Service exists check:", serviceExists);
      if (!serviceExists) {
        console.log("serviceId does not correspond to a valid service.", serviceId);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(404).json({
          success: false,
          message: "The specified serviceId does not correspond to a valid service.",
        });
      }
    } else if (dealType === "Parts" || dealType === "Salvages") {
      console.log(`Step 5: Validating ${dealType} dealType...`);
      if (!partName) {
        console.log(`Missing partName for ${dealType} deal.`);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
      }
      if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
        console.log("Invalid or missing vehicleId:", vehicleId);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: `vehicleId is required and must be a valid MongoDB ObjectId for '${dealType}' deals.` });
      }
      if (!vehicleName || !vehicleModel || !vehicleYear) {
        console.log("One or more required vehicle fields missing.", { vehicleName, vehicleModel, vehicleYear });
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals.",
        });
      }
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      console.log("Missing or empty description.");
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
    }
    console.log("description validated.");

    if (
      originalPrice === undefined || originalPrice === null ||
      typeof originalPrice !== "number" || isNaN(originalPrice) || originalPrice < 0
    ) {
      console.log("Invalid originalPrice:", originalPrice);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({
        success: false,
        message: "originalPrice is required and must be a number greater than or equal to zero.",
      });
    }
    console.log("originalPrice validated:", originalPrice);

    if (
      discountedPrice === undefined || discountedPrice === null ||
      typeof discountedPrice !== "number" || isNaN(discountedPrice) || discountedPrice < 0
    ) {
      console.log("Invalid discountedPrice:", discountedPrice);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({
        success: false,
        message: "discountedPrice is required and must be a number greater than or equal to zero.",
      });
    }
    console.log("discountedPrice validated:", discountedPrice);

    if (discountedPrice > originalPrice) {
      console.log(`discountedPrice (${discountedPrice}) is greater than originalPrice (${originalPrice})`);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({ success: false, message: "discountedPrice cannot be greater than originalPrice." });
    }

    if (!offerEndsOnDate || typeof offerEndsOnDate !== "string") {
      console.log("Missing or invalid offerEndsOnDate.");
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({ success: false, message: "offerEndsOnDate is required and must be a string in ISO format." });
    }
    const offerEndsDate = new Date(offerEndsOnDate);
    if (isNaN(offerEndsDate.getTime()) || offerEndsDate <= new Date()) {
      console.log("offerEndsOnDate is invalid or in the past:", offerEndsOnDate);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({
        success: false,
        message: "offerEndsOnDate must be a valid ISO date string and must be in the future.",
      });
    }
    console.log("offerEndsOnDate validated:", offerEndsDate);

    let uniqueQuery = { dealType, createdBy: businessProfile._id };
    if (dealType === "Service") {
      uniqueQuery.serviceId = serviceId;
    } else {
      uniqueQuery.partName = partName;
      uniqueQuery.vehicle = vehicleId;
    }
    console.log("Checking for deal uniqueness with:", uniqueQuery);

    const duplicate = await DealModel.findOne(uniqueQuery).lean();
    if (duplicate) {
      console.log("Duplicate deal detected:", duplicate._id);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({
        success: false,
        message: "A deal with these values already exists for your business profile.",
      });
    }
    console.log("No duplicate found. Proceeding...");

    let dealDoc = {
      dealType,
      description,
      originalPrice,
      discountedPrice,
      offerEndsOnDate: offerEndsDate,
      createdBy: businessProfile._id,
      ...(uploadedDealImage && { dealImage: uploadedDealImage }),
    };

    if (dealType === "Service") {
      dealDoc.serviceId = serviceId;
    } else {
      dealDoc.partName = partName;
      dealDoc.vehicle = vehicleId;
      dealDoc.selectedVehicle = {
        id: vehicleId,
        name: vehicleName,
        model: vehicleModel,
        year: vehicleYear,
      };
    }
    console.log("Deal doc prepared:", dealDoc);

    const newDeal = await DealModel.create(dealDoc);
    console.log("Deal created in DB:", newDeal._id);

    if (!Array.isArray(businessProfile.myDeals)) businessProfile.myDeals = [];
    businessProfile.myDeals.push(newDeal._id);
    await businessProfile.save();
    console.log("Deal ID pushed to businessProfile.myDeals and saved.");

    return res.status(201).json({ success: true, message: "Deal created successfully", data: newDeal });
  } catch (error) {
    console.log("Error caught in createDeal:", error);
    if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
    return res.status(500).json({
      success: false,
      message: error?.name === "ValidationError" ? "Validation error creating deal" : "Error creating deal",
      error: error.message,
    });
  }
};

/**
 * Edit an existing deal (only if current business profile created it).
 */
export const editDeal = async (req, res) => {
  let uploadedDealImage, oldDealImage;
  try {
    console.log("Starting editDeal... Step 1: Fetching user.");
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      console.log("User not found for id:", userId);
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    console.log("User found:", user._id);

    console.log("Step 2: Fetching business profile.");
    const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
    if (!businessProfile) {
      console.log("Business profile not found for:", user.businessProfile);
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }
    const businessProfileId = businessProfile._id;
    console.log("Business profile found:", businessProfileId);

    const { id } = req.params;
    console.log("Editing deal with id:", id);

    let deal = await DealModel.findOne({ _id: id, createdBy: businessProfileId });
    if (!deal) {
      console.log("No deal found for this business profile and id:", id);
      if (req.file?.path) await deleteUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
    }
    let updates = {};
    oldDealImage = deal.dealImage;
    console.log("Current deal fetched. Old dealImage:", oldDealImage);

    if (req.file?.path) {
      uploadedDealImage = req.file.path;
      updates.dealImage = uploadedDealImage;
      console.log("New deal image uploaded at path:", uploadedDealImage);
    }

    // FIX: was destructured as `servicesId` — schema field is `serviceId`.
    let {
      dealType,
      serviceId,
      partName,
      description,
      discountedPrice,
      originalPrice,
      offerEndsOnDate,
      vehicleId,
      vehicleName,
      vehicleModel,
      vehicleYear,
    } = req.body;
    console.log("Step 3: Raw body values:", req.body);

    const allowedDealTypes = ["Service", "Parts", "Salvages"];
    dealType = typeof dealType === "string" ? dealType.trim() : deal.dealType;
    updates.dealType = dealType;
    if (!allowedDealTypes.includes(dealType)) {
      console.log("Invalid dealType in edit:", dealType);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({ success: false, message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'." });
    }
    console.log("Prepared dealType for update:", dealType);

    if (dealType === "Service") {
      console.log("Step 4: Processing Service type update...");
      if (typeof serviceId === "undefined" || serviceId === null) {
        serviceId = deal.serviceId;
      }
      if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        console.log("Invalid or missing serviceId in edit:", serviceId);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "serviceId is required and must be a valid ObjectId for 'Service' deals.",
        });
      }
      const serviceExists = await Services.exists({ _id: serviceId });
      console.log("Service exists check:", serviceExists);
      if (!serviceExists) {
        console.log("serviceId does not correspond to a valid service:", serviceId);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(404).json({
          success: false,
          message: "The specified serviceId does not correspond to a valid service.",
        });
      }
      updates.serviceId = serviceId;
      updates.partName = undefined;
      updates.vehicle = undefined;
      updates.selectedVehicle = undefined;
    }

    if (dealType === "Parts" || dealType === "Salvages") {
      console.log(`Step 4: Processing ${dealType} type update...`);
      partName = typeof partName === "string" ? partName.trim() : deal.partName;
      vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : deal.vehicle;
      vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : deal.selectedVehicle?.name;
      vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : deal.selectedVehicle?.model;
      vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : deal.selectedVehicle?.year;

      if (!partName) {
        console.log(`Missing partName for ${dealType} edit.`);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
      }
      if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
        console.log(`Invalid or missing vehicleId for ${dealType} edit:`, vehicleId);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: `vehicleId is required and must be a valid ObjectId for '${dealType}' deals.`,
        });
      }
      if (!vehicleName || !vehicleModel || !vehicleYear) {
        console.log("Missing vehicular detail(s) in edit:", { vehicleName, vehicleModel, vehicleYear });
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals.",
        });
      }
      updates.partName = partName;
      updates.vehicle = vehicleId;
      updates.selectedVehicle = { id: vehicleId, name: vehicleName, model: vehicleModel, year: vehicleYear };
      updates.serviceId = undefined;
    }

    if (typeof description !== "undefined") {
      if (typeof description !== "string" || !description.trim()) {
        console.log("Description missing/invalid in edit.");
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
        console.log("originalPrice is missing or invalid in edit:", originalPrice);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "originalPrice is required and must be a number greater than or equal to zero.",
        });
      }
      updates.originalPrice = originalPrice;
      console.log("originalPrice processed for update:", originalPrice);
    } else if (typeof updates.originalPrice === "undefined" && typeof deal.originalPrice !== "undefined") {
      updates.originalPrice = deal.originalPrice;
    }

    if (typeof discountedPrice !== "undefined") {
      discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
      if (
        discountedPrice === undefined || discountedPrice === null ||
        typeof discountedPrice !== "number" || isNaN(discountedPrice) || discountedPrice < 0
      ) {
        console.log("discountedPrice is missing or invalid in edit:", discountedPrice);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "discountedPrice is required and must be a number greater than or equal to zero.",
        });
      }
      updates.discountedPrice = discountedPrice;
      console.log("discountedPrice processed for update:", discountedPrice);
    } else if (typeof updates.discountedPrice === "undefined" && typeof deal.discountedPrice !== "undefined") {
      updates.discountedPrice = deal.discountedPrice;
    }

    let tempOriginalPrice = typeof updates.originalPrice === "number" ? updates.originalPrice : deal.originalPrice;
    let tempDiscountedPrice = typeof updates.discountedPrice === "number" ? updates.discountedPrice : deal.discountedPrice;
    if (typeof tempOriginalPrice === "number" && typeof tempDiscountedPrice === "number" && tempDiscountedPrice > tempOriginalPrice) {
      console.log(`discountedPrice (${tempDiscountedPrice}) is greater than originalPrice (${tempOriginalPrice})`);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({ success: false, message: "discountedPrice cannot be greater than originalPrice." });
    }

    if (typeof offerEndsOnDate !== "undefined") {
      const offerDate = typeof offerEndsOnDate === "string" ? new Date(offerEndsOnDate) : offerEndsOnDate;
      if (!offerDate || isNaN(offerDate.getTime()) || offerDate <= new Date()) {
        console.log("offerEndsOnDate invalid in edit:", offerEndsOnDate);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(400).json({
          success: false,
          message: "offerEndsOnDate must be a valid ISO date string and must be in the future.",
        });
      }
      updates.offerEndsOnDate = offerDate;
      console.log("offerEndsOnDate processed for update:", offerDate);
    }

    let duplicateQuery = { dealType, createdBy: businessProfileId, _id: { $ne: id } };
    if (dealType === "Service") {
      duplicateQuery.serviceId = updates.serviceId;
    }
    if (dealType === "Parts" || dealType === "Salvages") {
      duplicateQuery.partName = updates.partName;
      duplicateQuery.vehicle = updates.vehicle;
    }
    console.log("Checking for duplicate deal in editDeal. Query:", duplicateQuery);

    const duplicateDeal = await DealModel.findOne(duplicateQuery).lean();
    if (duplicateDeal) {
      console.log("Duplicate deal found in editDeal:", duplicateDeal._id);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(400).json({
        success: false,
        message: "A deal with these values already exists for your business profile.",
      });
    }
    console.log("No duplicate found. Proceeding to update...");

    if (dealType === "Service") {
      delete updates.partName;
      delete updates.vehicle;
      delete updates.selectedVehicle;
    } else if (dealType === "Parts" || dealType === "Salvages") {
      delete updates.serviceId;
    }
    delete updates.createdBy;
    console.log("Final update fields:", updates);

    const updatedDeal = await DealModel.findOneAndUpdate(
      { _id: id, createdBy: businessProfileId },
      updates,
      { new: true }
    );
    if (!updatedDeal) {
      console.log("Failed to update the deal - not found or not permitted:", id);
      if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
      return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
    }
    console.log("Deal updated successfully. ID:", updatedDeal._id);

    if (uploadedDealImage && oldDealImage && uploadedDealImage !== oldDealImage) {
      console.log("Deleting old deal image:", oldDealImage);
      await deleteUploadedFile(oldDealImage);
    }

    return res.status(200).json({ success: true, message: "Deal updated", data: updatedDeal });
  } catch (error) {
    console.log("Error caught in editDeal:", error);
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
      // FIX: "desc" isn't a field on Services — select the fields that actually exist.
      .populate({ path: "serviceId", select: "name shopType status subServices", strictPopulate: false })
      .populate({ path: "createdBy", select: "name _id", strictPopulate: false })
      .lean();

    let serviceDeals = [];
    let partsDeals = [];

    for (const deal of deals) {
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
          offerEndsOnDate: deal.offerEndsOnDate,
          createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
          dealImage: deal.dealImage ?? null,
          _id: deal._id,
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
          offerEndsOnDate: deal.offerEndsOnDate,
          createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
          dealImage: deal.dealImage ?? null,
          _id: deal._id,
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

    return res.status(200).json({ success: true, serviceDeals, partsDeals });
  } catch (error) {
    console.error("[fetchMyDeals] Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching deals", error: error.message });
  }
};