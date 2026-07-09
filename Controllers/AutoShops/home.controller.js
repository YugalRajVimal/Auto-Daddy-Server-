
import BusinessProfileModel from '../../Schema/bussiness-profile.js';
import CommonModel from '../../Schema/common.schema.js';
import { User } from '../../Schema/user.schema.js';


export const getHome = async (req, res) => {
  try {
    // Fetch date and country from req
    let { date, country } = req.query || {};

    // If country not provided, default to 'canada'
    country = country ? country : "canada";

    // If date not provided, use today's date (midnight)
    let dateObj = date ? new Date(date) : new Date();

    // Slice time to midnight for start and end of day range
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // Make country case-insensitive for querying
    const normalizedCountry = country.trim().toLowerCase();

    // Query only for the specific matching thoughtOfTheDay item using $elemMatch and project only the matching element fields
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

    let thoughtOfTheDay = null;
    if (doc && Array.isArray(doc.thoughtOfTheDay) && doc.thoughtOfTheDay.length > 0) {
      // Return just the matched element, but clean the object if necessary (could .toObject() if not lean)
      thoughtOfTheDay = doc.thoughtOfTheDay[0];
    }

    // --- Get AutoShopOwner Name, Business Name, Days Left Subscription ---
    const userId = req?.user?.id || null;
    let autoShopOwnerName = null;
    let businessName = null;
    let daysLeftInSubscription = null;

    if (userId) {
      // Only fetch name and businessProfile _id of the user
      const user = await User.findById(userId)
        .select('name businessProfile')
        .lean();

      if (user) {
        autoShopOwnerName = user.name || null;

        if (user.businessProfile) {
          // Only fetch businessName and the 1st subscription (using $slice to only pull first sub, fastest in projection)
          const bprofile = await BusinessProfileModel.findById(user.businessProfile)
            .select({ businessName: 1, subscriptions: { $slice: 1 } })
            .lean();

          if (bprofile) {
            businessName = bprofile.businessName || null;
            const sub = Array.isArray(bprofile.subscriptions) ? bprofile.subscriptions[0] : null;

            if (sub && sub.purchasedOn && typeof sub.days === 'number') {
              const today = new Date();
              const expiresAt = new Date(sub.purchasedOn);
              expiresAt.setDate(expiresAt.getDate() + sub.days);
              const msPerDay = 1000 * 60 * 60 * 24;
              let diff = Math.ceil((expiresAt - today) / msPerDay);
              daysLeftInSubscription = diff > 0 ? diff : 0;
            } else {
              daysLeftInSubscription = 0;
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        thoughtOfTheDay,
        autoShopOwnerName,
        businessName,
        daysLeftInSubscription
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


