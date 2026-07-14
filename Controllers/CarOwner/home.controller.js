
import CommonModel from '../../Schema/common.schema.js';
import InviteHelpSchema from '../../Schema/InviteHelp.schema.js';
import { User } from '../../Schema/user.schema.js';

import mongoose from "mongoose";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import DealModel from "../../Schema/deals.schema.js";
// ASSUMPTION: adjust these two import paths/names to match your actual files
import ServicesModel from "../../Schema/services.schema.js";


const { Types } = mongoose;

const normalizeToMidnight = (d) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};
 
export const getHome = async (req, res) => {
  try {
    let { date, country } = req.query || {};
    country = country ? country : "canada";
    const normalizedCountry = country.trim().toLowerCase();
 
    const userId = req?.user?.id || null;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
 
    // --- 1. Fetch the car owner profile (source of truth for name/city/phone/etc.) ---
    const user = await User.findById(userId)
      .select("name city phone myVehicles favoriteAutoShops documents")
      .populate({
        path: "myVehicles",
        select: "make model year licensePlateNo odometerReading dueOdometerReading",
      })
      .lean();
 
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    const vehicleIds = (user.myVehicles || []).map((v) => v._id);
 
    // --- 2. Thought of the Day (unchanged logic from your existing controller) ---
    let thoughtOfTheDay = null;
    {
      const dateObj = date ? new Date(date) : new Date();
      const startOfDay = normalizeToMidnight(dateObj);
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCHours(23, 59, 59, 999);
 
      const doc = await CommonModel.findOne(
        {
          thoughtOfTheDay: {
            $elemMatch: {
              date: { $gte: startOfDay, $lte: endOfDay },
              country: { $regex: `^${normalizedCountry}$`, $options: "i" },
            },
          },
        },
        { "thoughtOfTheDay.$": 1 }
      ).lean();
 
      if (doc?.thoughtOfTheDay?.length) {
        thoughtOfTheDay = doc.thoughtOfTheDay[0];
      } else {
        const fallbackDoc = await CommonModel.findOne(
          { "thoughtOfTheDay.0": { $exists: true } },
          { thoughtOfTheDay: 1 }
        ).lean();
 
        if (fallbackDoc?.thoughtOfTheDay?.length) {
          const byCountry = fallbackDoc.thoughtOfTheDay.filter(
            (item) => item.country?.trim().toLowerCase() === normalizedCountry
          );
          const candidates = byCountry.length ? byCountry : fallbackDoc.thoughtOfTheDay;
          candidates.sort((a, b) => new Date(b.date) - new Date(a.date));
          thoughtOfTheDay = candidates[0];
        }
      }
    }
 
    // --- 3. Run all independent stat queries in parallel ---
    const [
      shopsInSameCity,
      jobCards,
      dealsRunning,
      allActiveServices,
    ] = await Promise.all([
      // Shops in same city (active businesses only)
      user.city
        ? BusinessProfileModel.countDocuments({
            city: { $regex: `^${user.city}$`, $options: "i" },
            isBusinessActive: true,
          })
        : Promise.resolve(0),
 
      // All job cards for this registered customer — pulled once, reused
      // below for both the raw count and the invoice breakdown.
      JobCard.find({ customerType: "registered", customerId: userId })
        .select("status invoicePaid totalAmount vehicleId services odoIn createdAt")
        .lean(),
 
      // Deals running: tied to this user's vehicles, not yet expired
      vehicleIds.length
        ? DealModel.find({
            vehicle: { $in: vehicleIds },
            offerEndsOnDate: { $gte: new Date() },
          })
            .select("dealType partName discountedPrice originalPrice offerEndsOnDate vehicle")
            .lean()
        : Promise.resolve([]),
 
      // All active services, grouped by their single shopType
      ServicesModel.find({ status: "Active" })
        .select("name shopType odoOutRequired subServices")
        .lean(),
    ]);
 
    // --- 4. Job Card derived stats ---
    const numberOfJobCards = jobCards.length;
 
    const invoiceJobCards = jobCards.filter(
      (jc) => jc.status === "convertedToInvoice" || jc.status === "CashPaid"
    );
    const invoicesPaid = invoiceJobCards.filter((jc) => jc.invoicePaid === true).length;
    const invoicesUnpaid = invoiceJobCards.filter((jc) => jc.invoicePaid !== true).length;
 
    // --- 5. Deals Running summary (grouped by type, matching your dealType enum) ---
    const dealsSummary = {
      total: dealsRunning.length,
      Service: dealsRunning.filter((d) => d.dealType === "Service").length,
      Parts: dealsRunning.filter((d) => d.dealType === "Parts").length,
      Salvages: dealsRunning.filter((d) => d.dealType === "Salvages").length,
    };
 
    // --- 6. Documents uploaded (VehicleDocumentSchema entries on User) ---
    const documentsUploadedCount = (user.documents || []).length;
 
    // --- 7. Favourite Auto Shops Count ---
    const favouriteAutoShopsCount = (user.favoriteAutoShops || []).length;
 
    // --- 8. Services grouped by shopType (single string on this schema) ---
    const servicesByShopType = {};
    for (const svc of allActiveServices) {
      const t = svc.shopType || "uncategorized";
      if (!servicesByShopType[t]) servicesByShopType[t] = [];
      servicesByShopType[t].push({
        _id: svc._id,
        name: svc.name,
        odoOutRequired: svc.odoOutRequired,
        subServices: (svc.subServices || [])
          .filter((ss) => ss.status === "Active")
          .map((ss) => ({ _id: ss._id, name: ss.name })),
      });
    }
 
    // --- 9. Vehicles with odometer readings (already populated on user.myVehicles) ---
    const vehicles = (user.myVehicles || []).map((v) => ({
      _id: v._id,
      make: v.make,
      year: v.year,
      licensePlateNo: v.licensePlateNo,
      odometerReading: v.odometerReading,
      dueOdometerReading: v.dueOdometerReading,
    }));
 
    // --- 10. Next Service Due per vehicle ---
    // For each vehicle: list EVERY job-card line item across all its job
    // cards where the service required odo-out tracking (odoOutReading is
    // set), not just the single soonest one. Sorted soonest-due first.
    // Note: vehicle.dueOdometerReading isn't used here since we now return
    // the full per-service breakdown rather than one collapsed number.
    const jobCardsByVehicle = jobCards.reduce((acc, jc) => {
      const key = String(jc.vehicleId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(jc);
      return acc;
    }, {});
 
    const nextServiceDue = vehicles.map((v) => {
      const vJobCards = jobCardsByVehicle[String(v._id)] || [];
 
      const dueServices = [];
 
      for (const jc of vJobCards) {
        for (const s of jc.services || []) {
          if (typeof s.odoOutReading === "number") {
            dueServices.push({
              serviceId: s.service || null,
              serviceName: s.desc || s.category || null, // snapshot from the job card line item
              dueAtOdometer: s.odoOutReading,
              remainingDistance: s.odoOutReading - (v.odometerReading || 0), // negative/zero = overdue
              basedOnJobCardDate: jc.createdAt,
              jobCardId: jc._id,
            });
          }
        }
      }
 
      // Soonest due first
      dueServices.sort((a, b) => a.remainingDistance - b.remainingDistance);
 
      return {
        vehicleId: v._id,
        licensePlateNo: v.licensePlateNo,
        currentOdometer: v.odometerReading,
        dueServices,
      };
    });
 
    return res.status(200).json({
      success: true,
      data: {
        name: user.name || null,
        city: user.city || null,
        phone: user.phone || null,
 
        vehicleCount: vehicles.length,
        vehicles,
 
        shopsInSameCity,
 
        numberOfJobCards,
 
        invoices: {
          total: invoiceJobCards.length,
          paid: invoicesPaid,
          unpaid: invoicesUnpaid,
        },
 
        deals: dealsSummary,
 
        documentsUploadedCount,
 
        favouriteAutoShopsCount,
 
        servicesByShopType,
 
        nextServiceDue,
 
        thoughtOfTheDay,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch home data",
      error: error.message,
    });
  }
};

// No. of Vehicles
// Shops in same city
// Number of JobCards
// No. of Invoices ( Converted to Invoice ( Paid / Unpaid ))
// No. of Deals Running ( Services, PiChartScatter, Salvages )
// No. of all documents uploaded
// Favourite Auto Shops Count
// Get All Services with shopType cat
// Get All Vehicles with odometer readings
// Thought Of the day 
// Name
// City
// Phone Number
// Next Service Due according to Vehicle and its JobCards Odo out Services Services 


// export const getHome = async (req, res) => {
//   try {
//     let { date, country } = req.query || {};

//     // Default country to "canada" if not supplied
//     country = country ? country : "canada";
//     const normalizedCountry = country.trim().toLowerCase();

//     // Construct date filter if present
//     let thoughtOfTheDay = null;

//     if (date || country) {
//       // If at least one of date or country is present, attempt to find by date/country criteria

//       let dateObj = date ? new Date(date) : new Date();
//       const startOfDay = new Date(dateObj);
//       startOfDay.setHours(0, 0, 0, 0);
//       const endOfDay = new Date(dateObj);
//       endOfDay.setHours(23, 59, 59, 999);

//       const doc = await CommonModel.findOne(
//         {
//           thoughtOfTheDay: {
//             $elemMatch: {
//               date: { $gte: startOfDay, $lte: endOfDay },
//               country: { $regex: `^${normalizedCountry}$`, $options: 'i' }
//             }
//           }
//         },
//         { "thoughtOfTheDay.$": 1 }
//       ).lean();

//       if (doc && Array.isArray(doc.thoughtOfTheDay) && doc.thoughtOfTheDay.length > 0) {
//         thoughtOfTheDay = doc.thoughtOfTheDay[0];
//       }
//     } 

//     // If nothing found or neither date nor country provided, fetch the most recent thought of the day (cannot be empty)
//     if (!thoughtOfTheDay) {
//       const doc = await CommonModel.findOne(
//         {
//           "thoughtOfTheDay.0": { $exists: true }, // Makes sure there's at least one entry
//         },
//         { thoughtOfTheDay: 1 }
//       )
//         .lean();

//       if (doc && Array.isArray(doc.thoughtOfTheDay) && doc.thoughtOfTheDay.length > 0) {
//         // Get the latest (by date and country if possible, or simply the last one by date)
//         // Find latest for the provided country (case insensitive), fallback to latest overall
//         const filteredByCountry = doc.thoughtOfTheDay
//           .filter(item => item.country && item.country.trim().toLowerCase() === normalizedCountry);

//         let candidates = filteredByCountry.length > 0 ? filteredByCountry : doc.thoughtOfTheDay;

//         candidates.sort((a, b) => new Date(b.date) - new Date(a.date));
//         thoughtOfTheDay = candidates[0];
//       }
//     }

//     // --- Get CarOwner Name and City ---
//     const userId = req?.user?.id || null;
//     let name = null;
//     let city = null;

//     if (userId) {
//       const user = await User.findById(userId)
//         .select('name city')
//         .lean();
//       if (user) {
//         name = user.name;
//         city = user.city;
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         thoughtOfTheDay,
//         name,
//         city
//       }
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch home data",
//       error: error.message
//     });
//   }
// };

/**
 * AutoShop owner sends an invite help audio to the Admin.
 * Expects multipart/form-data:
 *   - audioBlob: binary/mp3/wav audio file (field)
 *   - serviceId: string
 *   - serviceName: string
 *   - userId: sender - ObjectId as string
 * 
 * req.user is assumed to be the autoshopowner (from authentication)
 */
export const inviteHelpCarOwnerToShopOwner=async (req, res) => {
  try {
    // Ensure file uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio blob (file) is required",
      });
    }

    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId in authenticated request."
      });
    }

    const { serviceId, serviceName } = req.body;

    if (!serviceId || !serviceName) {
      return res.status(400).json({
        success: false,
        message: "Missing one or more required fields: serviceId, serviceName, userId"
      });
    }

    // Save InviteHelp document in DB
    const inviteHelp = new InviteHelpSchema({
      serviceId,
      serviceName,
      audioBlob: req.file.buffer,
      userId,
      role: "carowner",
      to: "AutoShopOwner"
    });

    await inviteHelp.save();

    return res.status(201).json({
      success: true,
      message: "Invite for help sent to Shop Owner",
      data: {
        id: inviteHelp._id
      }
    });
  } catch (err) {
    console.error("[InviteHelpAutoShopToAdmin] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send invite help to Shop Owner",
      error: err.message
    });
  }
}


// GET /api/faq?role=carowner
export const getFaq = async (req, res) => {
  try {
    const { role } = req.query || {};
 
    if (!role) {
      return res.status(400).json({ success: false, message: "role is required" });
    }
 
    const [result] = await CommonModel.aggregate([
      {
        $project: {
          faqs: {
            $filter: {
              input: "$faqs",
              as: "item",
              cond: { $eq: [{ $toLower: "$$item.role" }, role.trim().toLowerCase()] },
            },
          },
        },
      },
    ]);
 
    const faqs = result?.faqs || [];
 
    // Newest first
    faqs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
 
    return res.status(200).json({ success: true, data: faqs });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch FAQs",
      error: error.message,
    });
  }
};
 
// GET /api/privacy-and-disclaimer?country=canada&type=privacy
export const getPrivacyAndDisclaimer = async (req, res) => {
  try {
    const { country, type } = req.query || {};
 
    if (!country || !type) {
      return res.status(400).json({ success: false, message: "country and type are required" });
    }
 
    const normalizedCountry = country.trim().toLowerCase();
    const normalizedType = type.trim().toLowerCase();
 
    const [result] = await CommonModel.aggregate([
      {
        $project: {
          privacyAndDisclaimers: {
            $filter: {
              input: "$privacyAndDisclaimers",
              as: "item",
              cond: {
                $and: [
                  { $eq: [{ $toLower: "$$item.country" }, normalizedCountry] },
                  { $eq: [{ $toLower: "$$item.type" }, normalizedType] },
                ],
              },
            },
          },
        },
      },
    ]);
 
    const items = result?.privacyAndDisclaimers || [];
    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
 
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch privacy and disclaimer content",
      error: error.message,
    });
  }
};
 
// GET /api/product-features?country=canada&role=carowner
export const getProductFeatures = async (req, res) => {
  try {
    const { country, role } = req.query || {};
 
    if (!country || !role) {
      return res.status(400).json({ success: false, message: "country and role are required" });
    }
 
    const normalizedCountry = country.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();
 
    const [result] = await CommonModel.aggregate([
      {
        $project: {
          productFeatures: {
            $filter: {
              input: "$productFeatures",
              as: "item",
              cond: {
                $and: [
                  { $eq: [{ $toLower: "$$item.country" }, normalizedCountry] },
                  { $eq: [{ $toLower: "$$item.role" }, normalizedRole] },
                ],
              },
            },
          },
        },
      },
    ]);
 
    const features = result?.productFeatures || [];
    features.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
 
    return res.status(200).json({ success: true, data: features });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product features",
      error: error.message,
    });
  }
};
 




