import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";
import VehicleType from "../../Schema/vehicle-type.schema.js";
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
    // We'll group by date (YYYY-MM-DD) using aggregation
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
    // Format as { date: '2024-06-04', count: n }
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

    return res.status(200).json({
      success: true,
      data: {
        carOwnersCount,
        autoShopOwnersCount,
        jobCardsCount,
        jobCardsByDate,  // <-- included here
        dealsCount,
        servicesCount,
        subServicesCount,
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
      })
      .lean();

    console.log(`[getAllCarOwners] Step 1 result: Found ${carOwners.length} car owners`);
    // Gather all owner ids
    const ownerIds = carOwners.map(owner => owner._id);
    console.log(`[getAllCarOwners] Step 2: Owner IDs -`, ownerIds);

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

    // Log job cards details for debugging at every step if not production
    if (process.env.NODE_ENV !== 'production') {
      allJobCards.forEach((jobCard, idx) => {
        console.log(`[getAllCarOwners][JobCard ${idx}] _id:`, jobCard._id);
        console.log('  business:', jobCard.business?._id, jobCard.business?.businessName);
        console.log('  vehicleId:', jobCard.vehicleId?._id);
        console.log('  customerId:', jobCard.customerId?._id, jobCard.customerId?.name);
        if (Array.isArray(jobCard.services)) {
          jobCard.services.forEach((serviceObj, sidx) => {
            console.log(`    Service[${sidx}]:`, serviceObj.id?._id, serviceObj.id?.serviceName);
          });
        }
      });
    }

    console.log("[getAllCarOwners] Step 4: Grouping job cards by owner");
    const jobCardsByOwner = {};
    for (const jobCard of allJobCards) {
      const ownerId = jobCard.customerId?._id
        ? jobCard.customerId._id.toString()
        : jobCard.customerId?.toString();
      if (!ownerId) {
        console.log("[getAllCarOwners][Warning] JobCard missing valid owner _id.", jobCard);
        continue;
      }
      if (!jobCardsByOwner[ownerId]) {
        jobCardsByOwner[ownerId] = [];
      }
      jobCardsByOwner[ownerId].push(jobCard);
    }
    console.log("[getAllCarOwners] Step 4 result: Grouped JobCards by owner", Object.keys(jobCardsByOwner).length);

    // Attach jobCards for each owner
    console.log("[getAllCarOwners] Step 5: Attaching jobs to respective owners...");
    carOwners = carOwners.map(owner => {
      const jobCards = jobCardsByOwner[owner._id.toString()] || [];
      console.log(`[getAllCarOwners] Attaching ${jobCards.length} job cards to owner:`, owner._id);
      return {
        ...owner,
        jobCards
      };
    });

    console.log("[getAllCarOwners] Step 6: Returning final data - carOwners with jobCards");
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



// --- VEHICLE TYPE CONTROLLERS (CRUD) ---


// Fetch all vehicle types
async fetchVehicleTypes  (req, res) {
  try {
    const types = await VehicleType.find({});
    res.status(200).json({ success: true, data: types });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching vehicle types", error: err.message });
  }
};

// Add a new vehicle type
async addVehicleType  (req, res) {
  try {
    const { type } = req.body;
    if (!type || typeof type !== "string" || !type.trim()) {
      return res.status(400).json({ success: false, message: "Vehicle type is required and must be a non-empty string" });
    }
    // Prevent duplicate type (case-insensitive)
    const exists = await VehicleType.findOne({ type: { $regex: new RegExp(`^${type.trim()}$`, 'i') } });
    if (exists) {
      return res.status(409).json({ success: false, message: "Vehicle type already exists" });
    }
    const vehicleType = new VehicleType({ type: type.trim() });
    await vehicleType.save();
    res.status(201).json({ success: true, data: vehicleType });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding vehicle type", error: err.message });
  }
};

// Edit a vehicle type
async updateVehicleType  (req, res) {
  try {
    const { id } = req.params;
    const { type } = req.body;
    if (!type || typeof type !== "string" || !type.trim()) {
      return res.status(400).json({ success: false, message: "Vehicle type is required and must be a non-empty string" });
    }
    // Prevent updating to a duplicate type
    const exists = await VehicleType.findOne({ 
      _id: { $ne: id }, 
      type: { $regex: new RegExp(`^${type.trim()}$`, 'i') } 
    });
    if (exists) {
      return res.status(409).json({ success: false, message: "Another vehicle type with this name already exists" });
    }

    const updated = await VehicleType.findByIdAndUpdate(
      id,
      { type: type.trim() },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Vehicle type not found" });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error updating vehicle type", error: err.message });
  }
};

// Delete a vehicle type
async deleteVehicleType  (req, res) {
  try {
    const { id } = req.params;
    const deleted = await VehicleType.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Vehicle type not found" });
    }
    res.status(200).json({ success: true, message: "Vehicle type deleted", data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting vehicle type", error: err.message });
  }
};


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
 * Request body: { thoughtOfTheDay, aboutUs, privacyPolicy, FAQs, Documents, Disclaimer }
 * If no row exists, create one. If exists, update the single document.
 */
async upsertDashboardData(req, res) {
    try {
        // Do strong defaulting and shaped update to avoid overwriting unintendedly
        const {
            thoughtOfTheDay,
            aboutUs,
            privacyPolicy,
            FAQs,
            Documents,
            Disclaimer
        } = req.body;

        const updateFields = {};
        if (typeof thoughtOfTheDay !== "undefined") updateFields.thoughtOfTheDay = thoughtOfTheDay;
        if (typeof aboutUs !== "undefined") updateFields.aboutUs = aboutUs;
        if (typeof privacyPolicy !== "undefined") updateFields.privacyPolicy = privacyPolicy;
        if (typeof FAQs !== "undefined") updateFields.FAQs = FAQs;
        if (typeof Documents !== "undefined") updateFields.Documents = Documents;
        if (typeof Disclaimer !== "undefined") updateFields.Disclaimer = Disclaimer;

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
 * Get the global DashboardData config for widgets (thoughtOfTheDay, aboutUs, etc.)
 * GET /admin/dashboard-data
 * If not found, send sample data (from @auto-shop.controller.js lines 307-327)
 */
async fetchDashboardData(req, res) {
    try {
        const data = await DashboardDataModel.findOne({}).lean();
        console.log("[fetchDashboardData] Queried DashboardData:", data);

        if (!data) {
            // Sample data as fallback (from auto-shop.controller.js lines 307-327)
            // Updated sample data with new content
            const sampleData = {
                thoughtOfTheDay: "Success is not the key to happiness. Happiness is the key to success.",
                aboutUs: {
                    heading: "Welcome to Our Trusted Garage",
                    desc: "At our garage, excellence in vehicle maintenance and repair is our passion. With certified technicians and modern equipment, your car is always in the best hands."
                },
                privacyPolicy: {
                    heading: "User Privacy Assurance",
                    desc: "We are dedicated to protecting your privacy. All customer records and information are kept completely confidential as per our robust privacy policies."
                },
                FAQs: {
                    heading: "Common Queries Answered",
                    desc: "1. How can I schedule a service appointment?\n2. Are original parts used for repairs?\n3. What is your warranty policy on repairs?"
                },
                Documents: {
                    heading: "Customer Care Documents",
                    desc: "Access your service history, insurance policies, and warranty certificates in this section for your convenience."
                },
                Disclaimer: {
                    heading: "Repair and Service Disclaimer",
                    desc: "Services are performed per manufacturer recommendations. Actual results may vary based on vehicle usage and prior maintenance."
                }
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
            "thoughtOfTheDay", "aboutUs", "privacyPolicy",
            "FAQs", "Documents", "Disclaimer"
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



}

export default AdminController;

