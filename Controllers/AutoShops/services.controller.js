// getMyServicesAndSubSubservices
// getSubServicesSuggestionsUsingServiceId 
// Add to my subServices ( subService will be a string ) with ( Name Category *, Description, Unit Cost *, Qty, Tax)

import mongoose from "mongoose";


import { User } from "../../Schema/user.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import servicesSchema from "../../Schema/services.schema.js";
import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

/* =========================================================
   ADMIN SERVICES (by shopType, optional name search)
   GET  -> list of active Services matching shopType/search
   PUT  -> add a service (with chosen subServices) to
           business.myServices if not already present
   ========================================================= */

   export const getAdminServicesWithShopType = async (req, res) => {
    try {
      const { shopType, services } = req.query;
  
      let filter = { status: "Active" };
  
      // If at least one filter is provided, apply filters
      if (shopType || services) {
        if (shopType) filter.shopType = shopType;
        if (services) filter.name = { $regex: services, $options: "i" };
      } else {
        // If no filters, remove all except 'status'
        filter = { status: "Active" };
      }
  
      const results = await servicesSchema.find(filter)
        .select("name shopType status odoOutRequired")
        .sort({ name: 1 });
  
      return res.status(200).json({ success: true, data: results });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch services",
        error: error.message,
      });
    }
  };
  
  export const getMyServices = async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select("businessProfile");
      if (!user || !user.businessProfile) {
        return res
          .status(404)
          .json({ success: false, message: "Business profile not found" });
      }

      const business = await BusinessProfileModel.findById(user.businessProfile)
        .populate({
          path: "myServices.service",
          select: "name shopType status odoOutRequired"
        });

      if (!business) {
        return res
          .status(404)
          .json({ success: false, message: "Business profile not found" });
      }

      const services = (business.myServices || []).map(ms => {
        if (ms && ms.service) {
          return {
            _id: ms.service._id,
            name: ms.service.name,
            shopType: ms.service.shopType,
            status: ms.status || "Active", // status comes from myService entry
            date: ms.date, // date comes from myService entry
            odoOutRequired: ms.service.odoOutRequired,
            subServices: Array.isArray(ms.subServices) ? ms.subServices.map(sub => ({
              name: sub.name,
              desc: sub.desc,
              price: sub.price,
              quantity: sub.quantity, // added quantity
              tax: sub.tax, // added tax
              model: sub.model, // add model property in subServices
              make: sub.make   // add make property in subServices
            })) : []
          };
        }

        return null;
      }).filter(Boolean);

      return res.status(200).json({
        success: true,
        data: services
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch your services",
        error: error.message
      });
    }
  };
  
  
  // export const addToMyServices = async (req, res) => {
  //   try {
  //     const userId = req.user.id;
  //     const { serviceId, status, date } = req.body;
  
  //     if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
  //       return res
  //         .status(400)
  //         .json({ success: false, message: "Valid serviceId is required" });
  //     }
  
  //     if (status && !["Active", "Inactive"].includes(status)) {
  //       return res
  //         .status(400)
  //         .json({ success: false, message: "Status must be either 'Active' or 'Inactive'" });
  //     }
  
  //     let parsedDate = undefined;
  //     if (date) {
  //       const d = new Date(date);
  //       if (isNaN(d.getTime())) {
  //         return res.status(400).json({ success: false, message: "Invalid date format" });
  //       }
  //       parsedDate = d;
  //     }
  
  //     const service = await servicesSchema.findById(serviceId);
  //     if (!service) {
  //       return res.status(404).json({ success: false, message: "Service not found" });
  //     }
  
  //     const user = await User.findById(userId).select("businessProfile");
  //     if (!user || !user.businessProfile) {
  //       return res
  //         .status(404)
  //         .json({ success: false, message: "Business profile not found" });
  //     }
  
  //     const business = await BusinessProfileModel.findById(user.businessProfile);
  //     if (!business) {
  //       return res
  //         .status(404)
  //         .json({ success: false, message: "Business profile not found" });
  //     }
  
  //     const alreadyAdded = business.myServices.some(
  //       (ms) => ms.service.toString() === serviceId
  //     );
  //     if (alreadyAdded) {
  //       return res.status(409).json({
  //         success: false,
  //         message: "Service already added to your services",
  //       });
  //     }
  
  //     business.myServices.push({
  //       service: serviceId,
  //       status: status || "Active",
  //       date: parsedDate || new Date()
  //     });
  
  //     await business.save();
  
  //     // Populate the newly added service details for the response
  //     const populatedBusiness = await BusinessProfileModel.findById(user.businessProfile)
  //       .populate({
  //         path: "myServices.service",
  //         select: "name shopType status odoOutRequired"
  //       });
  
  //     // Send all myServices with detailed service info
  //     const responseMyServices = (populatedBusiness.myServices || []).map(ms => {
  //       if (ms && ms.service) {
  //         return {
  //           _id: ms.service._id,
  //           name: ms.service.name,
  //           shopType: ms.service.shopType,
  //           status: ms.status || "Active",
  //           date: ms.date,
  //           odoOutRequired: ms.service.odoOutRequired,
  //           // subServices and other fields can be included here as relevant
  //         };
  //       }
  //       return null;
  //     }).filter(Boolean);
  
  //     return res.status(200).json({
  //       success: true,
  //       message: "Service added successfully",
  //       data: responseMyServices,
  //     });
  //   } catch (error) {
  //     return res.status(500).json({
  //       success: false,
  //       message: "Failed to add service",
  //       error: error.message,
  //     });
  //   }
  // };
/* =========================================================
   SUBSERVICES (on an existing myServices entry)
 
   IMPORTANT: req.user (from jwtAuth) is only ever
   { id, role, name?, email?, permissions? } — it never
   carries `businessProfile`. Every function below fetches
   the User doc by id first to get businessProfile, rather
   than trusting req.user.businessProfile (which is always
   undefined and would silently break the lookup).
   ========================================================= */
 
// /**
//  * Add subServices to an existing myService entry
//  * Expects: req.body = {
//  *   serviceId: String,
//  *   subServices: [{ name, desc, price, quantity, tax }]
//  * }
//  */
// export const addSubServices = async (req, res) => {
//     try {
//       const { serviceId, subServices } = req.body;
   
//       if (!serviceId || !Array.isArray(subServices) || subServices.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: "serviceId and subServices array are required",
//         });
//       }
   
//       const user = await User.findById(req.user.id).select("businessProfile");
//       if (!user || !user.businessProfile) {
//         return res
//           .status(404)
//           .json({ success: false, message: "Business profile not found" });
//       }
   
//       const business = await BusinessProfileModel.findById(user.businessProfile);
//       if (!business) {
//         return res.status(404).json({ success: false, message: "Business not found" });
//       }
   
//       const myService = business.myServices.find(
//         (ms) => ms.service.toString() === serviceId
//       );
//       if (!myService) {
//         return res
//           .status(404)
//           .json({ success: false, message: "Service not found in your services" });
//       }

//       // Collect existing subService names (case-insensitive)
//       const existingNames = new Set(
//         (myService.subServices || []).map(s => s.name && s.name.trim().toLowerCase())
//       );

//       // Check for names within payload also (prevent same name in batch)
//       const namesToAdd = new Set();
//       const validSubs = [];

//       for (let sub of subServices) {
//         if (sub.name) {
//           const subNameKey = sub.name.trim().toLowerCase();
//           if (existingNames.has(subNameKey) || namesToAdd.has(subNameKey)) {
//             // Duplicate found, skip this sub or you can return error (preferred)
//             continue;
//           }
//           namesToAdd.add(subNameKey);
//           validSubs.push({
//             name: sub.name,
//             desc: sub.desc,
//             price: sub.price,
//             quantity: sub.quantity || 1,
//             tax: sub.tax || 0,
//           });
//         }
//       }

//       if (validSubs.length === 0) {
//         return res.status(409).json({
//           success: false,
//           message: "All given subService names already exist under this service.",
//         });
//       }

//       validSubs.forEach(sub => {
//         myService.subServices.push(sub);
//       });
   
//       await business.save();
//       return res.status(200).json({ 
//         success: true, 
//         message: `${validSubs.length} SubService(s) added`, 
//         data: myService 
//       });
//     } catch (error) {
//       return res.status(500).json({
//         success: false,
//         message: "Failed to add subServices",
//         error: error.message,
//       });
//     }
//   };

export const addSubServices = async (req, res) => {
  try {
    const { serviceId, subServices } = req.body;

    if (!serviceId || !Array.isArray(subServices) || subServices.length === 0) {
      console.log("[addSubServices] Invalid input:", { serviceId, subServices });
      return res.status(400).json({
        success: false,
        message: "serviceId and subServices array are required",
      });
    }

    // NOTE: select shopType too
    const user = await User.findById(req.user.id).select("businessProfile shopType");
    if (!user || !user.businessProfile) {
      console.log("[addSubServices] Business profile not found for user:", req.user.id);
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(user.businessProfile);
    if (!business) {
      console.log("[addSubServices] Business not found with ID:", user.businessProfile);
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const myService = business.myServices.find(
      (ms) => ms.service.toString() === serviceId
    );
    if (!myService) {
      console.log("[addSubServices] Service not found in user's services:", serviceId);
      return res
        .status(404)
        .json({ success: false, message: "Service not found in your services" });
    }

    // ---- NEW: shopType compatibility check ----
    const service = await servicesSchema.findById(serviceId).select("shopType");
    const userShopTypes = Array.isArray(user.shopType) ? user.shopType : [];
    if (!service || !service.shopType || !userShopTypes.includes(service.shopType)) {
      console.log("[addSubServices] ShopType mismatch or missing. Business shopTypes:", userShopTypes, "Service.shopType:", service && service.shopType);
      return res.status(403).json({
        success: false,
        message: `This service's shopType is not among your business's shopTypes (${userShopTypes.join(", ") || "none set"}). Cannot add subServices.`,
      });
    }
    // ---------------------------------------------

    // Collect existing subService names (case-insensitive)
    const existingNames = new Set(
      (myService.subServices || []).map(s => s.name && s.name.trim().toLowerCase())
    );

    const namesToAdd = new Set();
    const validSubs = [];

    for (let sub of subServices) {
      if (sub.name) {
        const subNameKey = sub.name.trim().toLowerCase();
        if (existingNames.has(subNameKey) || namesToAdd.has(subNameKey)) {
          console.log(`[addSubServices] Duplicate subService name skipped: '${sub.name}'`);
          continue;
        }
        namesToAdd.add(subNameKey);
        validSubs.push({
          name: sub.name,
          desc: sub.desc,
          price: sub.price,
          quantity: sub.quantity || 1,
          tax: sub.tax || 0,
          model: sub.model || null, // add model
          make: sub.make || null,   // add make
          quantityType: sub.quantityType || "Unit", // add quantityType, default Unit
          labourCost: sub.labourCost || 0, // add labourCost, default 0
        });
      } else {
        console.log("[addSubServices] SubService without name skipped:", sub);
      }
    }

    if (validSubs.length === 0) {
      console.log("[addSubServices] All subService names already exist or input invalid for service:", serviceId);
      return res.status(409).json({
        success: false,
        message: "All given subService names already exist under this service.",
      });
    }

    validSubs.forEach(sub => {
      myService.subServices.push(sub);
    });

    await business.save();
    console.log("[addSubServices] SubServices added:", validSubs.length, "ServiceId:", serviceId, "BusinessId:", business._id);
    return res.status(200).json({
      success: true,
      message: `${validSubs.length} SubService(s) added`,
      data: myService
    });
  } catch (error) {
    console.error("[addSubServices] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add subServices",
      error: error.message,
    });
  }
};

/**
 * Edit a subService for a given myService entry
 * Expects: req.body = {
 *   serviceId: String,
 *   subServiceIndex: Number,
 *   update: { name, desc, price, quantity, tax, model, make, quantityType, labourCost }
 * }
 */
export const editSubService = async (req, res) => {
  try {
    const { serviceId, subServiceIndex, update } = req.body;

    if (
      !serviceId ||
      typeof subServiceIndex !== "number" ||
      !update ||
      Object.keys(update).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "serviceId, subServiceIndex, and update object are required",
      });
    }

    const user = await User.findById(req.user.id).select("businessProfile");
    if (!user || !user.businessProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(user.businessProfile);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const myService = business.myServices.find(
      (ms) => ms.service.toString() === serviceId
    );
    if (!myService) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found in your services" });
    }

    if (subServiceIndex < 0 || subServiceIndex >= myService.subServices.length) {
      return res.status(404).json({ success: false, message: "SubService not found" });
    }

    // If updating 'name', check for duplicates
    if (
      update.name &&
      (
        myService.subServices.findIndex((s, idx) =>
          idx !== subServiceIndex &&
          s.name &&
          s.name.trim().toLowerCase() === update.name.trim().toLowerCase()
        ) !== -1
      )
    ) {
      return res.status(409).json({
        success: false,
        message: `A subService with name '${update.name}' already exists under this service.`,
      });
    }

    const subService = myService.subServices[subServiceIndex];
    [
      "name",
      "desc",
      "price",
      "quantity",
      "tax",
      "model",
      "make",
      "quantityType",
      "labourCost",
    ].forEach((field) => {
      if (update[field] !== undefined) subService[field] = update[field];
    });

    await business.save();
    return res.status(200).json({ success: true, message: "SubService updated", data: subService });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update subService",
      error: error.message,
    });
  }
};
  /**
   * Delete a subService from a given myService entry
   * Expects: req.body = { serviceId: String, subServiceIndex: Number }
   */
  export const deleteSubService = async (req, res) => {
    try {
      const { serviceId, subServiceIndex } = req.body;
   
      if (!serviceId || typeof subServiceIndex !== "number") {
        return res.status(400).json({
          success: false,
          message: "serviceId and subServiceIndex are required",
        });
      }
   
      const user = await User.findById(req.user.id).select("businessProfile");
      if (!user || !user.businessProfile) {
        return res
          .status(404)
          .json({ success: false, message: "Business profile not found" });
      }
   
      const business = await BusinessProfileModel.findById(user.businessProfile);
      if (!business) {
        return res.status(404).json({ success: false, message: "Business not found" });
      }
   
      const myService = business.myServices.find(
        (ms) => ms.service.toString() === serviceId
      );
      if (!myService) {
        return res
          .status(404)
          .json({ success: false, message: "Service not found in your services" });
      }
   
      if (subServiceIndex < 0 || subServiceIndex >= myService.subServices.length) {
        return res.status(404).json({ success: false, message: "SubService not found" });
      }
   
      myService.subServices.splice(subServiceIndex, 1);
   
      await business.save();
      return res.status(200).json({ success: true, message: "SubService deleted" });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete subService",
        error: error.message,
      });
    }
  };

//     try {
//       const userId = req.user.id;
//       const { serviceId, subServices } = req.body; // subServices: [{ name, desc, price }]
   
//       if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Valid serviceId is required" });
//       }
   
//       const service = await Services.findById(serviceId);
//       if (!service) {
//         return res.status(404).json({ success: false, message: "Service not found" });
//       }
   
//       const user = await User.findById(userId).select("businessProfile");
//       if (!user || !user.businessProfile) {
//         return res
//           .status(404)
//           .json({ success: false, message: "Business profile not found" });
//       }
   
//       const business = await BusinessProfileModel.findById(user.businessProfile);
//       if (!business) {
//         return res
//           .status(404)
//           .json({ success: false, message: "Business profile not found" });
//       }
   
//       const alreadyAdded = business.myServices.some(
//         (ms) => ms.service.toString() === serviceId
//       );
//       if (alreadyAdded) {
//         return res.status(409).json({
//           success: false,
//           message: "Service already added to your services",
//         });
//       }
   
//       business.myServices.push({
//         service: serviceId,
//         subServices: Array.isArray(subServices) ? subServices : [],
//       });
   
//       await business.save();
   
//       return res.status(200).json({
//         success: true,
//         message: "Service added successfully",
//         data: business.myServices,
//       });
//     } catch (error) {
//       return res.status(500).json({
//         success: false,
//         message: "Failed to add service",
//         error: error.message,
//       });
//     }
//   };


export const addToMyServices = async (req, res) => {
  try {
    const userId = req.user.id;
    const { serviceId, status, date } = req.body;

    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid serviceId is required" });
    }

    if (status && !["Active", "Inactive"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Status must be either 'Active' or 'Inactive'" });
    }

    let parsedDate = undefined;
    if (date) {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid date format" });
      }
      parsedDate = d;
    }

    const service = await servicesSchema.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    // NOTE: select shopType too, so we can validate against the service's shopType
    const user = await User.findById(userId).select("businessProfile shopType");
    if (!user || !user.businessProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    // ---- NEW: shopType compatibility check ----
    const userShopTypes = Array.isArray(user.shopType) ? user.shopType : [];
    if (!service.shopType || !userShopTypes.includes(service.shopType)) {
      return res.status(403).json({
        success: false,
        message: `This service belongs to shopType '${service.shopType}', which is not among your business's shopTypes (${userShopTypes.join(", ") || "none set"}).`,
      });
    }
    // ---------------------------------------------

    const business = await BusinessProfileModel.findById(user.businessProfile);
    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const alreadyAdded = business.myServices.some(
      (ms) => ms.service.toString() === serviceId
    );
    if (alreadyAdded) {
      return res.status(409).json({
        success: false,
        message: "Service already added to your services",
      });
    }

    business.myServices.push({
      service: serviceId,
      status: status || "Active",
      date: parsedDate || new Date()
    });

    await business.save();

    const populatedBusiness = await BusinessProfileModel.findById(user.businessProfile)
      .populate({
        path: "myServices.service",
        select: "name shopType status odoOutRequired"
      });

    const responseMyServices = (populatedBusiness.myServices || []).map(ms => {
      if (ms && ms.service) {
        return {
          _id: ms.service._id,
          name: ms.service.name,
          shopType: ms.service.shopType,
          status: ms.status || "Active",
          date: ms.date,
          odoOutRequired: ms.service.odoOutRequired,
        };
      }
      return null;
    }).filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Service added successfully",
      data: responseMyServices,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add service",
      error: error.message,
    });
  }
};