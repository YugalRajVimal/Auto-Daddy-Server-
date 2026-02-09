import DealModel from "../../Schema/deals.schema.js";
import Services from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";


class AdminController {



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


// Get all car owners
async getAllCarOwners(req, res) {
  try {
    const JobCard = (await import('../../Schema/jobCard.schema.js')).default;

    // Find users with role 'carowner', select only specified fields, and populate references
    const carOwners = await User.find(
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
    });

    // For each auto shop owner's deals (if populated), 
    // populate valueId with Service if deal.type is "services", or with subService if "subservices"

    // At this point, after the main population, some deals might have been populated inside businessProfile.myDeals
    // We'll iterate over each owner and their deals, and perform manual population as instructed.

    // Helper function to populate valueId accordingly
    async function populateDealValueIds(deals) {
      if (!Array.isArray(deals)) return deals;
      return Promise.all(
        deals.map(async (deal) => {
          if (deal.type === 'services' && deal.valueId) {
            // Populate valueId with the Service
            const ServiceModel = require('../../Schema/services.schema').default || require('../../Schema/services.schema');
            const service = await ServiceModel.findById(deal.valueId).lean();
            return { ...deal, value: service || null };
          } else if (deal.type === 'subservices' && deal.valueId) {
            // Populate valueId as subService: lookup for a subService in all services
            const ServiceModel = require('../../Schema/services.schema').default || require('../../Schema/services.schema');
            // Find the service document that contains this subservice by _id in its services array
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

    // Fetch deals for each auto shop owner
    const autoShopOwners = await Promise.all(
      autoShopOwnersRaw.map(async (owner) => {
        let deals = [];
        if (owner.businessProfile?._id) {
          deals = await DealModel.find(
            { createdBy: owner.businessProfile._id }
          );
        }
        return {
          ...owner.toObject(),
          deals
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

