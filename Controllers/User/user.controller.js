import { deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";


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
            // Only select safe fields
            const user = await User.findById(userId)
                .select("name email phone profilePhoto isProfileComplete myVehicles createdAt role")
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

            // Respond
            return res.status(200).json({
                success: true,
                dashboard: dashboardDoc || {},
                userProfile: user,
                nextService: nextService,
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

    // ---------- VEHICLE CRUD Operations ----------
    // Add a new vehicle for the authenticated user (car owner)
    addVehicle = async (req, res) => {
        const session = await VehicleModel.startSession();
        session.startTransaction();
        try {
            const userId = req.user?.id;
            if (!userId) {
                await session.abortTransaction();
                session.endSession();
                // Clean up uploaded files if user not authorized
                deleteUploadedFiles(req.files);
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Fetch vehicle fields directly (not wrapped in make)
            const { licensePlateNo, vinNo, name, model, year, odometerReading } = req.body;

            // Get uploaded image paths from req.files (multer's upload.fields)
            const licensePlateFrontImagePath =
                req.files?.licensePlateFrontImage?.[0]?.path || null;
            const licensePlateBackImagePath =
                req.files?.licensePlateBackImage?.[0]?.path || null;
            const carImages =
                req.files?.carImages?.map(file => file.path) || [];

            // Validate required fields directly
            if (
                !licensePlateNo ||
                !vinNo ||
                !name ||
                !model ||
                !year
            ) {
                await session.abortTransaction();
                session.endSession();
                // Delete all uploaded files for this request if validation fails
                deleteUploadedFiles(req.files);
                return res.status(400).json({ message: "Required vehicle fields missing." });
            }

            // Build new vehicle payload with name/model structured in make
            const vehicleData = {
                licensePlateNo,
                licensePlateFrontImagePath,
                licensePlateBackImagePath,
                vinNo,
                make: { name, model },
                year,
                odometerReading: odometerReading || 0,
                carImages
            };

            let newVehicle;
            try {
                // Create the new vehicle inside the transaction
                const created = await VehicleModel.create([vehicleData], { session });
                newVehicle = created[0];
            } catch (creationError) {
                await session.abortTransaction();
                session.endSession();
                // Clean up uploaded files on error
                deleteUploadedFiles(req.files);
                throw creationError;
            }

            try {
                // Add the new vehicle's _id to the user's myVehicles array
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
                // If DB error, delete newly uploaded images we just created
                deleteUploadedFiles(req.files);
                throw linkError;
            }

            // Now fetch the updated user with vehicles populated via myVehicles
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
            // Clean up uploaded files if there was an unhandled error
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
                // Find user and their city (if available)
                const user = await User.findById(userId).lean();
                userCity = user?.city?.trim().toLowerCase() || null;
            }

            // Only select required fields from the business profile model
            // Fields: businessName, openHours, openDays, closedDays, businessAddress, city, businessPhone, businessEmail,
            // businessLogo (businessProfileImage), businessMapLocation
            let autoShops = await BusinessProfileModel.find({}, {
                    businessName: 1,
                    openHours: 1,
                    openDays: 1,
                    closedDays: 1,
                    businessAddress: 1,
                    city: 1,
                    businessPhone: 1,
                    businessEmail: 1,
                    businessLogo: 1, // will be named as businessProfileImage below
                    businessMapLocation: 1,
                    _id: 1
                })
                .populate({
                    path: 'myServices.service',
                    model: 'Services',
                    select: 'name desc',
                })
                .populate({
                    path: 'myDeals',
                    model: 'Deal'
                })
                .lean();

            // Map/rename businessLogo -> businessProfileImage in the result
            autoShops = autoShops.map(shop => {
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
                    myServices: shop.myServices,
                    myDeals: shop.myDeals
                };
            });

            // If userCity is available, sort so that matching city shops come first
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


}

  

export default UserController;
