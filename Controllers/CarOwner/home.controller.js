
import CommonModel from '../../Schema/common.schema.js';
import InviteHelpSchema from '../../Schema/InviteHelp.schema.js';
import { User } from '../../Schema/user.schema.js';


export const getHome = async (req, res) => {
  try {
    let { date, country } = req.query || {};

    // Default country to "canada" if not supplied
    country = country ? country : "canada";
    const normalizedCountry = country.trim().toLowerCase();

    // Construct date filter if present
    let thoughtOfTheDay = null;

    if (date || country) {
      // If at least one of date or country is present, attempt to find by date/country criteria

      let dateObj = date ? new Date(date) : new Date();
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const doc = await CommonModel.findOne(
        {
          thoughtOfTheDay: {
            $elemMatch: {
              date: { $gte: startOfDay, $lte: endOfDay },
              country: { $regex: `^${normalizedCountry}$`, $options: 'i' }
            }
          }
        },
        { "thoughtOfTheDay.$": 1 }
      ).lean();

      if (doc && Array.isArray(doc.thoughtOfTheDay) && doc.thoughtOfTheDay.length > 0) {
        thoughtOfTheDay = doc.thoughtOfTheDay[0];
      }
    } 

    // If nothing found or neither date nor country provided, fetch the most recent thought of the day (cannot be empty)
    if (!thoughtOfTheDay) {
      const doc = await CommonModel.findOne(
        {
          "thoughtOfTheDay.0": { $exists: true }, // Makes sure there's at least one entry
        },
        { thoughtOfTheDay: 1 }
      )
        .lean();

      if (doc && Array.isArray(doc.thoughtOfTheDay) && doc.thoughtOfTheDay.length > 0) {
        // Get the latest (by date and country if possible, or simply the last one by date)
        // Find latest for the provided country (case insensitive), fallback to latest overall
        const filteredByCountry = doc.thoughtOfTheDay
          .filter(item => item.country && item.country.trim().toLowerCase() === normalizedCountry);

        let candidates = filteredByCountry.length > 0 ? filteredByCountry : doc.thoughtOfTheDay;

        candidates.sort((a, b) => new Date(b.date) - new Date(a.date));
        thoughtOfTheDay = candidates[0];
      }
    }

    // --- Get CarOwner Name and City ---
    const userId = req?.user?.id || null;
    let name = null;
    let city = null;

    if (userId) {
      const user = await User.findById(userId)
        .select('name city')
        .lean();
      if (user) {
        name = user.name;
        city = user.city;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        thoughtOfTheDay,
        name,
        city
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch home data",
      error: error.message
    });
  }
};

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





