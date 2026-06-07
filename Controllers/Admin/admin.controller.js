import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import adsSchema from "../../Schema/ads.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import CarCompany from "../../Schema/car-company-schema.js";
import City from "../../Schema/cities.schema.js";
import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";
import WebsiteTemplateSchema from "../../Schema/WebsiteTemplateSchema.js";


class AdminController {


// @route   GET /admin/dashboard-details
// @desc    Get dashboard counts for Car owners, Auto Shop owners, JobCards, Deals, Services, and SubServices
// @access  Admin (authentication assumed at higher middleware)
async getDashboardDetails(req, res) {
  try {
    // 1. Car owners count (role === 'car-owner')
    const carOwnersCount = await User.countDocuments({ role: 'carowner' });

    // 2. Auto Shop Owners count (role === 'autoshop-owner')
    const autoShopOwnersCount = await User.countDocuments({ role: 'autoshopowner' });

    // 3. All JobCards
    const jobCardsCount = await JobCard.countDocuments({});

    // --- Added: JobCards count per day (createdAt) for bar graph data ---
    const jobCardsByDateAggregation = await JobCard.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const jobCardsByDate = jobCardsByDateAggregation.map(item => ({
      date: item._id,
      count: item.count
    }));

    // 4. All Deals
    const dealsCount = await DealModel.countDocuments({});

    // 5. All Services
    const services = await Services.find({});
    const servicesCount = services.length;

    // 6. All SubServices (sum of all subservices in all Services)
    let subServicesCount = 0;
    for (const svc of services) {
      if (svc.services && Array.isArray(svc.services)) {
        subServicesCount += svc.services.length;
      }
    }

    // Fetch latest DashboardData for thoughtOfTheDay and thoughtOfTheDayLike
    let thoughtOfTheDay = '';
    let thoughtOfTheDayLike = 0;
    try {
      const dashboardData = await DashboardDataModel.findOne({}, { thoughtOfTheDay: 1, thoughtOfTheDayLike: 1 })
        .sort({ createdAt: -1 })
        .lean();
      if (dashboardData) {
        if (typeof dashboardData.thoughtOfTheDay === 'string') {
          thoughtOfTheDay = dashboardData.thoughtOfTheDay;
        }
        if (typeof dashboardData.thoughtOfTheDayLike === 'number') {
          thoughtOfTheDayLike = dashboardData.thoughtOfTheDayLike;
        }
      }
    } catch (e) {
      // fallback: nothing extra required, send defaults
    }

    return res.status(200).json({
      success: true,
      data: {
        carOwnersCount,
        autoShopOwnersCount,
        jobCardsCount,
        jobCardsByDate,
        dealsCount,
        servicesCount,
        subServicesCount,
        thoughtOfTheDay,     // newly added field
        thoughtOfTheDayLike, // newly added field
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard counts",
      error: err.message
    });
  }
}

// Add a new service
async addService(req, res) {
  try {
    const { name, desc } = req.body;
    const newService = new Services({ name, desc });
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
    const { name, desc } = req.body;

    // Fetch existing service to check existence
    const existingService = await Services.findById(id);
    if (!existingService) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    // Update the service without any subservice logic
    const updatedService = await Services.findByIdAndUpdate(
      id,
      { name, desc },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Service updated", data: updatedService });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error editing service", error: err.message });
  }
}

// Delete a service by ID with referential integrity check
async deleteService(req, res) {
  try {
    const { id } = req.params;
    // Import models here or at the top if not already imported
    const BusinessProfileModel = (await import('../../Schema/bussiness-profile.js')).default;
    const JobCard = (await import('../../Schema/jobCard.schema.js')).default;

    // 1. Check if any business profile uses this service in its myServices array
    const businessProfileUsingService = await BusinessProfileModel.findOne({ 'myServices.service': id });
    if (businessProfileUsingService) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete: This service is still referenced by a business profile."
      });
    }

    // 2. Check if any JobCard references this service in its services array
    const jobCardUsingService = await JobCard.findOne({ 'services.id': id });
    if (jobCardUsingService) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete: This service is still referenced by a job card."
      });
    }

    // OK to delete
    const deleted = await Services.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    res.status(200).json({ success: true, message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting service", error: err.message });
  }
}

// Fetch all services
async fetchServices(req, res) {
  try {
    const allServices = await Services.find({});
    res.status(200).json({ success: true, data: allServices });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching services", error: err.message });
  }
}


async getAllCarOwners(req, res) {
  try {
    console.log("[getAllCarOwners] Step 1: Fetching car owners from User collection...");
    let carOwners = await User.find(
      { role: "carowner" },
      {
        name: 1,
        email: 1,
        countryCode: 1,
        phone: 1,
        pincode: 1,
        address: 1,
        isDisabled: 1,
        isProfileComplete: 1,
        favoriteAutoShops: 1,
        myVehicles: 1,
        onboardedBy: 1
      }
    )
      .populate({
        path: 'myVehicles',
        model: 'Vehicle',
      })
      .populate({
        path: 'favoriteAutoShops',
        model: 'BusinessProfile',
      })
      .populate({
        path: 'onboardedBy',
        model: 'User',
        select: 'name email',
      });

    // After populating favoriteAutoShops, add isFav: true to each favorite autoshop
    carOwners = carOwners.map(owner => {
      if (owner.favoriteAutoShops && Array.isArray(owner.favoriteAutoShops)) {
        owner.favoriteAutoShops = owner.favoriteAutoShops.map(shop => ({
          ...((typeof shop.toObject === 'function') ? shop.toObject() : shop),
          isFav: true
        }));
      }
      return owner;
    });

    // For lean() (which returns plain JS objects), and to keep the rest of logic, convert now to lean
    carOwners = JSON.parse(JSON.stringify(carOwners));

    console.log(`[getAllCarOwners] Step 1 result: Found ${carOwners.length} car owners`);

    // Gather all owner ids for job card lookup
    const ownerIds = carOwners.map(owner => owner._id);
    console.log(`[getAllCarOwners] Step 2: Owner IDs -`, ownerIds);

    // Get all JobCards for these car owners
    console.log("[getAllCarOwners] Step 3: Fetching all JobCards for car owners...");
    const allJobCards = await JobCard.find({ customerId: { $in: ownerIds } })
      .populate({
        path: 'business',
        model: 'BusinessProfile',
      })
      .populate({
        path: 'vehicleId',
        model: 'Vehicle',
      })
      .populate({
        path: 'customerId',
        model: 'User',
        select: 'name email'
      })
      .lean();

    console.log(`[getAllCarOwners] Step 3 result: Found ${allJobCards.length} job cards for given car owners`);

    // Helper: group job cards by car owner
    const jobCardsByOwner = {};
    for (const jobCard of allJobCards) {
      const ownerId = jobCard.customerId?._id
        ? jobCard.customerId._id.toString()
        : jobCard.customerId?.toString();
      if (!ownerId) continue;
      if (!jobCardsByOwner[ownerId]) {
        jobCardsByOwner[ownerId] = [];
      }
      jobCardsByOwner[ownerId].push(jobCard);
    }

    // For each owner, build list of all distinct autoshops they received service from,
    // and for each, also indicate isFav: true/false (present in favoriteAutoShops)
    carOwners = await Promise.all(
      carOwners.map(async owner => {
        const ownerId = owner._id.toString();
        const jobCards = jobCardsByOwner[ownerId] || [];

        // Get the set of unique autoshop IDs from jobCards
        const serviceAutoshopIds = new Set();
        const serviceAutoshopsMap = {};
        for (const jobCard of jobCards) {
          const business = jobCard.business;
          if (business && business._id) {
            const _idStr = business._id.toString();
            if (!serviceAutoshopsMap[_idStr]) {
              // --- POPULATE SERVICE NAMES FOR THIS BUSINESS PROFILE ---
              // Populate myServices for this shop with service names
              let newBusiness = { ...business };
              if (Array.isArray(newBusiness.myServices)) {
                // Fetch service names for all referenced service ids in myServices
                const serviceIds = newBusiness.myServices
                  .map(ms => (ms && ms.service ? ms.service.toString() : null))
                  .filter(Boolean);
                let serviceDocsMap = {};
                if (serviceIds.length > 0) {
                  const serviceDocs = await Services.find({ _id: { $in: serviceIds } }, { name: 1 });
                  serviceDocsMap = serviceDocs.reduce((acc, doc) => {
                    acc[doc._id.toString()] = doc.name;
                    return acc;
                  }, {});
                }
                newBusiness.myServices = newBusiness.myServices.map(ms => {
                  const msObj = (ms && typeof ms === "object") ? { ...ms } : {};
                  if (msObj.service && typeof msObj.service === "object" && msObj.service._id && msObj.service.name) {
                    // Already populated (unlikely, but preserve)
                    msObj.serviceName = msObj.service.name;
                  } else if (msObj.service && serviceDocsMap[msObj.service.toString()]) {
                    msObj.serviceName = serviceDocsMap[msObj.service.toString()];
                  }
                  // For convenience, still include the service id itself
                  msObj.serviceId = typeof msObj.service === "object" && msObj.service._id
                    ? msObj.service._id.toString()
                    : msObj.service?.toString?.() || '';
                  return msObj;
                });
              }
              serviceAutoshopsMap[_idStr] = newBusiness;
              serviceAutoshopIds.add(_idStr);
            }
          }
        }

        // For quicker lookup of "favorite" autoshop IDs
        const favShopIds = new Set(
          Array.isArray(owner.favoriteAutoShops)
            ? owner.favoriteAutoShops.map(fav =>
              typeof fav === "string" ? fav : fav?._id?.toString?.() || fav?.toString?.() || ''
            ).filter(Boolean)
            : []
        );

        // List all received-service autoshops with isFav property
        const autoshopsUsed = Array.from(serviceAutoshopIds).map(shopId => {
          const shop = serviceAutoshopsMap[shopId];
          return {
            ...shop,
            isFav: favShopIds.has(shopId),
          };
        });

        return {
          ...owner,
          jobCards,
          autoshopsReceivedServiceFrom: autoshopsUsed,
        };
      })
    );

    res.status(200).json({ success: true, data: carOwners });
  } catch (err) {
    console.log("[getAllCarOwners][Error]", err);
    res.status(500).json({ success: false, message: "Error fetching car owners", error: err.message });
  }
}


// Get all auto shop owners
async getAllAutoShopOwners(req, res) {
  try {
    // Find users with role 'autoshopowner', select specific fields only
    const autoShopOwnersRaw = await User.find(
      { role: "autoshopowner" },
      {
        name: 1,
        email: 1,
        countryCode: 1,
        phone: 1,
        pincode: 1,
        address: 1,
        isDisabled: 1,
        isProfileComplete: 1,
        isBusinessProfileCompleted: 1,
        businessProfile: 1,
        myCustomers: 1
      }
    )
      .populate({
        path: 'businessProfile',
        model: 'BusinessProfile',
        populate: [
          {
            path: 'myServices.service',
            model: 'Services'
          },
          {
            path: 'myDeals',
            model: 'Deal'
          }
        ]
      })
      .populate({
        path: 'myCustomers',
        model: 'User',
        select: 'name email phone' // Optional: select subset of customer info
      })
      .lean();

    // Helper function to populate valueId accordingly (unchanged)
    async function populateDealValueIds(deals) {
      if (!Array.isArray(deals)) return deals;
      return Promise.all(
        deals.map(async (deal) => {
          if (deal.type === 'services' && deal.valueId) {
            const ServiceModel = require('../../Schema/services.schema').default || require('../../Schema/services.schema');
            const service = await ServiceModel.findById(deal.valueId).lean();
            return { ...deal, value: service || null };
          } else if (deal.type === 'subservices' && deal.valueId) {
            const ServiceModel = require('../../Schema/services.schema').default || require('../../Schema/services.schema');
            const serviceDoc = await ServiceModel.findOne({ "services._id": deal.valueId }, { "services.$": 1, name: 1 }).lean();
            let subservice = null;
            if (serviceDoc && serviceDoc.services && serviceDoc.services[0]) {
              subservice = {
                ...serviceDoc.services[0],
                parentServiceName: serviceDoc.name
              };
            }
            return { ...deal, value: subservice || null };
          }
          return deal;
        })
      );
    }

    // For each autoShopOwner, populate their businessProfile.myDeals accordingly (if exists)
    if (Array.isArray(autoShopOwnersRaw)) {
      for (const owner of autoShopOwnersRaw) {
        if (
          owner.businessProfile &&
          owner.businessProfile.myDeals &&
          Array.isArray(owner.businessProfile.myDeals)
        ) {
          owner.businessProfile.myDeals = await populateDealValueIds(owner.businessProfile.myDeals);
        }
      }
    }

    // Collect all businessProfile _ids to fetch JobCards in one go
    const businessProfileIds = autoShopOwnersRaw
      .map(o => o.businessProfile && o.businessProfile._id ? o.businessProfile._id.toString() : null)
      .filter(id => !!id);

    // Bulk fetch all JobCards where 'business' matches any auto shop owner's businessProfile _id
    // Use .lean() for performance, unless you need Mongoose docs for virtuals etc.
    const allJobCards = await JobCard.find({ business: { $in: businessProfileIds } }).lean();

    // Group JobCards by business (businessProfile _id)
    const jobCardsByBusiness = {};
    for (const jobCard of allJobCards) {
      const businessId = jobCard.business?.toString();
      if (!businessId) continue;
      if (!jobCardsByBusiness[businessId]) {
        jobCardsByBusiness[businessId] = [];
      }
      jobCardsByBusiness[businessId].push(jobCard);
    }

    // Fetch deals for each auto shop owner, and attach jobCards array for each owner (by their businessProfile)
    const autoShopOwners = await Promise.all(
      autoShopOwnersRaw.map(async (owner) => {
        let deals = [];
        if (owner.businessProfile?._id) {
          deals = await DealModel.find(
            { createdBy: owner.businessProfile._id }
          ).lean();
        }
        // Gather jobCards for this owner (their businessProfile._id)
        const jobCards = owner.businessProfile && owner.businessProfile._id
          ? (jobCardsByBusiness[owner.businessProfile._id.toString()] || [])
          : [];

        return {
          ...owner,
          deals,
          jobCards
        };
      })
    );

    res.status(200).json({ success: true, data: autoShopOwners });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching auto shop owners", error: err.message });
  }
}

// --- Enable/Disable AutoShopOwner (with transaction support) ---

/**
 * Enable or disable an AutoShopOwner (and their linked businessProfile).
 * - Updates User's isDisabled field.
 * - Updates businessProfile's isBusinessActive.
 * - Accepts { userId, disable } in req.body.
 * - Uses MongoDB transactions for safety (when supported).
 */
async toggleAutoShopOwnerStatus(req, res) {
  let session = null;
  try {
    const { userId, disable } = req.body;
    if (!userId || typeof disable !== 'boolean') {
      return res.status(400).json({ success: false, message: "userId and disable (boolean) are required." });
    }

    // Dynamic import for User and BusinessProfile models
    const { User } = await import('../../Schema/user.schema.js');
    const BusinessProfileModel = (await import('../../Schema/bussiness-profile.js')).default;

    // Start transaction session
    session = await User.startSession();
    session.startTransaction();

    // 1. Find and update User (must be autoshopowner)
    const user = await User.findOne({ _id: userId, role: 'autoshopowner' }).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "AutoShopOwner not found." });
    }

    user.isDisabled = disable;
    await user.save({ session });

    // 2. Update associated BusinessProfile (if any)
    let businessUpdated = null;
    if (user.businessProfile) {
      businessUpdated = await BusinessProfileModel.findByIdAndUpdate(
        user.businessProfile,
        { isBusinessActive: !disable },
        { new: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `AutoShopOwner ${disable ? "disabled" : "enabled"} successfully.`,
      updated: {
        user: {
          _id: user._id,
          isDisabled: user.isDisabled,
        },
        businessProfile: businessUpdated ? {
          _id: businessUpdated._id,
          isBusinessActive: businessUpdated.isBusinessActive
        } : null
      }
    });
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); session.endSession(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: "Error toggling auto shop owner status",
      error: err.message
    });
  }
}





// --- VEHICLE TYPE CONTROLLERS (CRUD) ---


// // Fetch all vehicle types
// async fetchVehicleTypes  (req, res) {
//   try {
//     const types = await VehicleType.find({});
//     res.status(200).json({ success: true, data: types });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching vehicle types", error: err.message });
//   }
// };

// // Add a new vehicle type
// async addVehicleType  (req, res) {
//   try {
//     const { type } = req.body;
//     if (!type || typeof type !== "string" || !type.trim()) {
//       return res.status(400).json({ success: false, message: "Vehicle type is required and must be a non-empty string" });
//     }
//     // Prevent duplicate type (case-insensitive)
//     const exists = await VehicleType.findOne({ type: { $regex: new RegExp(`^${type.trim()}$`, 'i') } });
//     if (exists) {
//       return res.status(409).json({ success: false, message: "Vehicle type already exists" });
//     }
//     const vehicleType = new VehicleType({ type: type.trim() });
//     await vehicleType.save();
//     res.status(201).json({ success: true, data: vehicleType });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error adding vehicle type", error: err.message });
//   }
// };

// // Edit a vehicle type
// async updateVehicleType  (req, res) {
//   try {
//     const { id } = req.params;
//     const { type } = req.body;
//     if (!type || typeof type !== "string" || !type.trim()) {
//       return res.status(400).json({ success: false, message: "Vehicle type is required and must be a non-empty string" });
//     }
//     // Prevent updating to a duplicate type
//     const exists = await VehicleType.findOne({ 
//       _id: { $ne: id }, 
//       type: { $regex: new RegExp(`^${type.trim()}$`, 'i') } 
//     });
//     if (exists) {
//       return res.status(409).json({ success: false, message: "Another vehicle type with this name already exists" });
//     }

//     const updated = await VehicleType.findByIdAndUpdate(
//       id,
//       { type: type.trim() },
//       { new: true }
//     );
//     if (!updated) {
//       return res.status(404).json({ success: false, message: "Vehicle type not found" });
//     }
//     res.status(200).json({ success: true, data: updated });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error updating vehicle type", error: err.message });
//   }
// };

// // Delete a vehicle type
// async deleteVehicleType  (req, res) {
//   try {
//     const { id } = req.params;
//     const deleted = await VehicleType.findByIdAndDelete(id);
//     if (!deleted) {
//       return res.status(404).json({ success: false, message: "Vehicle type not found" });
//     }
//     res.status(200).json({ success: true, message: "Vehicle type deleted", data: deleted });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error deleting vehicle type", error: err.message });
//   }
// };


  /**
   * Create a new website template.
   * POST /api/autoshop/website-templates
   */
  async createWebsiteTemplate(req, res) {
    try {
        const { name, desc, templateLink } = req.body;
        if (!name || !desc || !templateLink) {
            return res.status(400).json({ message: "name, desc, and templateLink are required." });
        }

        // Check for duplicate name
        const existing = await WebsiteTemplateSchema.findOne({ name });
        if (existing) {
            return res.status(409).json({ message: "A template with this name already exists." });
        }

        const newTemplate = await WebsiteTemplateSchema.create({ name, desc, templateLink });
        return res.status(201).json({ success: true, data: newTemplate });
    } catch (err) {
        console.error("[createWebsiteTemplate] Error:", err);
        return res.status(500).json({ message: "Failed to create website template", error: err.message });
    }
}

  /**
   * Edit an existing website template.
   * PUT /api/autoshop/website-templates/:id
   */
  async editWebsiteTemplate(req, res) {
      try {
          const { id } = req.params;
          const { name, desc, templateLink } = req.body;
          if (!id) {
              return res.status(400).json({ message: "id parameter is required." });
          }

          // If updating name, check for duplicate (excluding current template)
          if (name) {
              const exists = await WebsiteTemplateSchema.findOne({ name, _id: { $ne: id } });
              if (exists) {
                  return res.status(409).json({ message: "A template with this name already exists." });
              }
          }
          
          const updateFields = {};
          if (name !== undefined) updateFields.name = name;
          if (desc !== undefined) updateFields.desc = desc;
          if (templateLink !== undefined) updateFields.templateLink = templateLink;

          const updated = await WebsiteTemplateSchema.findByIdAndUpdate(id, updateFields, { new: true });
          if (!updated) {
              return res.status(404).json({ message: "Website template not found" });
          }
          return res.status(200).json({ success: true, data: updated });
      } catch (err) {
          console.error("[editWebsiteTemplate] Error:", err);
          return res.status(500).json({ message: "Failed to edit website template", error: err.message });
      }
  }

  /**
   * Delete a website template by ID.
   * DELETE /api/autoshop/website-templates/:id
   */
  async deleteWebsiteTemplate(req, res) {
      try {
          const { id } = req.params;
          if (!id) {
              return res.status(400).json({ message: "id parameter is required." });
          }
          
          const deleted = await WebsiteTemplateSchema.findByIdAndDelete(id);
          if (!deleted) {
              return res.status(404).json({ message: "Website template not found." });
          }
          return res.status(200).json({ success: true, message: "Website template deleted." });
      } catch (err) {
          console.error("[deleteWebsiteTemplate] Error:", err);
          return res.status(500).json({ message: "Failed to delete website template", error: err.message });
      }
  }

  /**
   * Fetch all website templates.
   * GET /api/autoshop/website-templates
   */
  async fetchWebsiteTemplates(req, res) {
      try {
          
          const templates = await WebsiteTemplateSchema.find({}).lean();
          return res.status(200).json({ success: true, data: templates });
      } catch (err) {
          console.error("[fetchWebsiteTemplates] Error:", err);
          return res.status(500).json({ message: "Failed to fetch website templates", error: err.message });
      }
  }



/**
 * Create or update the global DashboardData config.
 * POST /admin/dashboard-data
 * Request body: { thoughtOfTheDay, sections }
 *    - thoughtOfTheDay: string
 *    - sections: array of { heading: string, desc: string }
 * If no row exists, create one. If exists, update the single document.
 */
async upsertDashboardData(req, res) {
    try {
        const { thoughtOfTheDay, sections } = req.body;

        const updateFields = {};
        if (typeof thoughtOfTheDay !== "undefined") updateFields.thoughtOfTheDay = thoughtOfTheDay;
        if (typeof sections !== "undefined") updateFields.sections = sections;

        // Only one dashboardData config in system
        console.log("[upsertDashboardData] updateFields:", updateFields);

        const config = await DashboardDataModel.findOne({});
        let result;
        if (config) {
            result = await DashboardDataModel.findOneAndUpdate({}, updateFields, { new: true });
            console.log("[upsertDashboardData] Updated existing DashboardData:", result);
        } else {
            result = await DashboardDataModel.create(updateFields);
            console.log("[upsertDashboardData] Created new DashboardData:", result);
        }
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("[upsertDashboardData] Error:", err);
        return res.status(500).json({ message: "Failed to upsert dashboard data", error: err.message });
    }
}

/**
 * Get the global DashboardData config for widgets (thoughtOfTheDay, sections)
 * GET /admin/dashboard-data
 * If not found, send sample data (sections as sample array)
 */
async fetchDashboardData(req, res) {
    try {
        const data = await DashboardDataModel.findOne({}).lean();
        console.log("[fetchDashboardData] Queried DashboardData:", data);

        if (!data) {
            // Sample data as fallback
            const sampleData = {
                thoughtOfTheDay: "Success is not the key to happiness. Happiness is the key to success.",
                sections: [
                    {
                        heading: "Welcome to Our Trusted Garage",
                        desc: "At our garage, excellence in vehicle maintenance and repair is our passion. With certified technicians and modern equipment, your car is always in the best hands."
                    },
                    {
                        heading: "User Privacy Assurance",
                        desc: "We are dedicated to protecting your privacy. All customer records and information are kept completely confidential as per our robust privacy policies."
                    },
                    {
                        heading: "Common Queries Answered",
                        desc: "1. How can I schedule a service appointment?\n2. Are original parts used for repairs?\n3. What is your warranty policy on repairs?"
                    },
                    {
                        heading: "Customer Care Documents",
                        desc: "Access your service history, insurance policies, and warranty certificates in this section for your convenience."
                    },
                    {
                        heading: "Repair and Service Disclaimer",
                        desc: "Services are performed per manufacturer recommendations. Actual results may vary based on vehicle usage and prior maintenance."
                    }
                ]
            };
    
            console.log("[fetchDashboardData] No DashboardData found. Sending sample data.");
            return res.status(200).json({ 
                success: true, 
                data: sampleData, 
                sample: true, 
                message: "DashboardData not found; providing sample data." 
            });
        }
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("[fetchDashboardData] Error:", err);
        return res.status(500).json({ message: "Failed to fetch dashboard data", error: err?.message || err.toString() });
    }
}

/**
 * Edit dashboard data fields.
 * PATCH /admin/dashboard-data
 * Fields to update provided in req.body (partial update supported)
 */
async editDashboardData(req, res) {
    try {
        const updateFields = {};
        const allowed = [
            "thoughtOfTheDay", "sections"
        ];
        for (const key of allowed) {
            if (typeof req.body[key] !== "undefined") {
                updateFields[key] = req.body[key];
            }
        }
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No valid fields provided to update" });
        }

        console.log("[editDashboardData] updateFields:", updateFields);

        const updated = await DashboardDataModel.findOneAndUpdate({}, updateFields, { new: true });
        if (!updated) {
            return res.status(404).json({ message: "DashboardData not found" });
        }
        console.log("[editDashboardData] Updated DashboardData:", updated);
        return res.status(200).json({ success: true, data: updated });
    } catch (err) {
        console.error("[editDashboardData] Error:", err);
        return res.status(500).json({ message: "Failed to edit dashboard data", error: err.message });
    }
}

/**
 * Delete the dashboard data record.
 * DELETE /admin/dashboard-data
 */
async deleteDashboardData(req, res) {
    try {
        const deleted = await DashboardDataModel.findOneAndDelete({});
        if (!deleted) {
            return res.status(404).json({ message: "DashboardData not found." });
        }
        console.log("[deleteDashboardData] Deleted DashboardData:", deleted);
        return res.status(200).json({ success: true, message: "DashboardData deleted." });
    } catch (err) {
        console.error("[deleteDashboardData] Error:", err);
        return res.status(500).json({ message: "Failed to delete dashboard data", error: err.message });
    }
}

// --- Car Company CRUD Operations ---


/**
 * Add a new car company with models and optional years, and optional brandLogo upload
 * POST /admin/car-company
 * Body: { companyName: string, models: [{ modelName: string, years?: [number] }] }
 * File: brandLogo (optional image upload via multipart/form-data)
 */
async addCarCompany(req, res) {
    let brandLogoPath = null;
    try {
        const { companyName, models } = req.body;

        // If form-data, models may come as string
        let parsedModels = models;
        if (typeof models === "string") {
            try {
                parsedModels = JSON.parse(models);
            } catch {
                return res.status(400).json({ message: "models must be a valid JSON array." });
            }
        }

        if (!companyName || !Array.isArray(parsedModels) || parsedModels.length === 0) {
            // Delete uploaded image if relevant
            if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
            return res.status(400).json({ message: "companyName and models are required." });
        }

        // Ensure models elements at least have modelName, years optional
        for (const model of parsedModels) {
            if (!model.modelName) {
                if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
                return res.status(400).json({ message: "Each model must have a modelName." });
            }
            // years is OPTIONAL, no need to check for it
        }

        // brandLogo from req.files
        if (req.files && req.files.brandLogo && req.files.brandLogo[0]) {
            brandLogoPath = req.files.brandLogo[0].path;
        }

        // Check for duplicate companyName
        const existing = await CarCompany.findOne({ companyName });
        if (existing) {
            if (brandLogoPath) deleteUploadedFile(brandLogoPath);
            return res.status(409).json({ message: "Car company already exists." });
        }

        const newCompany = new CarCompany({
            companyName,
            models: parsedModels,
            brandLogo: brandLogoPath || null
        });

        await newCompany.save();

        return res.status(201).json({ success: true, data: newCompany });

    } catch (err) {
        // Clean up uploaded image on error
        if (brandLogoPath) {
            deleteUploadedFile(brandLogoPath);
        }
        console.error("[addCarCompany] Error:", err);
        return res.status(500).json({ message: "Failed to add car company", error: err.message });
    }
}

/**
 * Edit a car company by ID, including optional update of brandLogo
 * PATCH /admin/car-company/:id
 * Body may include any subset of { companyName, models }
 * File: brandLogo (optional, replaces old if provided)
 */
async editCarCompany(req, res) {
    let brandLogoPath = null;
    try {
        const { id } = req.params;
        const { companyName, models } = req.body;

        // If form-data, models may come as string
        let parsedModels = models;
        if (typeof models === "string") {
            try {
                parsedModels = JSON.parse(models);
            } catch {
                if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
                return res.status(400).json({ message: "models must be a valid JSON array." });
            }
        }

        if (!companyName && !parsedModels && !req.files?.brandLogo) {
            if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
            return res.status(400).json({ message: "Nothing to update." });
        }

        // If models provided, ensure each model has a modelName, years are optional
        if (parsedModels) {
            for (const model of parsedModels) {
                if (!model.modelName) {
                    if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
                    return res.status(400).json({ message: "Each model must have a modelName." });
                }
                // years is OPTIONAL, no need to check for it
            }
        }

        const updateFields = {};
        if (companyName) updateFields.companyName = companyName;
        if (parsedModels) updateFields.models = parsedModels;

        // brandLogo from req.files (new logo uploaded)
        if (req.files && req.files.brandLogo && req.files.brandLogo[0]) {
            brandLogoPath = req.files.brandLogo[0].path;
            updateFields.brandLogo = brandLogoPath;
        }

        // Check for existing company and handle old logo delete if replacing with new
        let prevCompany = null;
        if (brandLogoPath) {
            prevCompany = await CarCompany.findById(id);
        }

        const updated = await CarCompany.findByIdAndUpdate(id, updateFields, { new: true });
        if (!updated) {
            if (brandLogoPath) deleteUploadedFile(brandLogoPath);
            return res.status(404).json({ message: "CarCompany not found." });
        }

        // Delete old logo if replaced by a new one
        if (brandLogoPath && prevCompany && prevCompany.brandLogo && prevCompany.brandLogo !== brandLogoPath) {
            deleteUploadedFile(prevCompany.brandLogo);
        }

        return res.status(200).json({ success: true, data: updated });
    } catch (err) {
        // Clean up uploaded image on error
        if (brandLogoPath) {
            deleteUploadedFile(brandLogoPath);
        }
        console.error("[editCarCompany] Error:", err);
        return res.status(500).json({ message: "Failed to edit car company", error: err.message });
    }
}


/**
 * Fetch all car companies, or filter by companyName if query provided
 * GET /admin/car-company?companyName=Honda
 */
async fetchCarCompanies(req, res) {
    try {
        const { companyName } = req.query;
        let companies;
        if (companyName) {
            companies = await CarCompany.find({ companyName: { $regex: companyName, $options: "i" } });
        } else {
            companies = await CarCompany.find({});
        }
        return res.status(200).json({ success: true, data: companies });
    } catch (err) {
        console.error("[fetchCarCompanies] Error:", err);
        return res.status(500).json({ message: "Failed to fetch car companies", error: err.message });
    }
}


/**
 * Delete a car company by ID
 * DELETE /admin/car-company/:id
 */
async deleteCarCompany(req, res) {
    try {
        const { id } = req.params;
        const deleted = await CarCompany.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ message: "CarCompany not found." });
        }
        return res.status(200).json({ success: true, message: "CarCompany deleted." });
    } catch (err) {
        console.error("[deleteCarCompany] Error:", err);
        return res.status(500).json({ message: "Failed to delete car company", error: err.message });
    }
}

/**
 * Get website page - list of Businesses with key info
 * GET /admin/business-list
 * Returns: [{ id, shopName, mobile, domainName, templateSelected, daysLeft, status }]
 */
async getWebsitePage(req, res) {
    try {
        // Fetch all businesses
        const businesses = await BusinessProfileModel.find({})
            .select(
                "_id businessName businessPhone domainName websiteTemplateId subscriptions isBusinessActive"
            )
            .populate({
                path: "websiteTemplateId",
                select: "name" // Assuming WebsiteTemplate has 'name' field (or adjust as needed)
            })
            .lean();

        const result = businesses.map(biz => {
            let daysLeft = null;
            let status = "Inactive";
            if (Array.isArray(biz.subscriptions) && biz.subscriptions.length > 0) {
                const sub = biz.subscriptions[0]; // Most recent/current at index 0
                // Calculate days left based on purchasedOn + days
                if (sub.purchasedOn && sub.days) {
                    const now = new Date();
                    const end = new Date(sub.purchasedOn);
                    end.setDate(end.getDate() + Number(sub.days));
                    // Count days only if still valid
                    if (now < end) {
                        daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
                        status = "Active";
                    } else {
                        daysLeft = 0;
                        status = "Expired";
                    }
                }
                if (sub.paymentStatus === "Pending") {
                    status = "Pending";
                } else if (sub.paymentStatus === "Failed") {
                    status = "Failed";
                }
            } else {
                daysLeft = 0;
                status = "No Subscription";
            }

            return {
                id: biz._id,
                shopName: biz.businessName,
                mobile: biz.businessPhone,
                domainName: biz.domainName || null,
                templateSelected: biz.websiteTemplateId
                    ? (biz.websiteTemplateId.name || biz.websiteTemplateId._id?.toString())
                    : null,
                daysLeft,
                status: biz.isBusinessActive ? status : "Inactive"
            };
        });

        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("[getWebsitePage] Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch business website page list",
            error: err.message,
        });
    }
}

// --- Cities CRUD Controller Methods ---



// @route   POST /admin/cities
// @desc    Create a new city
// @access  Admin
async addCity(req, res) {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: "City name is required" });
        }

        // Check if city with same name exists
        const existing = await City.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
        if (existing) {
            return res.status(409).json({ success: false, message: "City already exists" });
        }

        const city = new City({ name });
        await city.save();
        return res.status(201).json({ success: true, data: city });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to add city", error: err.message });
    }
}

// @route   GET /admin/cities
// @desc    Get list of all cities
// @access  Admin
async fetchCities(req, res) {
    try {
        const cities = await City.find({}).sort({ name: 1 });
        return res.status(200).json({ success: true, data: cities });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch cities", error: err.message });
    }
}

// @route   PATCH /admin/cities/:id
// @desc    Edit a city name by id
// @access  Admin
async editCity(req, res) {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: "City name is required" });
        }

        // Ensure no duplicate city name
        const duplicate = await City.findOne({ name: { $regex: `^${name}$`, $options: "i" }, _id: { $ne: id } });
        if (duplicate) {
            return res.status(409).json({ success: false, message: "Another city with this name already exists" });
        }

        const city = await City.findByIdAndUpdate(id, { name }, { new: true });
        if (!city) {
            return res.status(404).json({ success: false, message: "City not found" });
        }
        return res.status(200).json({ success: true, data: city });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to edit city", error: err.message });
    }
}

// @route   DELETE /admin/cities/:id
// @desc    Delete a city by id
// @access  Admin
async deleteCity(req, res) {
    try {
        const { id } = req.params;
        const city = await City.findByIdAndDelete(id);
        if (!city) {
            return res.status(404).json({ success: false, message: "City not found" });
        }
        return res.status(200).json({ success: true, message: "City deleted successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to delete city", error: err.message });
    }
}

// Ads CRUD for Admin



// @route   GET /admin/ads
// @desc    Get all ads
// @access  Admin
async getAllAds(req, res) {
    try {
        const ads = await adsSchema.find({}).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: ads });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch ads", error: err.message });
    }
}

// @route   POST /admin/ads
// @desc    Create a new ad
// @access  Admin
async createAd(req, res) {
    let imagePath;
    try {
        // Handle file from Multer. adsUpload.middleware puts file in req.files.adsImage[0]
        const { category, websiteURL } = req.body;
        if (!category || !req.files || !req.files.adsImage || !req.files.adsImage[0] || !websiteURL) {
            // Clean up uploaded file(s)
            deleteUploadedFiles(req.files);
            return res.status(400).json({ success: false, message: "All fields are required: category, adsImage, websiteURL" });
        }

        imagePath = req.files.adsImage[0].path;

        if (!['Deals', 'Ads', 'Calendor'].includes(category)) {
            deleteUploadedFiles(req.files);
            return res.status(400).json({ success: false, message: "Invalid category" });
        }

        const ad = new adsSchema({ category, imageUpload: imagePath, websiteURL });
        await ad.save();
        return res.status(201).json({ success: true, data: ad });
    } catch (err) {
        if (req.files) {
            deleteUploadedFiles(req.files); // Clean up uploaded file(s) on error
        }
        return res.status(500).json({ success: false, message: "Failed to create ad", error: err.message });
    }
}

// @route   PATCH /admin/ads/:id
// @desc    Edit an ad by id
// @access  Admin
async editAd(req, res) {
    let oldAd;
    let newImagePath;
    try {
        const { id } = req.params;

        // Find current ad document to handle old image if updating image
        oldAd = await adsSchema.findById(id);
        if (!oldAd) {
            // Clean up any new uploaded file
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ success: false, message: "Ad not found" });
        }

        const allowed = ["category", "websiteURL"];
        const update = {};

        allowed.forEach(field => {
            if (req.body[field]) update[field] = req.body[field];
        });

        // New image upload? (adsImage field)
        if (req.files && req.files.adsImage && req.files.adsImage[0]) {
            newImagePath = req.files.adsImage[0].path;
            update.imageUpload = newImagePath;
        }

        if (update.category && !['Deals', 'Ads', 'Calendor'].includes(update.category)) {
            // Clean up new uploaded image
            if (newImagePath) deleteUploadedFiles(newImagePath);
            return res.status(400).json({ success: false, message: "Invalid category" });
        }

        const ad = await adsSchema.findByIdAndUpdate(id, update, { new: true });
        if (!ad) {
            if (newImagePath) deleteUploadedFiles(newImagePath);
            return res.status(404).json({ success: false, message: "Ad not found" });
        }

        // If uploaded a new image and there's an old image, delete the old one
        if (newImagePath && oldAd.imageUpload && oldAd.imageUpload !== newImagePath) {
            deleteUploadedFiles(oldAd.imageUpload);
        }
        return res.status(200).json({ success: true, data: ad });
    } catch (err) {
        // If there was a new uploaded file, try to clean up
        if (req.files) deleteUploadedFiles(req.files);
        return res.status(500).json({ success: false, message: "Failed to edit ad", error: err.message });
    }
}

// @route   DELETE /admin/ads/:id
// @desc    Delete an ad by id
// @access  Admin
async deleteAd(req, res) {
    try {
        const { id } = req.params;
        const ad = await adsSchema.findByIdAndDelete(id);
        if (!ad) {
            return res.status(404).json({ success: false, message: "Ad not found" });
        }
        // Delete ad image file from storage
        if (ad.imageUpload) {
            deleteUploadedFiles(ad.imageUpload);
        }
        return res.status(200).json({ success: true, message: "Ad deleted successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to delete ad", error: err.message });
    }
}


// @route   GET /admin/deals/running
// @desc    Get all currently running deals (whose offerEndsOnDate is in the future)
// @access  Admin
async getAllRunningDeals(req, res) {
    try {
        const today = new Date();

        // Populate createdBy with relevant BusinessProfile fields, and populate selectedVehicle.id with CarCompany if present
        const runningDeals = await DealModel.find({
            offerEndsOnDate: { $gte: today }
        })
        .sort({ offerEndsOnDate: 1 })
        .populate('serviceId')
        .populate({
            path: 'createdBy',
            model: 'BusinessProfile',
            select: 'businessName businessEmail', // These exist in business-profile.js
        })
        .populate({
            path: 'selectedVehicle.id',
            model: 'CarCompany', // This matches car-company-schema.js
            select: 'companyName models',
        });

console.log(runningDeals);
        return res.status(200).json({
            success: true,
            data: runningDeals
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch running deals",
            error: err.message,
        });
    }
}







}

export default AdminController;

