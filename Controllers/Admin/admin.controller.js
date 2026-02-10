import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";


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

// Add a new service (with optional subservices)
async addService(req, res) {
  try {
    const { name, desc, services } = req.body;
    const newService = new Services({ name, desc, services: services || [] });
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
    const { name, desc, services } = req.body;

    // 1. Fetch the existing service from DB
    const existingService = await Services.findById(id);
    if (!existingService) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    // Extract previous subservice IDs from the DB
    const prevSubserviceIds = (existingService.services || []).map(s => s._id?.toString());

    // Extract incoming subservice IDs from the body (if any - those being kept/edited)
    const incomingSubserviceIds = (services || [])
      .filter(s => s._id)                              // only edited/retained, not new ones
      .map(s => s._id.toString());

    // Find which previous subservices are being deleted
    const deletedSubserviceIds = prevSubserviceIds.filter(id => !incomingSubserviceIds.includes(id));

    if (deletedSubserviceIds.length > 0) {
      // Import models here as in deleteService
      const BusinessProfileModel = (await import('../../Schema/bussiness-profile.js')).default;
      const JobCard = (await import('../../Schema/jobCard.schema.js')).default;

      // 1. Check BusinessProfile: is any deleted subservice still referenced in myServices.subServices.subService?
      const businessProfileUsingSubservice = await BusinessProfileModel.findOne({
        'myServices.service': id,
        'myServices.subServices.subService': { $in: deletedSubserviceIds }
      });

      if (businessProfileUsingSubservice) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete: One or more subservices are still referenced by a business profile."
        });
      }

      // 2. Check JobCard: is any deleted subservice still referenced in services.subServices.id?
      const jobCardUsingSubservice = await JobCard.findOne({
        'services.id': id,
        'services.subServices.id': { $in: deletedSubserviceIds }
      });

      if (jobCardUsingSubservice) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete: One or more subservices are still referenced by a job card."
        });
      }
    }

    // Passed referential checks, safe to update
    const updatedService = await Services.findByIdAndUpdate(
      id,
      { name, desc, services },
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
    // Exclude 'services.price' in projection. 
    // MongoDB projection for nested properties: 'services.price': 0
    const allServices = await Services.find({}, { 'services.price': 0 });
    res.status(200).json({ success: true, data: allServices });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching services", error: err.message });
  }
}


async getAllCarOwners(req, res) {
  try {
    // Find users with role 'carowner', select only specified fields, and populate references
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
        select: 'name email', // Optionally select name/email of who onboarded them
      })
      .lean();

    // For each car owner, retrieve all JobCards where customerId matches the car owner's _id
    // Gather all owner ids
    const ownerIds = carOwners.map(owner => owner._id);

    // Bulk fetch all JobCards for these owners, and populate 'business', 'vehicleId', 'customerId', 'services'
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
        select: 'name email' // or adjust as needed
      })
      .populate({
        path: 'services.id',
        model: 'Services',
      })
      .lean();

    // Debug - log each job card with required info
    allJobCards.forEach((jobCard, idx) => {
      console.log(`[JobCard ${idx}]`);
      console.log('  _id:', jobCard._id);
      console.log('  business:', jobCard.business?._id, jobCard.business?.businessName);
      console.log('  vehicleId:', jobCard.vehicleId?._id);
      console.log('  customerId:', jobCard.customerId?._id, jobCard.customerId?.name);
      if (Array.isArray(jobCard.services)) {
        jobCard.services.forEach((serviceObj, sidx) => {
          console.log(`    Service[${sidx}]:`, serviceObj.id?._id, serviceObj.id?.serviceName);
        });
      }
    });

    // Group JobCards by owner _id (customerId)
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

    // Attach jobCards for each owner
    carOwners = carOwners.map(owner => {
      const jobCards = jobCardsByOwner[owner._id.toString()] || [];
      return {
        ...owner,
        jobCards
      };
    });

    res.status(200).json({ success: true, data: carOwners });
  } catch (err) {
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


}

export default AdminController;

