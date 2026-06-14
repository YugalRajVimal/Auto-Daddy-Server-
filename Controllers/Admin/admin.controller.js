import mongoose from "mongoose";
import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import adsSchema from "../../Schema/ads.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import CarCompany from "../../Schema/car-company-schema.js";
import Province from "../../Schema/cities.schema.js";
import City from "../../Schema/cities.schema.js";
import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import InviteHelpSchema from "../../Schema/InviteHelp.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";
import WebsiteTemplateSchema from "../../Schema/WebsiteTemplateSchema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";


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
    const { name, status, subServices } = req.body;
    // Ensure subServices contains only name and status fields for each subService (no dups allowed)
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
      name, 
      status, 
      subServices: formattedSubServices
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
    const { name, status, subServices } = req.body;

    // Fetch existing service to check existence
    const existingService = await Services.findById(id);
    if (!existingService) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    // Prepare update fields: only name, status, subServices
    const updateFields = { name, status };
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
        onboardedBy: 1,
        status:1,
        city:1,
        createdAt:1
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




// =================== Province CRUD ===================

// @route   POST /admin/provinces
// @desc    Create a new province
// @access  Admin
async addProvince(req, res) {
    try {
        const { name, nickName = "", status = "Active" } = req.body;
        if (!name) {
            console.log("[addProvince] Province name missing in request body");
            return res.status(400).json({ success: false, message: "Province name is required" });
        }

        // Check if province with same name exists (case-insensitive)
        const existing = await Province.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
        if (existing) {
            console.log(`[addProvince] Province with name "${name}" already exists`);
            return res.status(409).json({ success: false, message: "Province already exists" });
        }

        const province = new Province({ name, nickName, status, cities: [] });
        await province.save();
        console.log(`[addProvince] Province "${name}" created successfully`);
        return res.status(201).json({ success: true, data: province });
    } catch (err) {
        console.log("[addProvince] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to add province", error: err.message });
    }
}

// @route   GET /admin/provinces
// @desc    Get list of all provinces (with cities)
// @access  Admin
async fetchProvinces(req, res) {
    try {
        const provinces = await Province.find({}).sort({ name: 1 });
        console.log(`[fetchProvinces] Fetched ${provinces.length} provinces`);
        return res.status(200).json({ success: true, data: provinces });
    } catch (err) {
        console.log("[fetchProvinces] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch provinces", error: err.message });
    }
}

// @route   PATCH /admin/provinces/:provinceId
// @desc    Edit a province (name, nickName, status) by ID
// @access  Admin
async editProvince(req, res) {
    try {
        const { provinceId } = req.params;
        const { name, nickName, status } = req.body;
        if (!name) {
            console.log("[editProvince] Province name missing in request body");
            return res.status(400).json({ success: false, message: "Province name is required" });
        }
        // Check for another province with this name
        const duplicate = await Province.findOne({ 
            name: { $regex: `^${name}$`, $options: "i" },
            _id: { $ne: provinceId }
        });
        if (duplicate) {
            console.log(`[editProvince] Duplicate province name "${name}" found under different ID`);
            return res.status(409).json({ success: false, message: "Another province with this name already exists" });
        }
        const updateFields = { name };
        if (typeof nickName === "string") updateFields.nickName = nickName;
        if (status && ['Active', 'Inactive'].includes(status)) updateFields.status = status;
        const province = await Province.findByIdAndUpdate(provinceId, updateFields, { new: true });
        if (!province) {
            console.log(`[editProvince] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        console.log(`[editProvince] Province "${provinceId}" updated`);
        return res.status(200).json({ success: true, data: province });
    } catch (err) {
        console.log("[editProvince] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to edit province", error: err.message });
    }
}

// @route   DELETE /admin/provinces/:provinceId
// @desc    Delete a province by ID
// @access  Admin
async deleteProvince(req, res) {
    try {
        const { provinceId } = req.params;
        const province = await Province.findByIdAndDelete(provinceId);
        if (!province) {
            console.log(`[deleteProvince] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        console.log(`[deleteProvince] Province with ID ${provinceId} deleted`);
        return res.status(200).json({ success: true, message: "Province deleted successfully" });
    } catch (err) {
        console.log("[deleteProvince] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete province", error: err.message });
    }
}

// =================== Cities within Province ===================

// @route   POST /admin/provinces/:provinceId/cities
// @desc    Add city to province
// @access  Admin
async addCity(req, res) {
    try {
        const { provinceId } = req.params;
        const { name, status = "Active" } = req.body;
        if (!name) {
            console.log("[addCity] City name missing in request body");
            return res.status(400).json({ success: false, message: "City name is required" });
        }
        if (status && !["Active", "Inactive"].includes(status)) {
            console.log("[addCity] Invalid status for city");
            return res.status(400).json({ success: false, message: "Invalid status for city" });
        }
        const province = await Province.findById(provinceId);
        if (!province) {
            console.log(`[addCity] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        // Check for duplicate city in province (case-insensitive)
        const duplicate = province.cities.find(
            c => c.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (duplicate) {
            console.log(`[addCity] City "${name}" already exists in province "${provinceId}"`);
            return res.status(409).json({ success: false, message: "City already exists in this province" });
        }
        province.cities.push({ name: name.trim(), status });
        await province.save();
        console.log(`[addCity] City "${name}" added to province "${provinceId}"`);
        return res.status(201).json({ success: true, data: province.cities });
    } catch (err) {
        console.log("[addCity] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to add city", error: err.message });
    }
}

// @route   PATCH /admin/provinces/:provinceId/cities/:cityName
// @desc    Edit a city (name, status) by city name (case-insensitive) in province
// @access  Admin
async editCity(req, res) {
    try {
        const { provinceId, cityName } = req.params;
        const { name, status } = req.body;
        if (!name && !status) {
            console.log("[editCity] City name/status missing in request body");
            return res.status(400).json({ success: false, message: "City name or status is required" });
        }
        if (status && !["Active", "Inactive"].includes(status)) {
            console.log("[editCity] Invalid status for city");
            return res.status(400).json({ success: false, message: "Invalid status for city" });
        }
        const province = await Province.findById(provinceId);
        if (!province) {
            console.log(`[editCity] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        // Ensure no duplicate city name with new value (if a new name is provided)
        if (name) {
            const duplicate = province.cities.find(
                city => city.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            // Only treat as duplicate if the duplicate is NOT the current city we're editing
            if (duplicate && cityName.trim().toLowerCase() !== name.trim().toLowerCase()) {
                console.log(`[editCity] Another city with name "${name}" exists in province "${provinceId}"`);
                return res.status(409).json({ success: false, message: "Another city with this name already exists in this province" });
            }
        }
        // Find the city to update
        let updated = false;
        for (let city of province.cities) {
            if (city.name.trim().toLowerCase() === cityName.trim().toLowerCase()) {
                if (name) city.name = name.trim();
                if (status) city.status = status;
                updated = true;
                break;
            }
        }
        if (!updated) {
            console.log(`[editCity] City "${cityName}" not found in province "${provinceId}"`);
            return res.status(404).json({ success: false, message: "City not found in this province" });
        }
        await province.save();
        console.log(`[editCity] City "${cityName}" edited in province "${provinceId}"`);
        return res.status(200).json({ success: true, data: province.cities });
    } catch (err) {
        console.log("[editCity] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to edit city", error: err.message });
    }
}

// @route   DELETE /admin/provinces/:provinceId/cities/:cityName
// @desc    Delete a city by name from province (case-insensitive)
// @access  Admin
async deleteCity(req, res) {
    try {
        const { provinceId, cityName } = req.params;
        const province = await Province.findById(provinceId);
        if (!province) {
            console.log(`[deleteCity] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        const initialLength = province.cities.length;
        province.cities = province.cities.filter(
            city => city.name.trim().toLowerCase() !== cityName.trim().toLowerCase()
        );
        if (province.cities.length === initialLength) {
            console.log(`[deleteCity] City "${cityName}" not found in province "${provinceId}"`);
            return res.status(404).json({ success: false, message: "City not found in this province" });
        }
        await province.save();
        console.log(`[deleteCity] City "${cityName}" deleted from province "${provinceId}"`);
        return res.status(200).json({ success: true, message: "City deleted successfully", data: province.cities });
    } catch (err) {
        console.log("[deleteCity] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete city", error: err.message });
    }
}

// Ads CRUD for Admin



// ----------- BUSINESS PROFILE ADS CRUD (Business-specific ads) -----------

// Required imports


// Utility to locate a business profile by ID/criteria (if needed for admin-side search)
 findBusinessProfile = async (id) => {
    return await BusinessProfileModel.findById(id);
};

// Helper to validate ad input fields
 validateAdInputs = (category, websiteURL, adsImage) => {
    if (!category || !websiteURL || !adsImage) return "All fields are required: category, adsImage, websiteURL";
    if (!['Deals', 'Ads', 'Calendor'].includes(category)) return "Invalid category";
    return null;
};




async getAllBusinessAds(req, res) {
  try {
    const { businessId } = req.params;

    // populate('ads') resolves ObjectId refs into full Ads documents
    const business = await BusinessProfileModel.findById(businessId).populate("ads");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business Profile not found" });
    }

    return res.status(200).json({ success: true, data: business.ads || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch ads", error: err.message });
  }
}

// Admin: Create (add) a new ad to a business profile
// @route   POST /admin/business-profiles/:businessId/ads
// @access  Admin
async createBusinessAd(req, res) {
  try {
    const { businessId } = req.params;
    const { category, websiteURL } = req.body;

    // Validate image upload
    if (!req.files?.adsImage?.[0]) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: "adsImage is required" });
    }
    const imagePath = req.files.adsImage[0].path;

    // Validate required fields
    if (!category || !websiteURL) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: "category and websiteURL are required" });
    }
    if (!["Deals", "Ads", "Calendor"].includes(category)) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      deleteUploadedFiles(req.files);
      return res.status(404).json({ success: false, message: "Business Profile not found" });
    }

    // 1. Create the Ads document in its own collection
    const newAd = await adsSchema.create({
      category,
      imageUpload: imagePath,
      websiteURL,
    });

    // 2. Push the new ObjectId reference to business.ads (most recent first)
    business.ads.unshift(newAd._id);
    await business.save();

    return res.status(201).json({ success: true, data: newAd });
  } catch (err) {
    if (req.files) deleteUploadedFiles(req.files);
    return res.status(500).json({ success: false, message: "Failed to create ad", error: err.message });
  }
}

// Admin: Edit/update an ad in a business profile
// @route   PATCH /admin/business-profiles/:businessId/ads/:adId
// @access  Admin
async editBusinessAd(req, res) {
  try {
    const { businessId, adId } = req.params;

    // Verify business exists
    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      if (req.files) deleteUploadedFiles(req.files);
      return res.status(404).json({ success: false, message: "Business Profile not found" });
    }

    // Verify this ad belongs to this business
    const adBelongsToBusiness = business.ads.some((id) => id.toString() === adId);
    if (!adBelongsToBusiness) {
      if (req.files) deleteUploadedFiles(req.files);
      return res.status(404).json({ success: false, message: "Ad not found in this business" });
    }

    // Fetch the actual Ads document
    const ad = await adsSchema.findById(adId);
    if (!ad) {
      if (req.files) deleteUploadedFiles(req.files);
      return res.status(404).json({ success: false, message: "Ad document not found" });
    }

    // Validate category if being updated
    if (req.body.category) {
      if (!["Deals", "Ads", "Calendor"].includes(req.body.category)) {
        if (req.files) deleteUploadedFiles(req.files);
        return res.status(400).json({ success: false, message: "Invalid category" });
      }
      ad.category = req.body.category;
    }
    if (req.body.websiteURL) ad.websiteURL = req.body.websiteURL;

    // Handle optional image replacement
    const oldImagePath = ad.imageUpload;
    let newImagePath = null;
    if (req.files?.adsImage?.[0]) {
      newImagePath = req.files.adsImage[0].path;
      ad.imageUpload = newImagePath;
    }

    await ad.save();

    // Delete old image only after successful save
    if (newImagePath && oldImagePath && oldImagePath !== newImagePath) {
      deleteUploadedFiles(oldImagePath);
    }

    return res.status(200).json({ success: true, data: ad });
  } catch (err) {
    if (req.files) deleteUploadedFiles(req.files);
    return res.status(500).json({ success: false, message: "Failed to edit ad", error: err.message });
  }
}

// Admin: Delete an ad from a business profile
// @route   DELETE /admin/business-profiles/:businessId/ads/:adId
// @access  Admin
async deleteBusinessAd(req, res) {
  try {
    const { businessId, adId } = req.params;

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business Profile not found" });
    }

    const adIndex = business.ads.findIndex((id) => id.toString() === adId);
    if (adIndex === -1) {
      return res.status(404).json({ success: false, message: "Ad not found in this business" });
    }

    // 1. Remove the ObjectId reference from business.ads
    business.ads.splice(adIndex, 1);
    await business.save();

    // 2. Delete the Ads document and its image
    const deletedAd = await adsSchema.findByIdAndDelete(adId);
    if (deletedAd?.imageUpload) {
      deleteUploadedFiles(deletedAd.imageUpload);
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

// @route   GET /admin/job-cards/payments
// @desc    Get job card payment details with optional filtering & search
// @access  Admin
async getAllPaymentDetailsOfAllJobCards(req, res) {
    try {
        // Query filters from querystring
        const {
            paymentStatus,
            paymentMethod,
            fromDate,
            toDate,
            business,
            customerId,
            vehicleId,
            dealCode,
            search,
            unpaid
        } = req.query;

        // Construct filter object
        const filter = {};

        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }
        if (paymentMethod) {
            filter.paymentMethod = paymentMethod;
        }
        if (typeof unpaid !== 'undefined') {
            filter.unpaid = unpaid === 'true'; // expects "true" or "false"
        }
        if (business) {
            filter.business = business;
        }
        if (customerId) {
            filter.customerId = customerId;
        }
        if (vehicleId) {
            filter.vehicleId = vehicleId;
        }
        if (dealCode) {
            filter['dealApplied.dealCode'] = dealCode;
        }
        // Date filter
        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) {
                filter.createdAt.$gte = new Date(fromDate);
            }
            if (toDate) {
                filter.createdAt.$lte = new Date(toDate);
            }
        }

        // Populate according to @vehicles.schema.js (1-24)
        let aggregatePipeline = [
            { $match: filter },
            // Populate business, customerId, vehicleId for search and select
            {
                $lookup: {
                    from: 'businessprofiles',
                    localField: 'business',
                    foreignField: '_id',
                    as: 'businessDetails'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customerId',
                    foreignField: '_id',
                    as: 'customerDetails'
                }
            },
            {
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicleId',
                    foreignField: '_id',
                    as: 'vehicleDetails'
                }
            },
            {
                $unwind: { path: "$businessDetails", preserveNullAndEmptyArrays: true }
            },
            {
                $unwind: { path: "$customerDetails", preserveNullAndEmptyArrays: true }
            },
            {
                $unwind: { path: "$vehicleDetails", preserveNullAndEmptyArrays: true }
            },
        ];

        if (search && typeof search === "string" && search.trim().length > 0) {
            const pattern = new RegExp(search.trim(), "i");
            aggregatePipeline.push({
                $match: {
                    $or: [
                        { jobNo: pattern },
                        { "customerDetails.name": pattern },
                        { "customerDetails.email": pattern },
                        { "customerDetails.phone": pattern },
                        // Main vehicle fields from new schema
                        { "vehicleDetails.licensePlateNo": pattern },
                        { "vehicleDetails.vinNo": pattern },
                        { "vehicleDetails.make.name": pattern },
                        { "vehicleDetails.make.model": pattern },
                        { "vehicleDetails.year": pattern },
                        // Legacy fallback fields
                        { "vehicleDetails.registrationNumber": pattern },
                        { "vehicleDetails.model": pattern },
                        { "businessDetails.businessName": pattern }
                    ]
                }
            });
        }

        // Project out all required vehicle fields from @vehicles.schema.js (1-24)
        aggregatePipeline.push({
            $project: {
                paymentStatus: 1,
                paymentMethod: 1,
                totalPayableAmount: 1,
                dealApplied: 1,
                unpaid: 1,
                customer: {
                    _id: "$customerDetails._id",
                    name: "$customerDetails.name",
                    email: "$customerDetails.email",
                    phone: "$customerDetails.phone",
                },
                vehicle: {
                    _id: "$vehicleDetails._id",
                    licensePlateNo: "$vehicleDetails.licensePlateNo",
                    vinNo: "$vehicleDetails.vinNo",
                    make: {
                        name: "$vehicleDetails.make.name",
                        model: "$vehicleDetails.make.model"
                    },
                    year: "$vehicleDetails.year",
                    odometerReading: "$vehicleDetails.odometerReading",
                    dueOdometerReading: "$vehicleDetails.dueOdometerReading",
                    vehicleImage: "$vehicleDetails.vehicleImage",
                    disabled: "$vehicleDetails.disabled",
                    // legacy fallback fields for migration/compat
                    registrationNumber: "$vehicleDetails.registrationNumber",
                    model: "$vehicleDetails.model"
                },
                business: {
                    _id: "$businessDetails._id",
                    businessName: "$businessDetails.businessName",
                    businessEmail: "$businessDetails.businessEmail",
                },
                jobNo: 1,
                createdAt: 1,
                updatedAt: 1,
            }
        });

        // Pagination
        let { page = 1, limit = 20 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;
        aggregatePipeline.push({ $sort: { createdAt: -1 } });
        aggregatePipeline.push({ $skip: skip });
        aggregatePipeline.push({ $limit: limit });

        const data = await JobCard.aggregate(aggregatePipeline);

        // Count total for pagination
        let countPipeline = aggregatePipeline.slice(0, aggregatePipeline.findIndex(x => x.$project));
        countPipeline.push({ $count: "totalDocs" });
        const totalArr = await JobCard.aggregate(countPipeline);
        const totalDocs = totalArr[0]?.totalDocs || 0;

        return res.status(200).json({
            success: true,
            total: totalDocs,
            page,
            limit,
            data
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to get payment details of job cards",
            error: err.message,
        });
    }
}

async sendCustomNotificationToUser(req, res) {
    try {
        const { userType, userIds, title, message } = req.body;
        console.log("sendCustomNotificationToUser req.body:", req.body);

        // Validation
        if (!userType || !Array.isArray(userIds) || !userIds.length || !title || !message) {
            return res.status(400).json({
                success: false,
                message: "userType, userIds (array), title, and message are required in the request body."
            });
        }

        let UserModel, firebaseAdmin;
        try {
            UserModel = (await import("../../Schema/user.schema.js")).User;
            firebaseAdmin = (await import("../../config/firebase.js")).default;
        } catch (e) {
            console.error("[sendCustomNotificationToUser] Error loading dependencies:", e);
            return res.status(500).json({
                success: false,
                message: "Server error loading dependencies."
            });
        }

        // Find users by IDs and userType (role)
        const users = await UserModel.find({
            _id: { $in: userIds },
            ...(userType ? { role: userType.toLowerCase() } : {})
        }).lean();

        if (!users.length) {
            return res.status(404).json({
                success: false,
                message: "No users found for the given userIds and userType."
            });
        }

        const results = [];
        let atLeastOneSuccess = false;

        for (const user of users) {
            if (!user.fcmToken) {
                results.push({
                    userId: user._id,
                    success: false,
                    message: "User does not have an FCM token for notifications."
                });
                continue;
            }

            const fcmMessage = {
                notification: {
                    title: String(title),
                    body: String(message)
                },
                token: user.fcmToken
            };

            try {
                const fcmResult = await firebaseAdmin.messaging().send(fcmMessage);
                console.log(`[sendCustomNotificationToUser] FCM notification sent to user (${user._id}) with fcmToken (${user.fcmToken}):`, fcmMessage);
                results.push({
                    userId: user._id,
                    success: true,
                    fcmResult
                });
                atLeastOneSuccess = true;
            } catch (fcmErr) {
                console.error("[sendCustomNotificationToUser] Failed to send FCM notification:", fcmErr);
                results.push({
                    userId: user._id,
                    success: false,
                    message: "Failed to send FCM notification",
                    error: fcmErr.message
                });
            }
        }

        if (atLeastOneSuccess) {
            return res.status(200).json({
                success: true,
                message: "Notification(s) sent.",
                results
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "Failed to send notifications to all users.",
                results
            });
        }
    } catch (err) {
        console.error("[sendCustomNotificationToUser] Unexpected error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}


/**
 * Get all InviteHelp documents sent to Admin, populate user (User) and its businessProfile (BusinessProfile)
 * Optional: filter by query parameters if needed (e.g., serviceId)
 */

 async  getInviteHelpToAdmin(req, res) {
    try {
        // Optionally, you can support filtering by serviceId, etc.
        const filter = { to: "Admin" };
        if (req.query.serviceId) {
            filter.serviceId = req.query.serviceId;
        }
        // Get all InviteHelp entries sent to Admin and populate user and their businessProfile
        const invites = await InviteHelpSchema.find(filter)
            .populate({
                path: "userId",
                model: User,
                select: "name email", // Only get name and email from User
                populate: {
                    path: "businessProfile",
                    model: BusinessProfileModel,
                    select: "businessName businessEmail" // Only get businessName and businessEmail from BusinessProfile
                }
            })
       
            .sort({ createdAt: -1 }); // Sort latest first

        return res.status(200).json({
            success: true,
            data: invites,
        });
    } catch (error) {
        console.error("[getInviteHelpToAdmin] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching InviteHelp requests sent to admin.",
            error: error.message
        });
    }
}

onboardCarOwner = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Cleanup all uploaded files on failure
  const cleanupUploads = async () => {
    const profilePhoto = req.files?.["profilePhoto"]?.[0]?.path;
    if (profilePhoto) await deleteUploadedFile(profilePhoto);

    // Clean up all carImage_i files
    for (let i = 0; i < 5; i++) {
      const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
      if (imgPath) await deleteUploadedFile(imgPath);
    }
  };

  try {
    const { name, email, phone, countryCode, pincode, role, address, vehicles } = req.body;

    let vehiclesArray = vehicles;
    if (typeof vehicles === "string") {
      try { vehiclesArray = JSON.parse(vehicles); }
      catch (e) { vehiclesArray = undefined; }
    }

    // ── Validation ──────────────────────────────────────────────────────────
    if (!name || !email || !phone || !countryCode || !pincode || !role || !address) {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "All owner fields (name, email, phone, countryCode, pincode, role, address) are required.",
      });
    }

    const allowedCountryCodes = ["+1", "+61", "+44", "+91"];
    if (!allowedCountryCodes.includes(countryCode)) {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Invalid country code. Allowed: +1, +61, +44, +91.",
      });
    }

    if (role !== "carowner") {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Only role 'carowner' is allowed for onboarding via this endpoint.",
      });
    }

    if (email) {
      const existingEmailUser = await User.findOne({ email }).session(session);
      if (existingEmailUser) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          message: "A user with this email already exists.",
          userId: existingEmailUser._id,
        });
      }
    }

    if (phone && countryCode) {
      const existingPhoneUser = await User.findOne({ phone, countryCode }).session(session);
      if (existingPhoneUser) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          message: "A user with this phone and country code already exists.",
          userId: existingPhoneUser._id,
          phone: existingPhoneUser.phone,
          countryCode: existingPhoneUser.countryCode,
          name: existingPhoneUser.name,
          email: existingPhoneUser.email,
        });
      }
    }

    // ── Create User ──────────────────────────────────────────────────────────
    // const otp = "000000";
    // const otpExpiresAt = new Date(Date.now() + 1000 * 600);
    const profilePhotoPath = req.files?.["profilePhoto"]?.[0]?.path || null;
    const onboardedBy = req.user?.id || null;

    const carOwnerPayload = {
      name, email, phone, countryCode, pincode, role, address,
      isProfileComplete: true, otpAttempts: 0,
      onboardedBy,
      ...(profilePhotoPath ? { profilePhoto: profilePhotoPath } : {}),
    };

    let newCarOwner;
    try {
      [newCarOwner] = await User.create([carOwnerPayload], { session });
    } catch (err) {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: "Failed to create car owner profile." });
    }

    // ── Process Vehicles ─────────────────────────────────────────────────────
    const newVehicles = [];

    async function isDuplicateNotDisabledPlate(licensePlateNo) {
      if (!licensePlateNo) return false;
      return !!(await VehicleModel.findOne({
        licensePlateNo,
        $or: [{ disabled: false }, { disabled: { $exists: false } }],
      }).session(session));
    }

    const inputVehiclesArray = Array.isArray(vehiclesArray)
      ? vehiclesArray
      : (req.body.licensePlateNo || req.body.vinNo || req.body.vehicleName
        ? [{
            licensePlateNo:  req.body.licensePlateNo,
            vinNo:           req.body.vinNo,
            vehicleName:     req.body.vehicleName,
            model:           req.body.model,
            year:            req.body.year,
            odometerReading: req.body.odometerReading,
            disabled:        req.body.disabled,
          }]
        : []);

    for (let i = 0; i < inputVehiclesArray.length; i++) {
      const veh = inputVehiclesArray[i] || {};
      const { licensePlateNo, vinNo, vehicleName, model, year, odometerReading, disabled } = veh;

      const vehiclePayload = {};
      if (licensePlateNo  !== undefined) vehiclePayload.licensePlateNo  = licensePlateNo;
      if (vinNo           !== undefined) vehiclePayload.vinNo           = vinNo;
      if (vehicleName     !== undefined) vehiclePayload.make            = { ...(vehiclePayload.make || {}), name: vehicleName };
      if (model           !== undefined) vehiclePayload.make            = { ...(vehiclePayload.make || {}), model };
      if (year            !== undefined) vehiclePayload.year            = year;
      if (odometerReading !== undefined) vehiclePayload.odometerReading = odometerReading;
      if (disabled        !== undefined) vehiclePayload.disabled        = disabled;

      // ✅ Pick carImage for THIS vehicle index: carImage_0, carImage_1, etc.
      const vehicleImagePath = req.files?.[`carImage_${i}`]?.[0]?.path || null;
      if (vehicleImagePath) {
        vehiclePayload.carImages = [vehicleImagePath];
      }

      const hasAllRequired =
        vehiclePayload.licensePlateNo &&
        vehiclePayload.vinNo &&
        vehiclePayload.make?.name &&
        vehiclePayload.make?.model &&
        vehiclePayload.year;

      if (!hasAllRequired) continue;

      if (!vehiclePayload.disabled) {
        const plateExists = await isDuplicateNotDisabledPlate(vehiclePayload.licensePlateNo);
        if (plateExists) {
          await cleanupUploads();
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            message: `A vehicle with license plate "${vehiclePayload.licensePlateNo}" already exists and is not disabled.`,
            licensePlateNo: vehiclePayload.licensePlateNo,
          });
        }
      }

      try {
        const [createdVehicle] = await VehicleModel.create([vehiclePayload], { session });

        newCarOwner.myVehicles.push(createdVehicle._id);

        // ✅ Save vehicleId + carImage into User.documents for this vehicle
        const vehicleDoc = { vehicleId: createdVehicle._id };
        if (vehicleImagePath) vehicleDoc.carImage = vehicleImagePath;
        newCarOwner.documents.push(vehicleDoc);

        newVehicles.push(createdVehicle);
      } catch (err) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: "Failed to create vehicle." });
      }
    }

    if (newVehicles.length > 0) {
      try {
        await newCarOwner.save({ session });
      } catch (saveErr) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: "Failed to update car owner with vehicles." });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Car owner onboarded successfully.",
      carOwner: {
        id:                newCarOwner._id,
        name:              newCarOwner.name,
        email:             newCarOwner.email,
        phone:             newCarOwner.phone,
        countryCode:       newCarOwner.countryCode,
        pincode:           newCarOwner.pincode,
        role:              newCarOwner.role,
        address:           newCarOwner.address,
        isProfileComplete: newCarOwner.isProfileComplete,
        status:            newCarOwner.status,
        onboardedBy:       newCarOwner.onboardedBy,
        profilePhoto:      newCarOwner.profilePhoto,
        documents:         newCarOwner.documents, // vehicleId + carImage per vehicle
        vehicles: newVehicles.map(v => ({
          id:              v._id,
          licensePlateNo:  v.licensePlateNo,
          vinNo:           v.vinNo,
          name:            v.make?.name,
          model:           v.make?.model,
          year:            v.year,
          odometerReading: v.odometerReading,
          carImages:       v.carImages,
        })),
      },
    });

  } catch (error) {
    await cleanupUploads();
    try { await session.abortTransaction(); } catch (_) {}
    session.endSession();
    console.error("[onboardCarOwner] Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

editCustomer = async (req, res) => {
  try {
    const autoshopOwnerId = req.user?.id;
    const { carOwnerId } = req.body;

    // ── Cleanup helper ───────────────────────────────────────────────────────
    const cleanupUploads = async () => {
      if (req.files?.["profilePhoto"]?.[0]?.path) {
        await deleteUploadedFile(req.files["profilePhoto"][0].path);
      }
      for (let i = 0; i < 5; i++) {
        const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
        if (imgPath) await deleteUploadedFile(imgPath);
      }
    };

    // Parse vehicles JSON string if needed
    let vehiclesFromBody = req.body.vehicles;
    if (typeof vehiclesFromBody === "string") {
      try { vehiclesFromBody = JSON.parse(vehiclesFromBody); }
      catch (e) { vehiclesFromBody = undefined; }
    }


    if (!carOwnerId) {
      await cleanupUploads();
      return res.status(400).json({ message: "carOwnerId is required." });
    }



    // ── Fetch customer ───────────────────────────────────────────────────────
    // Use lean: false so we can mutate documents array below
    const customer = await User.findOne({ _id: carOwnerId, role: "carowner" });
    if (!customer) {
      await cleanupUploads();
      return res.status(404).json({ message: "Car owner not found." });
    }

    const existingVehicleIds = Array.isArray(customer.myVehicles)
      ? customer.myVehicles.map(id => id.toString())
      : [];

    // ── Build user update fields ─────────────────────────────────────────────
    const allowedUserFields = [
      "name", "email", "phone", "countryCode", "pincode", "address",
      "city", "isDisabled", "isProfileComplete", "favoriteAutoShops",
    ];
    let updateFields = {};
    for (const field of allowedUserFields) {
      if (field in req.body && req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    }

    // Profile photo upload
    const newProfilePhoto = req.files?.["profilePhoto"]?.[0]?.path;
    if (newProfilePhoto) {
      updateFields.profilePhoto = newProfilePhoto;
    }

    // ── Process vehicles ─────────────────────────────────────────────────────
    let updatedVehicleObjectIds = [...existingVehicleIds]; // preserve existing

    if (Array.isArray(vehiclesFromBody)) {
      for (let i = 0; i < vehiclesFromBody.length; i++) {
        const v = vehiclesFromBody[i];

        // ✅ carImage for this specific vehicle via carImage_0, carImage_1, etc.
        const vehicleImagePath = req.files?.[`carImage_${i}`]?.[0]?.path || null;

        // ── EDIT EXISTING VEHICLE ────────────────────────────────────────────
        if (v.vId && mongoose.Types.ObjectId.isValid(v.vId)) {
          const vehId = v.vId.toString();
          if (!existingVehicleIds.includes(vehId)) {
            await cleanupUploads();
            return res.status(400).json({
              message: `Invalid vehicle id (${vehId}) for this customer.`,
            });
          }

          const allowedVehicleFields = [
            "licensePlateNo", "licensePlateFrontImagePath", "licensePlateBackImagePath",
            "carOwnershipCertificate", "insuranceCertificate", "vinNo", "year",
            "odometerReading", "disabled",
          ];
          let vehicleUpdateFields = {};
          for (const field of allowedVehicleFields) {
            if (v[field] !== undefined) vehicleUpdateFields[field] = v[field];
          }
          if (v.vehicleName !== undefined) vehicleUpdateFields["make.name"] = v.vehicleName;
          if (v.model !== undefined) vehicleUpdateFields["make.model"] = v.model;

          // Handle carImages (uploaded file takes priority, then body value)
          if (vehicleImagePath) {
            vehicleUpdateFields.carImages = [vehicleImagePath];
          } else if (typeof v.carImages === "string") {
            try {
              const imgs = JSON.parse(v.carImages);
              if (Array.isArray(imgs)) vehicleUpdateFields.carImages = imgs;
            } catch (e) {}
          } else if (Array.isArray(v.carImages)) {
            vehicleUpdateFields.carImages = v.carImages;
          }

          try {
            if (Object.keys(vehicleUpdateFields).length > 0) {
              await VehicleModel.findOneAndUpdate(
                { _id: vehId },
                { $set: vehicleUpdateFields },
                { new: true }
              );
            }
          } catch (err) {
            await cleanupUploads();
            return res.status(500).json({ message: "Vehicle update failed." });
          }

          // ✅ Update User.documents entry for this vehicleId
          if (vehicleImagePath) {
            const docEntry = customer.documents.find(
              d => d.vehicleId?.toString() === vehId
            );
            if (docEntry) {
              docEntry.carImage = vehicleImagePath; // update existing
            } else {
              customer.documents.push({ vehicleId: vehId, carImage: vehicleImagePath });
            }
          }

        }
        // ── ADD NEW VEHICLE ──────────────────────────────────────────────────
        else if (!v.vId) {
          const requiredFields = ["licensePlateNo", "vehicleName", "model", "year", "vinNo", "odometerReading"];
          const hasAllRequired = requiredFields.every(
            field => v[field] !== undefined && v[field] !== null && v[field] !== ""
          );

          if (hasAllRequired) {
            let newCarImages = [];
            if (vehicleImagePath) {
              newCarImages = [vehicleImagePath];
            } else if (typeof v.carImages === "string") {
              try {
                const imgs = JSON.parse(v.carImages);
                if (Array.isArray(imgs)) newCarImages = imgs;
              } catch (e) {}
            } else if (Array.isArray(v.carImages)) {
              newCarImages = v.carImages;
            }

            const newVehicleData = {
              licensePlateNo:            v.licensePlateNo,
              year:                      v.year,
              "make.name":               v.vehicleName,
              "make.model":              v.model,
              vinNo:                     v.vinNo,
              odometerReading:           v.odometerReading,
              licensePlateFrontImagePath: v.licensePlateFrontImagePath,
              licensePlateBackImagePath:  v.licensePlateBackImagePath,
              carOwnershipCertificate:   v.carOwnershipCertificate,
              insuranceCertificate:      v.insuranceCertificate,
              carImages:                 newCarImages,
              disabled:                  v.disabled,
              owner:                     customer._id,
            };
            // Remove undefined keys
            Object.keys(newVehicleData).forEach(key => {
              if (newVehicleData[key] === undefined) delete newVehicleData[key];
            });

            try {
              const newVehicleDoc = await VehicleModel.create(newVehicleData);
              if (newVehicleDoc?._id) {
                updatedVehicleObjectIds.push(newVehicleDoc._id.toString());

                // ✅ Add new entry in User.documents for new vehicle
                const docEntry = {
                  vehicleId: newVehicleDoc._id,
                  ...(vehicleImagePath ? { carImage: vehicleImagePath } : {}),
                };
                customer.documents.push(docEntry);
              }
            } catch (err) {
              await cleanupUploads();
              return res.status(500).json({ message: "Failed to create vehicle." });
            }
          }
          // skip if required fields missing
        }
      }

      updateFields.myVehicles = updatedVehicleObjectIds;
    }

    if (Object.keys(updateFields).length === 0 && !vehiclesFromBody) {
      await cleanupUploads();
      return res.status(400).json({ message: "No update fields provided." });
    }

    // ✅ Persist documents mutations + other fields
    updateFields.documents = customer.documents;

    let customerDoc;
    try {
      customerDoc = await User.findOneAndUpdate(
        { _id: carOwnerId, role: "carowner" },
        { $set: updateFields },
        { new: true }
      )
      .select("name email phone countryCode status isDisabled myVehicles address pincode city profilePhoto isProfileComplete documents favoriteAutoShops onboardedBy")
      .populate({
        path: "myVehicles",
        model: "Vehicle",
        select: "-licensePlateFrontImagePath -licensePlateBackImagePath",
      })
      .lean();
    } catch (err) {
      await cleanupUploads();
      return res.status(500).json({ message: "Customer update failed." });
    }

    if (!customerDoc) {
      await cleanupUploads();
      return res.status(404).json({ message: "Car owner not found." });
    }

    return res.status(200).json({
      message: "Customer updated successfully.",
      customer: customerDoc,
    });

  } catch (error) {
    // best-effort cleanup
    try {
      if (req.files?.["profilePhoto"]?.[0]?.path) {
        await deleteUploadedFile(req.files["profilePhoto"][0].path);
      }
      for (let i = 0; i < 5; i++) {
        const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
        if (imgPath) await deleteUploadedFile(imgPath);
      }
    } catch (_) {}
    console.error("[editCustomer] Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Set a car owner's status to "deleted" by userId
 * (Soft deletes a car owner account)
 */
toggleStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId parameter" });
  }

  if (!status || !["active", "suspended", "deleted"].includes(status)) {
    return res.status(400).json({ message: "Invalid or missing status. Status must be one of: active, suspended, deleted." });
  }

  try {
    // Fetch user first to check their current status
    const userDoc = await User.findOne({ _id: userId, role: "carowner" }).select(
      "name email phone countryCode status isDisabled myVehicles address pincode city profilePhoto isProfileComplete documents favoriteAutoShops onboardedBy"
    );

    if (!userDoc) {
      return res.status(404).json({ message: "Car owner not found." });
    }

    if (userDoc.status === status) {
      return res.status(200).json({
        message: `Car owner status is already '${status}'.`,
        customer: userDoc,
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, role: "carowner" },
      { $set: { status: status } },
      { new: true }
    ).select(
      "name email phone countryCode status isDisabled myVehicles address pincode city profilePhoto isProfileComplete documents favoriteAutoShops onboardedBy"
    );

    return res.status(200).json({
      message: `Car owner status updated to '${status}'.`,
      customer: updatedUser,
    });
  } catch (err) {
    console.error("[toggleStatus] Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


}

export default AdminController;

