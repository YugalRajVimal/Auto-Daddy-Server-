


import mongoose from "mongoose";


import { User } from "../../Schema/user.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import servicesSchema from "../../Schema/services.schema.js";
import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

/* =========================================================
   PERSONAL PROFILE
   GET  -> name, phone, email, city, profilePhoto
   PUT  -> name, city, profilePhoto (phone & email locked)
   ========================================================= */

export const getPersonalProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "name phone email city profilePhoto"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        name: user.name,
        phone: user.phone,
        email: user.email,
        city: user.city,
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch personal profile",
      error: error.message,
    });
  }
};

export const updatePersonalProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, city } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const oldPhoto = user.profilePhoto;

    if (name !== undefined) user.name = name;
    if (city !== undefined) user.city = city;
    if (req.file) user.profilePhoto = req.file.path;

    await user.save();

    // Only delete the old file once the new state is safely persisted
    if (req.file && oldPhoto) deleteUploadedFile(oldPhoto);

    return res.status(200).json({
      success: true,
      message: "Personal profile updated successfully",
      data: {
        name: user.name,
        phone: user.phone,
        email: user.email,
        city: user.city,
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (error) {
    if (req.file) deleteUploadedFile(req.file);
    return res.status(500).json({
      success: false,
      message: "Failed to update personal profile",
      error: error.message,
    });
  }
};

/* =========================================================
   BUSINESS PROFILE
   GET  -> businessName, businessPhone, city, businessAddress,
           pincode, businessHSTNumber, gst, businessEmail,
           businessLogo, shopTypes
   PUT  -> same fields (no duplicate phone/email vs OTHER
           business profiles)

   NOTE: `shopTypes` lives on the User document (autoshopowner),
   NOT on BusinessProfile. Update UserSchema's `shopType` field
   from a single enum string to an array:

     shopType: {
       type: [String],
       enum: ["autoShop", "tyreShop", "carWash", "towTruck"],
       default: []
     }

   (rename other usages of the old singular field in your
   codebase accordingly)
   ========================================================= */

export const getBusinessProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("businessProfile shopType");
    if (!user || !user.businessProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(
      user.businessProfile
    ).select(
      "businessName businessPhone city businessAddress pincode businessHSTNumber gst businessEmail businessLogo"
    );

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        businessName: business.businessName,
        businessPhone: business.businessPhone,
        city: business.city,
        businessAddress: business.businessAddress,
        pincode: business.pincode,
        businessHSTNumber: business.businessHSTNumber,
        gst: business.gst,
        businessEmail: business.businessEmail,
        businessLogo: business.businessLogo,
        shopTypes: user.shopType || [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch business profile",
      error: error.message,
    });
  }
};

// export const updateBusinessProfile = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const {
//       businessName,
//       businessPhone,
//       city,
//       businessAddress,
//       pincode,
//       businessHSTNumber,
//       gst,
//       businessEmail,
//       shopTypes, // array, JSON string, or comma-separated string
//     } = req.body;

//     const user = await User.findById(userId).select("businessProfile shopType");
//     if (!user || !user.businessProfile) {
//       if (req.file) deleteUploadedFile(req.file);
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const businessId = user.businessProfile;

//     // Duplicate check on phone / email against OTHER business profiles only
//     if (businessPhone || businessEmail) {
//       const dupQuery = { _id: { $ne: businessId }, $or: [] };
//       if (businessPhone) dupQuery.$or.push({ businessPhone });
//       if (businessEmail) dupQuery.$or.push({ businessEmail });

//       const duplicate = await BusinessProfileModel.findOne(dupQuery);
//       if (duplicate) {
//         if (req.file) deleteUploadedFile(req.file);
//         const field =
//           businessPhone && duplicate.businessPhone === businessPhone
//             ? "Phone number"
//             : "Email";
//         return res.status(409).json({
//           success: false,
//           message: `${field} is already in use by another business profile`,
//         });
//       }
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       if (req.file) deleteUploadedFile(req.file);
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const oldLogo = business.businessLogo;

//     if (businessName !== undefined) business.businessName = businessName;
//     if (businessPhone !== undefined) business.businessPhone = businessPhone;
//     if (city !== undefined) business.city = city;
//     if (businessAddress !== undefined) business.businessAddress = businessAddress;
//     if (pincode !== undefined) business.pincode = pincode;
//     if (businessHSTNumber !== undefined) business.businessHSTNumber = businessHSTNumber;
//     if (gst !== undefined) business.gst = gst;
//     if (businessEmail !== undefined) business.businessEmail = businessEmail;

//     let parsedShopTypes;
//     if (shopTypes !== undefined) {
//       parsedShopTypes = shopTypes;
//       if (typeof shopTypes === "string") {
//         try {
//           parsedShopTypes = JSON.parse(shopTypes);
//         } catch {
//           parsedShopTypes = shopTypes.split(",").map((s) => s.trim()).filter(Boolean);
//         }
//       }
//       user.shopType = parsedShopTypes;
//     }

//     if (req.file) business.businessLogo = req.file.path;

//     await business.save();
//     if (shopTypes !== undefined) await user.save();

//     if (req.file && oldLogo) deleteUploadedFile(oldLogo);

//     return res.status(200).json({
//       success: true,
//       message: "Business profile updated successfully",
//       data: {
//         businessName: business.businessName,
//         businessPhone: business.businessPhone,
//         city: business.city,
//         businessAddress: business.businessAddress,
//         pincode: business.pincode,
//         businessHSTNumber: business.businessHSTNumber,
//         gst: business.gst,
//         businessEmail: business.businessEmail,
//         businessLogo: business.businessLogo,
//         shopTypes: user.shopType || [],
//       },
//     });
//   } catch (error) {
//     if (req.file) deleteUploadedFile(req.file);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update business profile",
//       error: error.message,
//     });
//   }
// };


export const updateBusinessProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      businessName,
      businessPhone,
      city,
      businessAddress,
      pincode,
      businessHSTNumber,
      gst,
      businessEmail,
      shopTypes, // array, JSON string, or comma-separated string
    } = req.body;

    const user = await User.findById(userId).select("businessProfile shopType");
    if (!user || !user.businessProfile) {
      if (req.file) deleteUploadedFile(req.file);
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const businessId = user.businessProfile;

    // Duplicate check on phone / email against OTHER business profiles only
    if (businessPhone || businessEmail) {
      const dupQuery = { _id: { $ne: businessId }, $or: [] };
      if (businessPhone) dupQuery.$or.push({ businessPhone });
      if (businessEmail) dupQuery.$or.push({ businessEmail });

      const duplicate = await BusinessProfileModel.findOne(dupQuery);
      if (duplicate) {
        if (req.file) deleteUploadedFile(req.file);
        const field =
          businessPhone && duplicate.businessPhone === businessPhone
            ? "Phone number"
            : "Email";
        return res.status(409).json({
          success: false,
          message: `${field} is already in use by another business profile`,
        });
      }
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      if (req.file) deleteUploadedFile(req.file);
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const oldLogo = business.businessLogo;

    if (businessName !== undefined) business.businessName = businessName;
    if (businessPhone !== undefined) business.businessPhone = businessPhone;
    if (city !== undefined) business.city = city;
    if (businessAddress !== undefined) business.businessAddress = businessAddress;
    if (pincode !== undefined) business.pincode = pincode;
    if (businessHSTNumber !== undefined) business.businessHSTNumber = businessHSTNumber;
    if (gst !== undefined) business.gst = gst;
    if (businessEmail !== undefined) business.businessEmail = businessEmail;

    let parsedShopTypes;
    let removedServicesCount = 0;
    let removedServiceNames = [];

    if (shopTypes !== undefined) {
      parsedShopTypes = shopTypes;
      if (typeof shopTypes === "string") {
        try {
          parsedShopTypes = JSON.parse(shopTypes);
        } catch {
          parsedShopTypes = shopTypes.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }

      if (!Array.isArray(parsedShopTypes)) {
        if (req.file) deleteUploadedFile(req.file);
        return res.status(400).json({
          success: false,
          message: "shopTypes must be an array (or JSON/comma-separated string of shopTypes)",
        });
      }

      const validShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
      const invalid = parsedShopTypes.filter((st) => !validShopTypes.includes(st));
      if (invalid.length > 0) {
        if (req.file) deleteUploadedFile(req.file);
        return res.status(400).json({
          success: false,
          message: `Invalid shopType(s): ${invalid.join(", ")}. Valid values are: ${validShopTypes.join(", ")}`,
        });
      }

      // ---- NEW: prune myServices whose service.shopType is no longer offered ----
      if (business.myServices && business.myServices.length > 0) {
        const serviceIds = business.myServices.map((ms) => ms.service);
        const servicesDocs = await servicesSchema
          .find({ _id: { $in: serviceIds } })
          .select("name shopType");

        const shopTypeByServiceId = new Map(
          servicesDocs.map((s) => [s._id.toString(), s.shopType])
        );

        const keptServices = [];
        const removedServices = [];

        for (const ms of business.myServices) {
          const svcShopType = shopTypeByServiceId.get(ms.service.toString());
          // Keep only if the service's shopType is still in the new shopTypes list.
          // If the service doc itself is missing/deleted, drop it too (defensive).
          if (svcShopType && parsedShopTypes.includes(svcShopType)) {
            keptServices.push(ms);
          } else {
            removedServices.push(ms);
          }
        }

        if (removedServices.length > 0) {
          business.myServices = keptServices;
          removedServicesCount = removedServices.length;
          removedServiceNames = removedServices.map((ms) => {
            const doc = servicesDocs.find(
              (s) => s._id.toString() === ms.service.toString()
            );
            return doc ? doc.name : ms.service.toString();
          });
        }
      }
      // -----------------------------------------------------------------------

      user.shopType = parsedShopTypes;
    }

    if (req.file) business.businessLogo = req.file.path;

    await business.save();
    if (shopTypes !== undefined) await user.save();

    if (req.file && oldLogo) deleteUploadedFile(oldLogo);

    return res.status(200).json({
      success: true,
      message:
        removedServicesCount > 0
          ? `Business profile updated successfully. ${removedServicesCount} service(s) removed as their shopType is no longer offered: ${removedServiceNames.join(", ")}`
          : "Business profile updated successfully",
      data: {
        businessName: business.businessName,
        businessPhone: business.businessPhone,
        city: business.city,
        businessAddress: business.businessAddress,
        pincode: business.pincode,
        businessHSTNumber: business.businessHSTNumber,
        gst: business.gst,
        businessEmail: business.businessEmail,
        businessLogo: business.businessLogo,
        shopTypes: user.shopType || [],
        removedServices: removedServiceNames,
      },
    });
  } catch (error) {
    if (req.file) deleteUploadedFile(req.file);
    return res.status(500).json({
      success: false,
      message: "Failed to update business profile",
      error: error.message,
    });
  }
};

/**
 * Update the invoiceTemplateSlug and jobCardTemplateSlug for the current user's business profile.
 * Expects { invoiceTemplateSlug, jobCardTemplateSlug } in req.body.
 * Only allowed for an authenticated user with a business profile.
 */
export const updateBusinessTemplateSlugs = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID missing from auth context."
      });
    }

    // Find user and get associated businessProfile
    const user = await User.findById(userId).select("businessProfile role");
    if (!user || !user.businessProfile) {
      return res.status(404).json({
        success: false,
        message: "User or associated business profile not found"
      });
    }

    // Find the business profile document by ID
    const business = await BusinessProfileModel.findById(user.businessProfile);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business profile not found"
      });
    }

    const { invoiceTemplateSlug, jobCardTemplateSlug } = req.body;

    if (invoiceTemplateSlug !== undefined) business.invoiceTemplateSlug = invoiceTemplateSlug;
    if (jobCardTemplateSlug !== undefined) business.jobCardTemplateSlug = jobCardTemplateSlug;

    // At least one field should be present to update
    if (invoiceTemplateSlug === undefined && jobCardTemplateSlug === undefined) {
      return res.status(400).json({
        success: false,
        message: "No template slug fields provided to update"
      });
    }

    await business.save();

    return res.status(200).json({
      success: true,
      message: "Template slugs updated successfully",
      data: {
        invoiceTemplateSlug: business.invoiceTemplateSlug,
        jobCardTemplateSlug: business.jobCardTemplateSlug
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update template slugs",
      error: error?.message || error
    });
  }
};



