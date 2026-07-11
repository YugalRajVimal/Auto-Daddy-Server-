import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import DealModel from "../../Schema/deals.schema.js";
import servicesSchema from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";

/**
 * AutoShopController
 * Handles: favorite auto shops, listing/filtering auto shops, rating, deals, connect requests
 */
class AutoShopController {

    toggleAutoShopFav = async (req, res) => {
        try {
            const userId = req.user?.id;
            const { autoShopId } = req.body;

            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            if (!autoShopId) {
                return res.status(400).json({ message: "Missing autoShopId" });
            }

            // Assuming the user schema has a 'favoriteAutoShops' array field
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            user.favoriteAutoShops = user.favoriteAutoShops || [];
            const favIndex = user.favoriteAutoShops.indexOf(autoShopId);

            let message;
            let action;
            if (favIndex !== -1) {
                // Remove from favorites
                user.favoriteAutoShops.splice(favIndex, 1);
                message = "Auto shop removed from favorites.";
                action = "removed";
            } else {
                // Add to favorites
                user.favoriteAutoShops.push(autoShopId);
                message = "Auto shop added to favorites.";
                action = "added";
            }
            await user.save();

            return res.status(200).json({
                success: true,
                message,
                action,
                favoriteAutoShops: user.favoriteAutoShops
            });

        } catch (error) {
            console.error("[toggleAutoShopFav] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    getFavAutoShops = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Fetch user with populated favoriteAutoShops using BusinessProfile (not AutoShop)
            const user = await User.findById(userId)
                .populate({
                    path: 'favoriteAutoShops',
                    model: 'BusinessProfile', // explicitly populate from BusinessProfile model
                    select: 'businessName businessAddress city businessLogo businessPhone businessEmail openHours openDays closedDays businessMapLocation isBusinessActive myServices myDeals'
                })
                .lean();

            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            const favoriteAutoShops = user.favoriteAutoShops || [];

            return res.status(200).json({
                favoriteAutoShops
            });

        } catch (error) {
            console.error("[getFavAutoShops] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    getAllAutoShops = async (req, res) => {
        try {
            // Fetch requesting user (to get their city and favorites)
            const userId = req.user?.id;
            console.log("[getAllAutoShops] Step: Extracted userId:", userId);
            let userCity = null;
            let favoriteAutoShops = [];
            if (userId) {
                const user = await User.findById(userId).lean();
                console.log("[getAllAutoShops] Step: Fetched User:", user?._id || null);
                userCity = user?.city?.trim().toLowerCase() || null;
                console.log("[getAllAutoShops] Step: Extracted userCity:", userCity);
                if (Array.isArray(user?.favoriteAutoShops)) {
                    favoriteAutoShops = user.favoriteAutoShops.map(a => a.toString());
                    console.log("[getAllAutoShops] Step: User favoriteAutoShops:", favoriteAutoShops);
                } else {
                    console.log("[getAllAutoShops] Step: User has no favoriteAutoShops array");
                }
            } else {
                console.log("[getAllAutoShops] Step: No userId found (unauthenticated user)");
            }

            // Extract filter parameters from query
            const { search, service, carCompanies, shopType } = req.query;
            console.log("[getAllAutoShops] Step: Query params:", { search, service, carCompanies, shopType });

            let filterSearch = typeof search === "string" && search.trim().length > 0 ? search.trim().toLowerCase() : null;
            console.log("[getAllAutoShops] Step: filterSearch:", filterSearch);

            // Build service filter array if provided
            let filterServiceIds = [];
            if (typeof service === "string" && service.trim().length > 0) {
                filterServiceIds = service.split(',').map(s => s.trim()).filter(Boolean);
                console.log("[getAllAutoShops] Step: filterServiceIds:", filterServiceIds);
            } else {
                console.log("[getAllAutoShops] Step: No service filter applied.");
            }

            // Build carCompanies filter array if provided
            let filterCarCompanyIds = [];
            if (typeof carCompanies === "string" && carCompanies.trim().length > 0) {
                filterCarCompanyIds = carCompanies.split(',').map(v => v.trim()).filter(Boolean);
                console.log("[getAllAutoShops] Step: filterCarCompanyIds:", filterCarCompanyIds);
            } else {
                console.log("[getAllAutoShops] Step: No carCompanies filter applied.");
            }

            // Allowed shop types from user.schema.js
            const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
            let filterShopType = null;
            if (typeof shopType === "string") {
                if (allowedShopTypes.includes(shopType.trim())) {
                    filterShopType = shopType.trim();
                    console.log("[getAllAutoShops] Step: filterShopType valid -", filterShopType);
                } else {
                    console.log("[getAllAutoShops] Step: shopType in query but not allowed:", shopType.trim());
                }
            } else {
                console.log("[getAllAutoShops] Step: No shopType filter applied.");
            }

            // Get all services from db
            const allServices = await servicesSchema.find({}, { _id: 1, name: 1, desc: 1 }).lean();
            console.log("[getAllAutoShops] Step: allServices fetched. Count:", allServices.length);

            // Only fetch business profiles that are active.
            // NOTE: BusinessProfile schema has no `status` field — it uses
            // `isBusinessActive: Boolean`. Filtering on `status` always matched
            // zero documents, independent of any shopType/_id filtering, which is
            // why autoShops count was 0 even after the _id $in filter was correct.
            let businessProfileFilter = { isBusinessActive: true };
            console.log("[getAllAutoShops] Step: businessProfileFilter:", businessProfileFilter);

            // 1. Find all Users with businessProfile (not null) and role autoshopowner (where shopType is held)
            let userShopQuery = { businessProfile: { $ne: null }, role: "autoshopowner" };
            // Apply shopType filter here in User query for efficiency, so only fetch those users with matching shopType up front
            if (filterShopType) {
                if (filterShopType === "autoShop") {
                    // Legacy users created before `shopType` existed on the schema have
                    // no `shopType` field stored at all, so a plain equality query
                    // misses them even though the schema default is "autoShop".
                    userShopQuery.$or = [
                        { shopType: "autoShop" },
                        { shopType: { $exists: false } }
                    ];
                } else {
                    userShopQuery.shopType = filterShopType;
                }
                console.log("[getAllAutoShops] Step: userShopQuery with shopType:", userShopQuery);
            } else {
                console.log("[getAllAutoShops] Step: userShopQuery:", userShopQuery);
            }

            // Fetch all these users (shopType lives in User, not BusinessProfile!)
            const userShopTypes = await User.find(
                userShopQuery,
                { businessProfile: 1, shopType: 1 }
            ).lean();
            console.log("[getAllAutoShops] Step: userShopTypes fetched. Count:", userShopTypes.length);

            // Map: { businessProfileId: shopType } for all valid profiles (optionally filtered by shopType)
            const businessProfileIdToShopType = {};
            userShopTypes.forEach(u => {
                if (u.businessProfile) {
                    // Fall back to the schema default when the field isn't actually stored
                    businessProfileIdToShopType[String(u.businessProfile)] = u.shopType || "autoShop";
                }
            });
            console.log("[getAllAutoShops] Step: businessProfileIdToShopType keys:", Object.keys(businessProfileIdToShopType));

            // Only allow BusinessProfiles belonging to these userShopTypes (after shopType gets filtered already)
            let validBusinessProfileIds = Object.keys(businessProfileIdToShopType);
            console.log("[getAllAutoShops] Step: validBusinessProfileIds:", validBusinessProfileIds);

            let profileFilter = { ...businessProfileFilter };
            // IMPORTANT: once a shopType filter was explicitly requested, always
            // constrain by _id — even to an empty array — so "0 matching users"
            // correctly returns zero shops instead of silently falling back to
            // every active profile.
            if (filterShopType || validBusinessProfileIds.length > 0) {
                profileFilter._id = { $in: validBusinessProfileIds };
                console.log("[getAllAutoShops] Step: profileFilter updated with _id $in array:", profileFilter);
            } else {
                console.log("[getAllAutoShops] Step: profileFilter for all active due to no validBusinessProfileIds match");
            }

            // Fetch only relevant BusinessProfile documents (matching profileFilter, which already encodes shopType user-side)
            let autoShops = await BusinessProfileModel.find(profileFilter, {
                businessName: 1,
                openHours: 1,
                openDays: 1,
                closedDays: 1,
                businessAddress: 1,
                city: 1,
                businessPhone: 1,
                businessEmail: 1,
                businessLogo: 1,
                businessMapLocation: 1,
                myServices: 1,
                ratings: 1,
                carCompanies: 1,
                _id: 1,
                isBusinessActive: 1 // Only for confirmation/debug, can be removed in returned object. Not exposed to client.
            })
                .populate({
                    path: 'myServices.service',
                    model: 'Services',
                    select: 'name desc'
                })
                .populate({
                    path: 'carCompanies',
                    model: 'CarCompany',
                    select: 'name'
                })
                .lean();
            console.log("[getAllAutoShops] Step: autoShops fetched. Count:", autoShops.length);

            // Compose myServices so ALL services are present for each shop, and mark isFavourite
            autoShops = autoShops.map(shop => {
                const existingServicesMap = {};
                if (Array.isArray(shop.myServices)) {
                    for (const ms of shop.myServices) {
                        if (ms.service && (ms.service._id || ms.service)) {
                            const serviceId = typeof ms.service === 'object' && ms.service._id ? String(ms.service._id) : String(ms.service);
                            existingServicesMap[serviceId] = ms;
                        }
                    }
                }
                // Build allMyServices
                const allMyServices = allServices.map(svc => {
                    const serviceId = String(svc._id);
                    if (existingServicesMap[serviceId]) {
                        const ms = JSON.parse(JSON.stringify(existingServicesMap[serviceId]));
                        if (Array.isArray(ms.subServices)) {
                            ms.subServices = ms.subServices.map(subSvc => {
                                if ('price' in subSvc) {
                                    const { price, ...rest } = subSvc;
                                    return rest;
                                }
                                return subSvc;
                            });
                        } else {
                            ms.subServices = [];
                        }
                        return {
                            service: {
                                _id: svc._id,
                                name: svc.name,
                                desc: svc.desc
                            },
                            subServices: ms.subServices
                        };
                    } else {
                        return {
                            service: {
                                _id: svc._id,
                                name: svc.name,
                                desc: svc.desc
                            },
                            subServices: []
                        };
                    }
                });

                // Compute avgRating
                let avgRating = null;
                if (Array.isArray(shop.ratings) && shop.ratings.length > 0) {
                    const ratingsArr = shop.ratings.map(r => typeof r.rating === 'number' ? r.rating : null).filter(r => r !== null);
                    if (ratingsArr.length > 0) {
                        avgRating = ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length;
                        avgRating = Number(avgRating.toFixed(2));
                    }
                }

                // Determine isFavourite
                const isFavourite = favoriteAutoShops.includes(shop._id.toString());

                // Fetch shopType from User's mapping
                const shopTypeValue = businessProfileIdToShopType[String(shop._id)] || null;

                return {
                    _id: shop._id,
                    businessName: shop.businessName,
                    openHours: shop.openHours,
                    openDays: shop.openDays,
                    closedDays: shop.closedDays,
                    businessAddress: shop.businessAddress,
                    city: shop.city,
                    contactDetails: {
                        phone: shop.businessPhone,
                        email: shop.businessEmail
                    },
                    businessProfileImage: shop.businessLogo,
                    businessMapLocation: shop.businessMapLocation,
                    myServices: allMyServices,
                    avgRating: avgRating,
                    carCompanies: shop.carCompanies || [],
                    shopType: shopTypeValue,
                    isFavourite: isFavourite
                };
            });
            console.log("[getAllAutoShops] Step: After remapping, autoShops count:", autoShops.length);

            // 1. Filter by Service(s)
            if (filterServiceIds.length > 0) {
                const beforeCount = autoShops.length;
                autoShops = autoShops.filter(shop => {
                    for (const ms of shop.myServices) {
                        if (
                            filterServiceIds.includes(String(ms.service._id)) &&
                            (Array.isArray(ms.subServices) ? ms.subServices.length > 0 : false)
                        ) {
                            return true;
                        }
                    }
                    return false;
                });
                console.log("[getAllAutoShops] Step: After filterServiceIds filter, count:", beforeCount, "->", autoShops.length);
            } else {
                console.log("[getAllAutoShops] Step: No Service filterIds, skipped service filtering.");
            }

            // 2. Filter by Car Company(ies)
            if (filterCarCompanyIds.length > 0) {
                const beforeCount = autoShops.length;
                autoShops = autoShops.filter(shop => {
                    let shopCarCompanies = Array.isArray(shop.carCompanies) ? shop.carCompanies : [];
                    shopCarCompanies = shopCarCompanies.map(cc => {
                        if (cc && typeof cc === "object" && cc._id) return String(cc._id);
                        if (typeof cc === "string") return cc;
                        return String(cc);
                    });
                    return filterCarCompanyIds.some(fid => shopCarCompanies.includes(fid));
                });
                console.log("[getAllAutoShops] Step: After filterCarCompanyIds filter, count:", beforeCount, "->", autoShops.length);
            } else {
                console.log("[getAllAutoShops] Step: No CarCompany filterIds, skipped car company filtering.");
            }

            // 3. Search by service name or sub-service name
            if (filterSearch) {
                const beforeCount = autoShops.length;
                autoShops = autoShops.filter(shop => {
                    let matched = false;
                    for (const ms of (shop.myServices || [])) {
                        if (
                            ms.service &&
                            typeof ms.service.name === 'string' &&
                            ms.service.name.trim().toLowerCase().includes(filterSearch) &&
                            ms.subServices &&
                            Array.isArray(ms.subServices) &&
                            ms.subServices.length > 0
                        ) {
                            matched = true;
                            break;
                        }
                        if (ms.subServices && Array.isArray(ms.subServices) && ms.subServices.length > 0) {
                            for (const subSvc of ms.subServices) {
                                if (
                                    subSvc &&
                                    typeof subSvc.name === 'string' &&
                                    subSvc.name.trim().toLowerCase().includes(filterSearch)
                                ) {
                                    matched = true;
                                    break;
                                }
                            }
                            if (matched) break;
                        }
                    }
                    return matched;
                });
                console.log("[getAllAutoShops] Step: After filterSearch filter, count:", beforeCount, "->", autoShops.length);
            } else {
                console.log("[getAllAutoShops] Step: No filterSearch present, skipped service name and sub-service search.");
            }

            // Sort: top favorites first, then remaining, keeping city sorting logic within each group if userCity available
            let favShops = [];
            let nonFavShops = [];
            for (const shop of autoShops) {
                if (shop.isFavourite) {
                    favShops.push(shop);
                } else {
                    nonFavShops.push(shop);
                }
            }
            console.log("[getAllAutoShops] Step: favShops count:", favShops.length, "nonFavShops count:", nonFavShops.length);

            // Now sort within each: if userCity exists, city matches top in each group
            const sortCityTop = arr => {
                if (!userCity) {
                    console.log("[getAllAutoShops] Step: sortCityTop skipped, no userCity.");
                    return arr;
                }
                const match = [];
                const nonmatch = [];
                for (const shop of arr) {
                    const shopCity = shop.city?.trim().toLowerCase() || null;
                    if (shopCity && shopCity === userCity) {
                        match.push(shop);
                    } else {
                        nonmatch.push(shop);
                    }
                }
                console.log("[getAllAutoShops] Step: sortCityTop cityMatch count:", match.length, "others:", nonmatch.length);
                return match.concat(nonmatch);
            };

            favShops = sortCityTop(favShops);
            nonFavShops = sortCityTop(nonFavShops);

            const sortedShops = favShops.concat(nonFavShops);
            console.log("[getAllAutoShops] Step: Final sortedShops count:", sortedShops.length);

            return res.status(200).json({ success: true, data: sortedShops });
        } catch (error) {
            console.error("[getAllAutoShops] Error:", error);
            return res.status(500).json({ success: false, message: 'Failed to fetch auto shops', error: error.message });
        }
    };

    /**
     * Rate an auto shop (BusinessProfile) as a logged-in user.
     * If the user has already rated this shop, update the existing rating.
     * Otherwise, add a new rating entry.
     *
     * Request body: { autoShopId: string, rating: number }
     */
    rateAutoShop = async (req, res) => {
        try {
            const userId = req.user && req.user.id;
            console.log("[rateAutoShop] userId:", userId);
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { autoShopId, rating } = req.body;
            console.log("[rateAutoShop] Request Body:", req.body);

            if (!autoShopId || typeof rating !== "number" || rating < 1 || rating > 5) {
                console.log("[rateAutoShop] Invalid input - autoShopId or rating:", autoShopId, rating);
                return res.status(400).json({ success: false, message: "Invalid autoShopId or rating (must be 1-5)" });
            }

            // Find the business profile
            const autoShop = await BusinessProfileModel.findById(autoShopId);
            console.log("[rateAutoShop] Fetched autoShop:", autoShop ? autoShop._id : null);
            if (!autoShop) {
                return res.status(404).json({ success: false, message: "Auto shop not found." });
            }

            // Check if the user already rated
            let updated = false;
            if (Array.isArray(autoShop.ratings)) {
                for (let i = 0; i < autoShop.ratings.length; i++) {
                    if (autoShop.ratings[i].userId.toString() === userId.toString()) {
                        console.log("[rateAutoShop] User already rated. Updating rating.");
                        autoShop.ratings[i].rating = rating; // Update rating
                        autoShop.ratings[i].updatedAt = new Date(); // update timestamp (if timestamps is true on schema)
                        updated = true;
                        break;
                    }
                }
            }

            if (!updated) {
                // Push new rating
                console.log("[rateAutoShop] Pushing new rating for user.");
                autoShop.ratings.push({
                    userId: userId,
                    rating: rating,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            await autoShop.save();
            console.log("[rateAutoShop] Saved ratings:", autoShop.ratings);

            return res.status(200).json({
                success: true,
                message: updated ? "Rating updated successfully." : "Rating added successfully.",
                ratings: autoShop.ratings
            });
        } catch (error) {
            console.error("[rateAutoShop] Error:", error);
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    };

    // Fetch all deals, prioritizing deals from businesses in the same city as the user (if possible), and align with the new deals schema
    getAllDeals = async (req, res) => {
        try {
            // Filters from query: make and model
            const { make, model } = req.query;

            // Fetch user context: city and discardedDeals for filtering
            let userCity = null;
            let discardedDeals = [];
            if (req.user && req.user.id) {
                const user = await User.findById(req.user.id).select("city discardedDeals").lean();
                if (user) {
                    if (user.city) userCity = user.city.trim().toLowerCase();
                    if (Array.isArray(user.discardedDeals)) {
                        discardedDeals = user.discardedDeals.map(id => id.toString());
                    }
                }
            }

            // Build deal query (for make/model filters)
            const dealQuery = {};

            // We'll apply make/model AFTER population, since make/model are only available after population (for vehicle and selectedVehicle)
            let deals = await DealModel.find(dealQuery)
                .populate({
                    path: "createdBy",
                    select: "city businessName businessAddress businessLogo",
                    model: "BusinessProfile"
                })
                .populate({
                    path: "serviceId",
                    model: "Services",
                    select: "name desc"
                })
                .populate({
                    path: "vehicle",
                    model: "Vehicle",
                    select: "make model year licensePlateNo vinNo"
                })
                .lean();

            // Remove deals where the business does not exist
            deals = deals.filter(d => d.createdBy);

            // Remove discarded deals for this user
            if (discardedDeals.length > 0) {
                deals = deals.filter(d => !discardedDeals.includes(d._id.toString()));
            }

            // Filter by make and model (applies to vehicle for Parts/Salvages and selectedVehicle for all types)
            if (make || model) {
                deals = deals.filter(deal => {
                    let possibleMakes = [];
                    let possibleModels = [];

                    // For "Parts" or "Salvages", use populated "vehicle"
                    if ((deal.dealType === "Parts" || deal.dealType === "Salvages") && deal.vehicle) {
                        if (deal.vehicle.make) possibleMakes.push(deal.vehicle.make.toLowerCase());
                        if (deal.vehicle.model) possibleModels.push(deal.vehicle.model.toLowerCase());
                    }
                    // For Service, or extra, use selectedVehicle (if present)
                    if (deal.selectedVehicle) {
                        if (deal.selectedVehicle.name) possibleMakes.push(deal.selectedVehicle.name.toLowerCase());
                        if (deal.selectedVehicle.model) possibleModels.push(deal.selectedVehicle.model.toLowerCase());
                    }

                    // Standardize query params (if present)
                    let matchMake = make ? possibleMakes.some(mk => mk === make.trim().toLowerCase()) : true;
                    let matchModel = model ? possibleModels.some(md => md === model.trim().toLowerCase()) : true;

                    return matchMake && matchModel;
                });
            }

            // Group deals by city (those matching user's city and others)
            let cityDeals = [];
            let otherDeals = [];
            if (userCity) {
                cityDeals = deals.filter(
                    d => d.createdBy && typeof d.createdBy.city === "string" && d.createdBy.city.trim().toLowerCase() === userCity
                );
                otherDeals = deals.filter(
                    d => !(d.createdBy && typeof d.createdBy.city === "string" && d.createdBy.city.trim().toLowerCase() === userCity)
                );
            } else {
                cityDeals = deals;
                otherDeals = [];
            }

            // Format deals: flat object ready for grouping
            function formatDeal(deal) {
                return {
                    _id: deal._id,
                    dealType: deal.dealType,
                    serviceId: deal.serviceId && deal.dealType === "Service"
                        ? {
                            _id: deal.serviceId._id,
                            name: deal.serviceId.name,
                            desc: deal.serviceId.desc,
                        }
                        : null,
                    vehicle: deal.vehicle && (deal.dealType === "Parts" || deal.dealType === "Salvages")
                        ? {
                            _id: deal.vehicle._id,
                            make: deal.vehicle.make,
                            model: deal.vehicle.model,
                            year: deal.vehicle.year,
                            licensePlateNo: deal.vehicle.licensePlateNo,
                            vinNo: deal.vehicle.vinNo
                        }
                        : null,
                    partName: deal.partName ?? null,
                    description: deal.description,
                    selectedVehicle: deal.selectedVehicle ? {
                        id: deal.selectedVehicle.id,
                        name: deal.selectedVehicle.name,
                        model: deal.selectedVehicle.model,
                        year: deal.selectedVehicle.year,
                    } : null,
                    originalPrice: deal.originalPrice,
                    discountedPrice: deal.discountedPrice,
                    offerEndsOnDate: deal.offerEndsOnDate,
                    createdBy: deal.createdBy ? {
                        _id: deal.createdBy._id,
                        city: deal.createdBy.city,
                        businessName: deal.createdBy.businessName,
                        businessAddress: deal.createdBy.businessAddress,
                        businessLogo: deal.createdBy.businessLogo
                    } : null,
                    dealImage: deal.dealImage ?? null,
                    createdAt: deal.createdAt,
                    updatedAt: deal.updatedAt
                };
            }

            // Group and structure: by dealType, sub-group into "city" and "others"
            function groupByDealType(dealsArr) {
                return dealsArr.reduce((acc, deal) => {
                    const type = deal.dealType;
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(formatDeal(deal));
                    return acc;
                }, {});
            }

            // Structure: { Service: { city: [], others: [] }, Parts: {...}, Salvages: {...} }
            function structureDeals(cityDealsArr, otherDealsArr) {
                // Group each by type
                const groupedCity = groupByDealType(cityDealsArr);
                const groupedOther = groupByDealType(otherDealsArr);

                // Get union of all dealTypes
                const allDealTypes = Array.from(new Set([
                    ...Object.keys(groupedCity),
                    ...Object.keys(groupedOther)
                ]));

                const result = {};
                allDealTypes.forEach(type => {
                    result[type] = {
                        city: groupedCity[type] ?? [],
                        others: groupedOther[type] ?? []
                    };
                });
                return result;
            }

            const dealsByType = structureDeals(cityDeals, otherDeals);

            // Provide possible filters (distinct vehicle makes and models in all matched deals)
            const allMakes = new Set();
            const allModels = new Set();
            deals.forEach(deal => {
                if (deal.vehicle) {
                    if (deal.vehicle.make) allMakes.add(deal.vehicle.make);
                    if (deal.vehicle.model) allModels.add(deal.vehicle.model);
                }
                if (deal.selectedVehicle) {
                    if (deal.selectedVehicle.name) allMakes.add(deal.selectedVehicle.name);
                    if (deal.selectedVehicle.model) allModels.add(deal.selectedVehicle.model);
                }
            });

            return res.status(200).json({
                success: true,
                deals: dealsByType,
                filters: {
                    makes: Array.from(allMakes),
                    models: Array.from(allModels)
                }
            });
        } catch (error) {
            console.error("[getAllDeals] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    /**
     * Discard a deal ID for a user (add deal to user's discardedDeals array).
     * Route: POST /discard-deal
     * Body: { dealId }
     * Auth: user must be authenticated
     */
    discardDeal = async (req, res) => {
        try {
            const userId = req.user && req.user.id;
            const { dealId } = req.body;

            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            if (!dealId) {
                return res
                    .status(400)
                    .json({ success: false, message: "dealId is required" });
            }

            // Check if deal exists
            const deal = await DealModel.findById(dealId).lean();
            if (!deal) {
                return res
                    .status(404)
                    .json({ success: false, message: "Deal not found" });
            }

            // Add dealId to user's discardedDeals array if not already present
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            if (user.discardedDeals && user.discardedDeals.includes(dealId)) {
                // Already discarded
                return res.status(200).json({
                    success: true,
                    message: "Deal already discarded",
                    discardedDeals: user.discardedDeals,
                });
            }

            user.discardedDeals = user.discardedDeals || [];
            user.discardedDeals.push(dealId);
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Deal discarded successfully",
                discardedDeals: user.discardedDeals,
            });
        } catch (error) {
            console.error("[discardDeal] Error:", error);
            return res
                .status(500)
                .json({ success: false, message: "Internal Server Error" });
        }
    };

    /**
     * Controller: connectToAutoShopOwner
     *
     * Expects: { businessId: String, serviceId: String }
     * Sends a push notification to the AutoShop Owner of provided businessId regarding the selected serviceId.
     *
     * Returns: { success, message }
     */
    connectToAutoShopOwner = async (req, res) => {
        try {
            const { businessId, serviceId } = req.body;

            if (!businessId || !serviceId) {
                return res.status(400).json({
                    success: false,
                    message: "Both businessId and serviceId are required."
                });
            }

            // Dynamic import for firebaseAdmin to avoid circular/missing deps
            let firebaseAdmin;
            try {
                firebaseAdmin = (await import("../../config/firebase.js")).default;
            } catch (e) {
                console.error("[connectToAutoShopOwner] Error loading dependencies:", e);
            }

            // Fetch current user
            let currentUser;
            try {
                currentUser = await User.findById(req.user.id).lean();
                if (!currentUser) {
                    return res.status(404).json({
                        success: false,
                        message: "Current user not found."
                    });
                }
            } catch (e) {
                console.error("[connectToAutoShopOwner] Error fetching current user:", e);
                return res.status(500).json({
                    success: false,
                    message: "Error fetching current user"
                });
            }

            // Find the business profile, now also select serviceWeWorkWith
            const business = await BusinessProfileModel.findById(businessId)
                .select("businessPhone businessName serviceWeWorkWith notifications")
                .lean();

            if (!business) {
                return res.status(404).json({ success: false, message: "Business not found" });
            }

            // Check if this business provides this service
            if (
                !Array.isArray(business.serviceWeWorkWith) ||
                !business.serviceWeWorkWith.find(
                    (s) =>
                        (typeof s === "string" && s === serviceId) ||
                        (typeof s === "object" && s?.toString() === serviceId)
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Selected business does not offer the requested service."
                });
            }

            // Find the user (owner) tied to businessProfile, role 'autoshopowner'
            let ownerUser = await User.findOne({
                businessProfile: business._id,
                role: "autoshopowner"
            }).lean();

            if (!ownerUser || !ownerUser.fcmToken) {
                return res.status(404).json({
                    success: false,
                    message: "AutoShop owner or valid FCM token not found for this business"
                });
            }

            // Optionally, get service info to include in notification
            let serviceInfo;
            if (serviceId) {
                try {
                    serviceInfo = await servicesSchema.findById(serviceId).lean();
                } catch (e) {
                    // Silently ignore if error while fetching service
                }
            }

            // Build user details for the message
            const userName = currentUser?.name || "N/A";
            const userEmail = currentUser?.email || "N/A";
            const userPhone = currentUser?.phone || currentUser?.mobileNumber || "N/A";
            const serviceName = serviceInfo?.name || "N/A";
            const serviceDescription = serviceInfo?.description || "";

            // Compose the notification message
            const notificationTitle = "Service Request from Customer";
            let notificationBody = `User details:\n- Name: ${userName}\n- Email: ${userEmail}\n- Phone No.: ${userPhone}\n\nwants this service:\n- Service: ${serviceName}`;
            if (serviceDescription) {
                notificationBody += `\n- Details: ${serviceDescription}`;
            }

            // Add notification to the business profile (using the notifications schema)
            try {
                await BusinessProfileModel.findByIdAndUpdate(
                    businessId,
                    {
                        $push: {
                            notifications: {
                                user: currentUser._id,
                                message: notificationBody,
                                time: new Date()
                            }
                        }
                    },
                    { new: true, useFindAndModify: false }
                );
            } catch (e) {
                console.error("[connectToAutoShopOwner] Failed to save notification to business profile:", e);
                // Not a critical error, proceed to continue FCM send
            }

            const message = {
                notification: {
                    title: notificationTitle,
                    body: notificationBody
                },
                token: ownerUser.fcmToken,
                data: {
                    businessId: business._id.toString(),
                    serviceId: serviceId.toString(),
                    customerId: currentUser._id.toString(),
                    type: "connect_request"
                }
            };

            // Send FCM push notification
            try {
                await firebaseAdmin.messaging().send(message);
            } catch (err) {
                console.error("[connectToAutoShopOwner] Failed to send FCM notification:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to send notification to shop owner",
                    error: err.message
                });
            }

            return res.status(200).json({
                success: true,
                message: "Connection request sent to AutoShop owner via push notification and notification saved to business profile"
            });
        } catch (err) {
            console.error("[connectToAutoShopOwner] Unexpected error:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    };
}

export default AutoShopController;
