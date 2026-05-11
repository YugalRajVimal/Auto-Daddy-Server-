import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import CarCompany from "../../Schema/car-company-schema.js";
import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import servicesSchema from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import canadianMunicipalities from "../cityData.js";


class UserController {

    /**
     * Get dashboard data for the user:
     * - Dashboard content from dashboardData.schema.js (single document, if available)
     * - User profile (limited public fields)
     * - Upcoming next service (from JobCards for this user, soonest DUE)
     */
    getDashboardsDetails = async (req, res) => {
        try {
            // 1. Dashboard data (static marketing info, etc)
            const dashboardDoc = await DashboardDataModel.findOne().lean();

            // 2. User profile (basic info only)
            const userId = req.user && req.user.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            // Only select safe fields + thoughtOfTheDayLiked
            const user = await User.findById(userId)
                .select("name email phone profilePhoto city isProfileComplete myVehicles createdAt role thoughtOfTheDayLiked")
                .populate({
                    path: "myVehicles",
                    model: "Vehicle",
                    select: "make model year licensePlateNo odometer currentServiceHistory",
                })
                .lean();

            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            // 3. Upcoming next service (JobCard where customer==userId, dueOdometer/maintenance-related, sorted by closest future)
            let nextService = null;
            const userVehicleIds = Array.isArray(user.myVehicles) ?
                user.myVehicles.map(v => v._id || v) : [];

            if (userVehicleIds.length > 0) {
                // Build the query for the next job card
                const jobCardQuery = {
                    vehicleId: { $in: userVehicleIds },
                    customerId: userId,
                    status: { $in: ["Pending", "Scheduled", "Upcoming"] },
                };

                // Get the next job card, populating customer, vehicle, services, etc.
                const nextJobCard = await JobCard.findOne(jobCardQuery)
                    .sort([
                        ["dueOdometerReading", 1],
                        ["createdAt", 1]
                    ])
                    .populate([
                        {
                            path: "customerId",
                            model: "User",
                            select: "name email phone profilePhoto"
                        },
                        {
                            path: "vehicleId",
                            model: "Vehicle",
                            select: "make model year licensePlateNo odometer currentServiceHistory"
                        },
                        {
                            path: "services", // assuming job card has a 'services' field referencing services
                            model: "Service", // adapt to the name of your Service model
                            // select fields as needed, e.g. select: "serviceName price ..."
                        }
                    ])
                    .lean();

                if (nextJobCard) {
                    nextService = {
                        jobCardId: nextJobCard._id,
                        vehicle: nextJobCard.vehicleId, // populated vehicle details
                        customer: nextJobCard.customerId, // populated customer details
                        dueOdometerReading: nextJobCard.dueOdometerReading,
                        createdAt: nextJobCard.createdAt,
                        issueDescription: nextJobCard.issueDescription,
                        serviceType: nextJobCard.serviceType,
                        priorityLevel: nextJobCard.priorityLevel,
                        status: nextJobCard.status,
                        dueDate: nextJobCard.dueDate,
                        services: nextJobCard.services || [],
                        // add any other fields you want to expose
                    };
                }
            }

            // Respond. Additionally, expose if the user has liked the thought of the day.
            return res.status(200).json({
                success: true,
                dashboard: dashboardDoc || {},
                userProfile: user,
                nextService: nextService,
                thoughtOfTheDayLiked: !!user.thoughtOfTheDayLiked
            });
        } catch (err) {
            console.error("[getDashboardsDetails] Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to get dashboard details",
                error: err.message,
            });
        }
    }

    completeProfile = async (req, res) => {
        try {
            // Ensure jwtAuth middleware so req.user exists
            const { id } = req.user || {};

            // Get fields directly from req.body
            const { name, email, pincode, role, address } = req.body;

            // All fields required
            if (!name || !email || !pincode || !role || !address) {
                return res.status(400).json({ message: "All fields (name, email, pincode, role, address) are required." });
            }

            // Only valid role allowed
            const validRoles = ["carowner"];
            if (!validRoles.includes(role)) {
                return res.status(400).json({ message: "Invalid role provided. Allowed roles: carowner." });
            }

            if (!id) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Find user by id
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            // Check if profile is already complete
            if (user.isProfileComplete) {
                return res.status(400).json({ message: "Profile already completed." });
            }

            // Check if email is already in use by another user
            const emailExists = await User.findOne({
                email: email,
                _id: { $ne: id }
            });

            if (emailExists) {
                return res.status(409).json({
                    message: "Email is already in use by another account.",
                    existingUserId: emailExists._id
                });
            }

            // Prepare updates
            const profileUpdates = {
                name,
                email,
                pincode,
                role,
                address,
                isProfileComplete: true
            };

            // Update user
            const updatedUser = await User.findByIdAndUpdate(
                id,
                { $set: profileUpdates },
                { new: true }
            ).lean();

            if (!updatedUser) {
                return res.status(500).json({ message: "Failed to update profile." });
            }

            return res.status(200).json({
                message: "Profile completed successfully.",
                user: {
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    pincode: updatedUser.pincode,
                    role: updatedUser.role,
                    address: updatedUser.address,
                    isProfileComplete: updatedUser.isProfileComplete,
                }
            });

        } catch (error) {
            console.error("[completeProfile] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    getProfileDetails = async (req, res) => {
        try {
            const id = req.user?.id;
            if (!id) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            const user = await User.findById(id).lean();

            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            const {
                name,
                email,
                phone,
                countryCode,
                pincode,
                address,
                city,
                favoriteAutoShops
            } = user;

            return res.status(200).json({
                name,
                email,
                phone,
                countryCode,
                pincode,
                address,
                city,
                favoriteAutoShopsIds:favoriteAutoShops
            });

        } catch (error) {
            console.error("[getProfileDetails] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    editProfile = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Fetch the user and check role
            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            // Only allow carowner users to edit their profile here
            if (user.role !== "carowner") {
                return res.status(403).json({ message: "Forbidden. Only car owners can edit their profile using this route." });
            }

            const updateFields = {};
            // Now also allowing "city" to be edited
            const allowedFields = [
                "name", "email", "countryCode", "pincode", "address", "city"
            ];

            for (const key of allowedFields) {
                if (req.body[key] !== undefined) {
                    updateFields[key] = req.body[key];
                }
            }

            // Handle "profilePhoto" if file uploaded (with multer)
            if (req.file && req.file.path) {
                updateFields.profilePhoto = req.file.path.replace(/\\/g, "/");
            }

            if (Object.keys(updateFields).length === 0) {
                return res.status(400).json({ message: "No profile fields provided to update." });
            }

            // If email is being updated, check that it's not used by another user
            if (
                updateFields.email !== undefined &&
                updateFields.email !== null &&
                updateFields.email.trim() !== ""
            ) {
                const emailToCheck = updateFields.email.trim().toLowerCase();
                // The current user can keep their email, but not set it to an existing user's email
                const existingUser = await User.findOne({ 
                    email: emailToCheck, 
                    _id: { $ne: userId } 
                }).lean();
                if (existingUser) {
                    return res.status(409).json({
                        message: "This email is already taken by another user."
                    });
                }
                updateFields.email = emailToCheck;
            }

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: updateFields },
                { new: true, runValidators: true }
            ).lean();

            if (!updatedUser) {
                return res.status(404).json({ message: "User not found." });
            }

            // Only return relevant info, still include phone in response (not updated)
            const {
                name, email, phone, countryCode, pincode, address, profilePhoto, city
            } = updatedUser;

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully.",
                data: { name, email, phone, countryCode, pincode, address, city, profilePhoto }
            });

        } catch (error) {
            console.error("[editProfile] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

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


    async fetchCarCompanies(req, res) {
        try {
          // Lazy require to avoid circular or unused import at top level
      
          const { companyName } = req.query;
          let companies;
          if (companyName) {
            companies = await CarCompany.find({
              companyName: { $regex: companyName, $options: "i" }
            });
          } else {
            companies = await CarCompany.find({});
          }
          return res.status(200).json({ success: true, data: companies });
        } catch (err) {
          console.error("[fetchCarCompanies] Error:", err);
          return res.status(500).json({
            success: false,
            message: "Failed to fetch car companies",
            error: err.message
          });
        }
      }

   

    // ---------- VEHICLE CRUD Operations ----------
    // Add a new vehicle for the authenticated user (car owner)
    // @vehicles.schema.js (8-9): Add carOwnershipCertificate and insuranceCertificate file handling
    addVehicle = async (req, res) => {
        const session = await VehicleModel.startSession();
        session.startTransaction();
        try {
            const userId = req.user?.id;
            if (!userId) {
                await session.abortTransaction();
                session.endSession();
                deleteUploadedFiles(req.files);
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Vehicle fields (licensePlateFront/BackImagePath are not mandatory)
            const { licensePlateNo, vinNo, name, model, year, odometerReading } = req.body;

            // Get uploaded image paths (not mandatory for vehicle creation)
            const licensePlateFrontImagePath =
                req.files?.licensePlateFrontImage?.[0]?.path || null;
            const licensePlateBackImagePath =
                req.files?.licensePlateBackImage?.[0]?.path || null;
            const carImages =
                req.files?.carImages?.map(file => file.path) || [];

            // Optional vehicle documents (not mandatory)
            const carOwnershipCertificate =
                req.files?.carOwnershipCertificate?.[0]?.path || null;
            const insuranceCertificate =
                req.files?.insuranceCertificate?.[0]?.path || null;

            // Mandatory vehicle info only
            if (
                !licensePlateNo ||
                !vinNo ||
                !name ||
                !model ||
                !year
            ) {
                await session.abortTransaction();
                session.endSession();
                deleteUploadedFiles(req.files);
                return res.status(400).json({ message: "Required vehicle fields missing." });
            }

            // Prepare new vehicle payload
            const vehicleData = {
                licensePlateNo,
                vinNo,
                make: { name, model },
                year,
                odometerReading: odometerReading || 0,
            };

            // Add non-mandatory image fields if present
            if (licensePlateFrontImagePath) vehicleData.licensePlateFrontImagePath = licensePlateFrontImagePath;
            if (licensePlateBackImagePath) vehicleData.licensePlateBackImagePath = licensePlateBackImagePath;
            if (carImages.length) vehicleData.carImages = carImages;
            if (carOwnershipCertificate) vehicleData.carOwnershipCertificate = carOwnershipCertificate;
            if (insuranceCertificate) vehicleData.insuranceCertificate = insuranceCertificate;

            let newVehicle;
            try {
                const created = await VehicleModel.create([vehicleData], { session });
                newVehicle = created[0];
            } catch (creationError) {
                await session.abortTransaction();
                session.endSession();
                deleteUploadedFiles(req.files);
                throw creationError;
            }

            try {
                await User.findByIdAndUpdate(
                    userId,
                    { $push: { myVehicles: newVehicle._id } },
                    { session }
                );
                await session.commitTransaction();
                session.endSession();
            } catch (linkError) {
                await session.abortTransaction();
                session.endSession();
                deleteUploadedFiles(req.files);
                throw linkError;
            }

            const updatedUser = await User.findById(userId)
                .populate("myVehicles")
                .lean();

            return res.status(201).json({
                success: true,
                message: "Vehicle added successfully.",
                vehicle: newVehicle,
                myVehicles: updatedUser?.myVehicles || [],
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            deleteUploadedFiles(req.files);
            console.error("[addVehicle] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Edit/update an existing vehicle
    editVehicle = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const { vehicleId } = req.params;
            if (!vehicleId) {
                return res.status(400).json({ message: "Vehicle ID is required." });
            }

            // Only allow update if user owns the vehicle (if ownership modeled)
            // For now, assuming only "by ID" and not multi-tenant check
            
            const updateFields = {};
            [
                "licensePlateNo",
                "licensePlateImagePath",
                "vinNo",
                "make",
                "year",
                "odometerReading",
                "carImage"
            ].forEach(field => {
                if (req.body[field] !== undefined) updateFields[field] = req.body[field];
            });

            const updatedVehicle = await VehicleModel.findByIdAndUpdate(
                vehicleId,
                { $set: updateFields },
                { new: true }
            );

            if (!updatedVehicle) {
                return res.status(404).json({ message: "Vehicle not found." });
            }
            return res.status(200).json({
                success: true,
                message: "Vehicle updated successfully.",
                vehicle: updatedVehicle
            });
        } catch (error) {
            console.error("[editVehicle] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Fetch all vehicles (optionally belonging to the current user)
    fetchAllVehicles = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Fetch user's vehicles via their myVehicles array
            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            // If there are no vehicles, return an empty array
            if (!user.myVehicles || !Array.isArray(user.myVehicles) || user.myVehicles.length === 0) {
                return res.status(200).json({ vehicles: [] });
            }

            // Find all vehicles whose IDs are in user.myVehicles
            const vehicles = await VehicleModel.find({ _id: { $in: user.myVehicles } }).lean();

            return res.status(200).json({
                vehicles
            });
        } catch (error) {
            console.error("[fetchAllVehicles] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Delete a vehicle for the authenticated user (remove from vehicles collection and user's myVehicles array)
    deleteVehicle = async (req, res) => {
        try {
            const userId = req.user?.id;
            const { vehicleId } = req.body;

            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            if (!vehicleId) {
                return res.status(400).json({ success: false, message: "Vehicle ID is required." });
            }

            // Find the user first
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            // Check if this vehicle is present in user's myVehicles
            const index = user.myVehicles.findIndex(
                id => String(id) === String(vehicleId)
            );
            if (index === -1) {
                return res.status(404).json({ success: false, message: "Vehicle not found in user's vehicles." });
            }

            // Remove the vehicle from VehicleModel (delete from database)
            const deletedVehicle = await VehicleModel.findByIdAndDelete(vehicleId);
            if (!deletedVehicle) {
                return res.status(404).json({ success: false, message: "Vehicle not found in database." });
            }

            // Remove from user's myVehicles array
            user.myVehicles.splice(index, 1);
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Vehicle deleted successfully.",
                deletedVehicleId: vehicleId
            });
        } catch (error) {
            console.error("[deleteVehicle] Error:", error);
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    };

    // Fetch all deals, prioritizing deals from businesses in the same city as the user (if possible)
    getAllDeals = async (req, res) => {
        try {
            // Try to get logged in user to get user's city (public route so may not exist)
            let userCity = null;
            if (req.user && req.user.id) {
                const user = await User.findById(req.user.id).select("city").lean();
                if (user && user.city) {
                    userCity = user.city.trim().toLowerCase();
                }
            }

            // Fetch all deals, populating business profile and then each service inside deal.services
            let deals = await DealModel.find({})
                .populate({
                    path: "createdBy",
                    select: "city businessName businessAddress businessLogo",
                    model: "BusinessProfile"
                })
                .populate({
                    path: "serviceId", // This assumes "services" is an array [{service: ObjectId, ...}]
                    model: "Services",
                    select: "name desc"
                })
                .lean();

            // Filter for enabled deals only (even if schema doesn't mention dealEnabled, so fallback to all deals)
            // Remove deals without a valid business
            deals = deals.filter(
                d =>
                    d.createdBy && // valid business
                    (
                        typeof d.dealEnabled === "undefined" || // allow if dealEnabled missing
                        d.dealEnabled === true                // or explicitly enabled
                    )
            );

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
                cityDeals = deals; // if no user city, just show all
                otherDeals = [];
            }

            return res.status(200).json({
                success: true,
                deals: [...cityDeals, ...otherDeals]
            });
        } catch (error) {
            console.error("[getAllDeals] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Fetch all auto shops (reuse logic from AutoShopController)
    getAllAutoShops = async (req, res) => {
        try {
            // Fetch requesting user (to get their city)
            const userId = req.user?.id;
            let userCity = null;
            if (userId) {
                const user = await User.findById(userId).lean();
                userCity = user?.city?.trim().toLowerCase() || null;
            }

            // Combine search for both serviceName and subServiceName into one param: `search`
            // Use: ?search=theNameToSearch (case-insensitive, matches service or subservice)
            const { search } = req.query;
            let filterSearch = typeof search === "string" && search.trim().length > 0 ? search.trim().toLowerCase() : null;

            // Get all services from db
            const allServices = await servicesSchema.find({}, { _id: 1, name: 1, desc: 1 }).lean();

            // Only select required fields from the business profile model
            let autoShops = await BusinessProfileModel.find({}, {
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
                    _id: 1
                })
                .populate({
                    path: 'myServices.service',
                    model: 'Services',
                    select: 'name desc'
                })
                .lean();

            // Compose myServices so ALL services are present,
            // even if a shop does not have that service, returning with empty subServices array
            autoShops = autoShops.map(shop => {
                // Build a map of myServices per shop by service _id
                const existingServicesMap = {};
                if (Array.isArray(shop.myServices)) {
                    for (const ms of shop.myServices) {
                        if (ms.service && (ms.service._id || ms.service)) {
                            // Normalize ms.service to string id
                            const serviceId = typeof ms.service === 'object' && ms.service._id ? String(ms.service._id) : String(ms.service);
                            existingServicesMap[serviceId] = ms;
                        }
                    }
                }
                // For each service, construct entry, always sending all services
                const allMyServices = allServices.map(svc => {
                    const serviceId = String(svc._id);
                    // If shop has this service in myServices
                    if (existingServicesMap[serviceId]) {
                        // Remove price from subServices if present
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
                        // Shop does NOT have this service; return empty subServices
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
                    avgRating: avgRating
                };
            });

            // ----- FILTERING LOGIC BY search (serviceName or subServiceName, case-insensitive) -----
            if (filterSearch) {
                autoShops = autoShops.filter(shop => {
                    let matched = false;
                    for (const ms of (shop.myServices || [])) {
                        // Check if service name matches
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
                        // Check if ANY sub-service matches
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
            }

            // Sort: matching city shops first if userCity available
            if (userCity) {
                const matching = [];
                const others = [];
                for (const shop of autoShops) {
                    const shopCity = shop.city?.trim().toLowerCase() || null;
                    if (shopCity && shopCity === userCity) {
                        matching.push(shop);
                    } else {
                        others.push(shop);
                    }
                }
                autoShops = matching.concat(others);
            }

            return res.status(200).json({ success: true, data: autoShops });
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

    // Fetch all job cards for this car owner (customer)
    getAllJobCards = async (req, res) => {
        try {
            // Get the requesting user
            const userId = req.user && req.user.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            // Get the user profile and check if user exists
            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            // Find job cards separated by status
            const [pendingJobCards, approvedJobCards, rejectedJobCards] = await Promise.all([
                JobCard.find({ customerId: userId, status: 'Pending' })
                    .populate([
                        { path: 'business', model: 'BusinessProfile', select: 'businessName businessType address contactNumber' },
                        { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' }
                    ])
                    .sort({ createdAt: -1 })
                    .lean(),
                JobCard.find({ customerId: userId, status: 'Approved' })
                    .populate([
                        { path: 'business', model: 'BusinessProfile', select: 'businessName businessType address contactNumber' },
                        { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' }
                    ])
                    .sort({ createdAt: -1 })
                    .lean(),
                JobCard.find({ customerId: userId, status: 'Rejected' })
                    .populate([
                        { path: 'business', model: 'BusinessProfile', select: 'businessName businessType address contactNumber' },
                        { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' }
                    ])
                    .sort({ createdAt: -1 })
                    .lean(),
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    pending: pendingJobCards,
                    approved: approvedJobCards,
                    rejected: rejectedJobCards
                }
            });
        } catch (error) {
            console.error("[getAllJobCards - CarOwner] Error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch JobCards", error: error.message });
        }
    };

    /**
     * Approve a job card by ID (customer approves the card - status set to Approved)
     * 
     * Expected params:
     *   - jobCardId (in req.params)
     * Auth: Must be the customer of the job card
     */
    approveJobCard = async (req, res) => {
        try {
            const userId = req.user && req.user.id;
            const { jobCardId } = req.params;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            if (!jobCardId) {
                return res.status(400).json({ success: false, message: "JobCard ID is required." });
            }
            // Find the job card and ensure it belongs to this user
            const jobCard = await JobCard.findOne({ _id: jobCardId, customerId: userId });
            if (!jobCard) {
                return res.status(404).json({ success: false, message: "JobCard not found." });
            }
            if (jobCard.status === "Approved") {
                return res.status(400).json({ success: false, message: "JobCard is already approved." });
            }
            jobCard.status = "Approved";
            await jobCard.save();
            return res.status(200).json({ success: true, message: "JobCard approved successfully.", data: jobCard });
        } catch (error) {
            console.error("[approveJobCard] Error:", error);
            return res.status(500).json({ success: false, message: "Failed to approve JobCard", error: error.message });
        }
    }

    /**
     * Reject a job card by ID (customer rejects the card - status set to Rejected)
     * 
     * Expected params:
     *   - jobCardId (in req.params)
     * Auth: Must be the customer of the job card
     */
    rejectJobCard = async (req, res) => {
        try {
            const userId = req.user && req.user.id;
            const { jobCardId } = req.params;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            if (!jobCardId) {
                return res.status(400).json({ success: false, message: "JobCard ID is required." });
            }
            // Find the job card and ensure it belongs to this user
            const jobCard = await JobCard.findOne({ _id: jobCardId, customerId: userId });
            if (!jobCard) {
                return res.status(404).json({ success: false, message: "JobCard not found." });
            }
            if (jobCard.status === "Rejected") {
                return res.status(400).json({ success: false, message: "JobCard is already rejected." });
            }
            jobCard.status = "Rejected";
            await jobCard.save();
            return res.status(200).json({ success: true, message: "JobCard rejected successfully.", data: jobCard });
        } catch (error) {
            console.error("[rejectJobCard] Error:", error);
            return res.status(500).json({ success: false, message: "Failed to reject JobCard", error: error.message });
        }
    }


async fetchCities(req, res) {
    try {
      const search = req.query.search?.trim();
      if (search) {
        // Case-insensitive substring search
        const searchLower = search.toLowerCase();
        const matches = canadianMunicipalities.filter(city =>
          city.toLowerCase().includes(searchLower)
        );
  
        // You can optionally paginate matches as well, but requirement is just to return matches
        return res.status(200).json({
          success: true,
          data: matches
        });
      } else {
        // Pagination: page, pageSize = 100
        const page = parseInt(req.query.page, 10) > 0 ? parseInt(req.query.page, 10) : 1;
        const pageSize = 100;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageResults = canadianMunicipalities.slice(startIdx, endIdx);
  
        return res.status(200).json({
          success: true,
          page,
          pageSize,
          total: canadianMunicipalities.length,
          totalPages: Math.ceil(canadianMunicipalities.length / pageSize),
          data: pageResults
        });
      }
    } catch (err) {
      console.error("[fetchCities] Error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch cities", error: err.message });
    }
  }

/**
 * Upload one or more car owner documents (images as base64 text, not path), saving them to the User's documents array (up to 5 allowed total).
 * Uses field: 'carOwnerDocuments' with "fileUpload" middleware.
 * Expects:
 *   - files: req.files["carOwnerDocuments"] (array of images, buffered by multer)
 *   - body: { names: string[] } or names as part of fields for each file (see below)
 *   - Each document must have a name value. Names may be provided as:
 *        1. names[] array in req.body
 *        2. name property on each file object (req.files[i].originalname can be fallback)
 */
async addCarOwnerDocument(req, res) {
    try {
      const userId = req.user.id;
  
      // upload.fields puts files under req.files[fieldname]
      let files = req.files && (req.files.carOwnerDocuments || req.files["carOwnerDocuments"]);
      if (!files && req.file) files = [req.file];
      if (!Array.isArray(files)) files = files ? [files] : [];
  
      console.log("[addCarOwnerDocument] Received files:", files.map(f => f.originalname));
  
      // Parse names — accept JSON array string, CSV string, or real array
      let namesRaw = req.body.names || req.body["names"];
      let names;
      if (typeof namesRaw === "string") {
        const trimmed = namesRaw.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            names = JSON.parse(trimmed);
          } catch {
            names = trimmed.slice(1, -1).split(",").map(s => s.trim().replace(/^"|"$/g, ""));
          }
        } else {
          names = trimmed.split(",").map(s => s.trim());
        }
      } else if (Array.isArray(namesRaw)) {
        names = namesRaw;
      } else {
        names = [];
      }
  
      console.log("[addCarOwnerDocument] Provided names (parsed):", names);
  
      if (!files.length) {
        return res.status(400).json({ success: false, message: "No document files uploaded." });
      }
  
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
  
      const currentCount = (user.documents || []).length;
      if (currentCount >= 5) {
        return res.status(400).json({ success: false, message: "Maximum of 5 documents allowed." });
      }
  
      const allowedCount = Math.min(5 - currentCount, files.length);
  
      const docsToAdd = [];
      for (let i = 0; i < allowedCount; i++) {
        const file = files[i];
  
        // With memory storage, buffer is always populated — if missing, something is misconfigured
        if (!file || !file.buffer) {
          console.log(`[addCarOwnerDocument] Skipping file (missing buffer):`, file?.originalname);
          continue;
        }
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
          console.log(`[addCarOwnerDocument] Skipping file (invalid mimetype):`, file?.originalname);
          continue;
        }
  
        let name;
        if (Array.isArray(names) && typeof names[i] === "string" && names[i].trim()) {
          name = names[i].trim();
        } else if (file.originalname?.trim()) {
          name = file.originalname.trim();
        } else {
          name = `Document ${currentCount + i + 1}`;
        }
  
        docsToAdd.push({
          name,
          imageData: file.buffer.toString("base64"),
        });
        console.log(`[addCarOwnerDocument] Prepared document:`, name);
      }
  
      if (docsToAdd.length === 0) {
        return res.status(400).json({ success: false, message: "No valid image files were uploaded." });
      }
  
      await User.findByIdAndUpdate(userId, {
        $push: { documents: { $each: docsToAdd } }
      });
  
      console.log(`[addCarOwnerDocument] Uploaded ${docsToAdd.length} document(s) for user:`, userId);
      return res.status(200).json({
        success: true,
        message: `${docsToAdd.length} document(s) uploaded successfully.`
      });
  
    } catch (error) {
      console.error("addCarOwnerDocument error:", error);
      return res.status(500).json({ success: false, message: "Failed to add document(s)", error: error.message });
    }
  }

/**
 * Edit an uploaded car owner document name.
 * Expects: { name: string } in body; :docIdx as index in documents array.
 */
async editCarOwnerDocument(req, res) {
  try {
    const userId = req.user._id;
    const { docIdx } = req.params;
    const { name } = req.body;

    const idx = parseInt(docIdx, 10);
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ success: false, message: "Invalid document index." });
    }
    if (!name || typeof name !== "string") {
      return res.status(400).json({ success: false, message: "Document name required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (!user.documents || !user.documents[idx]) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    user.documents[idx].name = name;
    await user.save();

    return res.status(200).json({ success: true, message: "Document updated successfully." });
  } catch (error) {
    console.error("editCarOwnerDocument error:", error);
    return res.status(500).json({ success: false, message: "Failed to edit document", error: error.message });
  }
}

/**
 * Delete a car owner document by index.
 * Params: :docIdx (index in documents array)
 * No need to delete image file on disk (image is saved as base64 text).
 */
async deleteCarOwnerDocument(req, res) {
  try {
    const userId = req.user.id;
    const { docIdx } = req.params;

    const idx = parseInt(docIdx, 10);
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ success: false, message: "Invalid document index." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (!user.documents || !user.documents[idx]) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    user.documents.splice(idx, 1);
    await user.save();

    return res.status(200).json({ success: true, message: "Document deleted successfully." });
  } catch (error) {
    console.error("deleteCarOwnerDocument error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete document", error: error.message });
  }
}

/**
 * Get (list) all car owner documents (name and image base64).
 * Returns: [{ name, imageData }]
 */
async getCarOwnerDocuments(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId, "documents");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    // Documents: [{ name, imageData }]
    return res.status(200).json({ success: true, data: user.documents || [] });
  } catch (error) {
    console.error("getCarOwnerDocuments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch documents", error: error.message });
  }
}

/**
 * Toggle the user's liked state for Thought of the Day.
 * If liked, unlikes it and decrements ThoughtOfTheDayLike in DashboardData.
 * If not liked, likes it and increments ThoughtOfTheDayLike.
 * Returns: { thoughtOfTheDayLiked: Boolean }
 */
async toggleThoughtOfTheDayLiked(req, res) {
  try {
    const userId = req.user.id;

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Import DashboardDataModel dynamically, since it isn't statically imported here


    // There should only be one dashboardData doc
    let dashboardData = await DashboardDataModel.findOne();
    if (!dashboardData) {
      // Create default record if not present
      dashboardData = await DashboardDataModel.create({});
    }

    // Determine increment
    let increment = 0;
    if (user.thoughtOfTheDayLiked) {
      // If already liked, unlike (decrement like count, but not below 0)
      increment = -1;
      user.thoughtOfTheDayLiked = false;
      dashboardData.thoughtOfTheDayLike = Math.max(0, dashboardData.thoughtOfTheDayLike - 1);
    } else {
      // If not liked, like (increment like count)
      increment = 1;
      user.thoughtOfTheDayLiked = true;
      dashboardData.thoughtOfTheDayLike += 1;
    }

    await user.save();
    await dashboardData.save();

    return res.status(200).json({
      success: true,
      thoughtOfTheDayLiked: user.thoughtOfTheDayLiked,
      thoughtOfTheDayLike: dashboardData.thoughtOfTheDayLike
    });
  } catch (error) {
    console.error("toggleThoughtOfTheDayLiked error:", error);
    return res.status(500).json({ success: false, message: "Failed to toggle like", error: error.message });
  }
}




// Get odometerReading from user profile's myVehicles[] and dueOdometerReading from latest JobCard for this user for every vehicle (with vehicle number)
getVehiclesOdometerReadings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get user and their vehicles, include 'licensePlateNo' from Vehicle
    const user = await User.findById(userId)
      .populate({
        path: "myVehicles",
        select: "number odometerReading licensePlateNo",
        model: "Vehicle"
      })
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const vehicles = Array.isArray(user.myVehicles) ? user.myVehicles : [];

    // Import JobCard dynamically
    let JobCard;
    try {
      JobCard = (await import("../../Schema/jobCard.schema.js")).default;
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server config error: JobCard model not found" });
    }

    // Prepare result array
    const results = await Promise.all(
      vehicles.map(async (veh) => {
        // Find the latest JobCard for this user & this vehicle (by createdAt descending)
        const jobCard = await JobCard.findOne({
          customerId: userId,
          vehicleId: veh._id
        })
          .sort({ createdAt: -1 })
          .select("dueOdometerReading createdAt")
          .lean();

        return {
          _id: veh._id, // Add vehicle _id
          vehicleNumber: veh.number,
          licensePlateNo: veh.licensePlateNo || null,
          odometerReading: veh.odometerReading || null,
          dueOdometerReading: jobCard?.dueOdometerReading || null,
          latestJobCardAt: jobCard?.createdAt || null
        };
      })
    );

    return res.status(200).json({
      success: true,
      vehicles: results
    });
  } catch (err) {
    console.error("[getVehiclesOdometerReadings]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Edit/update odometerReading using vehicle plate number
 * Expected request body: { licensePlateNo: String, odometerReading: Number }
 * Returns updated vehicle document or error
 */
/**
 * Edit/update odometerReading using vehicle plate number
 * Expected request body: { licensePlateNo: String, odometerReading: Number }
 * Returns updated vehicle document or error
 */
editOdometerById = async (req, res) => {
  try {
    const { vehicleId, odometerReading } = req.body;

    console.log("[editOdometerById] Input - vehicleId:", vehicleId, "odometerReading:", odometerReading);

    // Check required fields and odometerReading is a finite number
    if (
      !vehicleId ||
      odometerReading === undefined ||
      odometerReading === null ||
      typeof odometerReading !== "number" ||
      !Number.isFinite(odometerReading)
    ) {
      console.log("[editOdometerById] Invalid input:", req.body);
      return res.status(400).json({
        success: false,
        message: "vehicleId and valid odometerReading are required",
      });
    }

    // Find the current vehicle by _id
    const vehicle = await VehicleModel.findById(vehicleId).lean();
    if (!vehicle) {
      console.log("[editOdometerById] Vehicle not found for vehicleId:", vehicleId);
      return res.status(404).json({
        success: false,
        message: "Vehicle not found with provided vehicle ID",
      });
    }

    // Check if new odometer reading is greater than previous
    const prevOdometer = vehicle.odometerReading || 0;
    if (odometerReading <= prevOdometer) {
      console.log("[editOdometerById] New odometer reading must be greater than the previous value");
      return res.status(400).json({
        success: false,
        message: `New odometer reading (${odometerReading}) must be greater than previous value (${prevOdometer})`,
      });
    }

    // Update the odometer reading
    const updatedVehicle = await VehicleModel.findByIdAndUpdate(
      vehicleId,
      { $set: { odometerReading } },
      { new: true }
    ).lean();

    console.log("[editOdometerById] Update successful for vehicle:", updatedVehicle);

    return res.status(200).json({
      success: true,
      message: "Odometer reading updated successfully",
      vehicle: updatedVehicle,
    });
  } catch (err) {
    console.error("[editOdometerById] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





}

  

export default UserController;
