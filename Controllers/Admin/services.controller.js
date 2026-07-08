// import Services from "../../Schema/services.schema.js";



// class ServicesController {



// // Add a new service
// async addService(req, res) {
//   try {
//     const { name, status, subServices, shopType } = req.body;

//     // Validate required fields
//     const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
//     if (!shopType || !allowedShopTypes.includes(shopType)) {
//       return res.status(400).json({ success: false, message: `shopType is required and must be one of: ${allowedShopTypes.join(", ")}` });
//     }

//     // Ensure subServices contains only name and status fields (no dups allowed)
//     const formattedSubServices = Array.isArray(subServices)
//       ? subServices.map(({ name, status }) => ({ name, status }))
//       : [];

//     // Check for duplicate subService names
//     const names = formattedSubServices.map(sub => sub.name && sub.name.trim().toLowerCase()).filter(Boolean);
//     const uniqueNames = new Set(names);
//     if (names.length !== uniqueNames.size) {
//       return res.status(400).json({ success: false, message: "Duplicate subService names are not allowed within a single service." });
//     }

//     const newService = new Services({
//       name,
//       status,
//       subServices: formattedSubServices,
//       shopType
//     });
//     await newService.save();
//     res.status(201).json({ success: true, message: "Service added successfully", data: newService });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error adding service", error: err.message });
//   }
// }

// // Edit a service by ID
// async editService(req, res) {
//   try {
//     const { id } = req.params;
//     const { name, status, subServices, shopType } = req.body;

//     // Fetch existing service to check existence
//     const existingService = await Services.findById(id);
//     if (!existingService) {
//       return res.status(404).json({ success: false, message: "Category not found" });
//     }

//     // Prepare update fields
//     const updateFields = {};
//     if (name !== undefined) updateFields.name = name;
//     if (status !== undefined) updateFields.status = status;
//     if (shopType !== undefined) {
//       const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
//       if (!allowedShopTypes.includes(shopType)) {
//         return res.status(400).json({ success: false, message: `shopType must be one of: ${allowedShopTypes.join(", ")}` });
//       }
//       updateFields.shopType = shopType;
//     }

//     if (subServices !== undefined) {
//       const formattedSubServices = Array.isArray(subServices)
//         ? subServices.map(({ name, status }) => ({ name, status }))
//         : [];

//       // Check for duplicate subService names
//       const names = formattedSubServices.map(sub => sub.name && sub.name.trim().toLowerCase()).filter(Boolean);
//       const uniqueNames = new Set(names);
//       if (names.length !== uniqueNames.size) {
//         return res.status(400).json({ success: false, message: "Duplicate subService names are not allowed within a single service." });
//       }

//       updateFields.subServices = formattedSubServices;
//     }

//     const updatedService = await Services.findByIdAndUpdate(
//       id,
//       updateFields,
//       { new: true }
//     );
//     res.status(200).json({ success: true, message: "Category updated", data: updatedService });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error editing category", error: err.message });
//   }
// }

// // Delete a service by ID with referential integrity check
// async deleteService(req, res) {
//   try {
//     const { id } = req.params;
//     const BusinessProfileModel = (await import('../../Schema/bussiness-profile.js')).default;
//     const JobCard = (await import('../../Schema/jobCard.schema.js')).default;

//     // 1. Check if any business profile uses this service in its myServices array
//     const businessProfileUsingService = await BusinessProfileModel.findOne({ 'myServices.service': id });
//     if (businessProfileUsingService) {
//       return res.status(400).json({
//         success: false,
//         message: "Cannot delete: This category is still referenced by a business profile."
//       });
//     }

//     // 2. Check if any JobCard references this service in its services array
//     const jobCardUsingService = await JobCard.findOne({ 'services.id': id });
//     if (jobCardUsingService) {
//       return res.status(400).json({
//         success: false,
//         message: "Cannot delete: This category is still referenced by a job card."
//       });
//     }

//     // OK to delete
//     const deleted = await Services.findByIdAndDelete(id);
//     if (!deleted) {
//       return res.status(404).json({ success: false, message: "Category not found" });
//     }
//     res.status(200).json({ success: true, message: "Category deleted" });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error deleting category", error: err.message });
//   }
// }

// // Fetch all services with optional shopType filter
// async fetchServices(req, res) {
//   try {
//     const { shopType } = req.query;
//     // shopType can be one of: autoShop, tyreShop, carWash, towTruck, or "all"/undefined
//     const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
//     let query = {};
//     if (shopType && shopType !== "all") {
//       if (!allowedShopTypes.includes(shopType)) {
//         return res.status(400).json({
//           success: false,
//           message: `Invalid shopType value. Allowed: all, ${allowedShopTypes.join(", ")}`
//         });
//       }
//       query.shopType = shopType;
//     }
//     const allServices = await Services.find(query);
//     res.status(200).json({ success: true, data: allServices });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching categories", error: err.message });
//   }
// }


// }

// export default ServicesController;



import Services from "../../Schema/services.schema.js";

class ServicesController {

// Add a new service
async addService(req, res) {
  try {
    const { name, status, subServices, shopType, odoOutRequired = false } = req.body;

    console.log(status)

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
    if (!shopType || !allowedShopTypes.includes(shopType)) {
      return res.status(400).json({ success: false, message: `shopType is required and must be one of: ${allowedShopTypes.join(", ")}` });
    }

    const allowedStatuses = ["Active", "Inactive"];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${allowedStatuses.join(", ")}` });
    }

    if (odoOutRequired !== undefined && typeof odoOutRequired !== "boolean") {
      return res.status(400).json({ success: false, message: "odoOutRequired must be a boolean" });
    }

    // Ensure subServices contains only name and status fields (no dups allowed)
    const formattedSubServices = Array.isArray(subServices)
      ? subServices.map(({ name, status }) => ({ name, status }))
      : [];

    // Check for duplicate subService names
    const names = formattedSubServices.map(sub => sub.name && sub.name.trim().toLowerCase()).filter(Boolean);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      return res.status(400).json({ success: false, message: "Duplicate subService names are not allowed within a single service." });
    }

    const newService = new Services({
      name: name.trim(),
      status,
      subServices: formattedSubServices,
      shopType,
      odoOutRequired
    });
    await newService.save();
    res.status(201).json({ success: true, message: "Service added successfully", data: newService });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding service", error: err.message });
  }
}

// Edit a service by ID
async editService(req, res) {
  try {
    const { id } = req.params;
    const { name, status, subServices, shopType, odoOutRequired } = req.body;

    // Fetch existing service to check existence
    const existingService = await Services.findById(id);
    if (!existingService) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Prepare update fields
    const updateFields = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "name cannot be empty" });
      }
      updateFields.name = name.trim();
    }

    if (status !== undefined) {
      const allowedStatuses = ["Active", "Inactive"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${allowedStatuses.join(", ")}` });
      }
      updateFields.status = status;
    }

    if (shopType !== undefined) {
      const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
      if (!allowedShopTypes.includes(shopType)) {
        return res.status(400).json({ success: false, message: `shopType must be one of: ${allowedShopTypes.join(", ")}` });
      }
      updateFields.shopType = shopType;
    }

    if (odoOutRequired !== undefined) {
      if (typeof odoOutRequired !== "boolean") {
        return res.status(400).json({ success: false, message: "odoOutRequired must be a boolean" });
      }
      updateFields.odoOutRequired = odoOutRequired;
    }

    if (subServices !== undefined) {
      const formattedSubServices = Array.isArray(subServices)
        ? subServices.map(({ name, status }) => ({ name, status }))
        : [];

      // Check for duplicate subService names
      const names = formattedSubServices.map(sub => sub.name && sub.name.trim().toLowerCase()).filter(Boolean);
      const uniqueNames = new Set(names);
      if (names.length !== uniqueNames.size) {
        return res.status(400).json({ success: false, message: "Duplicate subService names are not allowed within a single service." });
      }

      updateFields.subServices = formattedSubServices;
    }

    const updatedService = await Services.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );
    res.status(200).json({ success: true, message: "Category updated", data: updatedService });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error editing category", error: err.message });
  }
}

// Delete a service by ID with referential integrity check
async deleteService(req, res) {
  try {
    const { id } = req.params;
    const BusinessProfileModel = (await import('../../Schema/bussiness-profile.js')).default;
    const JobCard = (await import('../../Schema/jobCard.schema.js')).default;

    // 1. Check if any business profile uses this service in its myServices array
    const businessProfileUsingService = await BusinessProfileModel.findOne({ 'myServices.service': id });
    if (businessProfileUsingService) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete: This category is still referenced by a business profile."
      });
    }

    // 2. Check if any JobCard references this service in its services array
    const jobCardUsingService = await JobCard.findOne({ 'services.id': id });
    if (jobCardUsingService) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete: This category is still referenced by a job card."
      });
    }

    // OK to delete
    const deleted = await Services.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting category", error: err.message });
  }
}

// Fetch all services with optional shopType filter
async fetchServices(req, res) {
  try {
    const { shopType } = req.query;
    // shopType can be one of: autoShop, tyreShop, carWash, towTruck, or "all"/undefined
    const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
    let query = {};
    if (shopType && shopType !== "all") {
      if (!allowedShopTypes.includes(shopType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid shopType value. Allowed: all, ${allowedShopTypes.join(", ")}`
        });
      }
      query.shopType = shopType;
    }
    const allServices = await Services.find(query);
    res.status(200).json({ success: true, data: allServices });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching categories", error: err.message });
  }
}

}

export default ServicesController;