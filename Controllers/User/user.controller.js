import { deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";


class UserController {

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
                favoriteAutoShops
            } = user;

            return res.status(200).json({
                name,
                email,
                phone,
                countryCode,
                pincode,
                address,
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
            // Omit the "phone" from editable fields
            const allowedFields = [
                "name", "email", "countryCode", "pincode", "address"
            ];

            for (const key of allowedFields) {
                if (req.body[key] !== undefined) {
                    updateFields[key] = req.body[key];
                }
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
                name, email, phone, countryCode, pincode, address
            } = updatedUser;

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully.",
                data: { name, email, phone, countryCode, pincode, address }
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
            const id = req.user?.id;
            if (!id) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Populate favoriteAutoShops when fetching user
            const user = await User.findById(id)
                .populate('favoriteAutoShops')
                .lean();

            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            const {
             
                favoriteAutoShops
            } = user;

            return res.status(200).json({
                favoriteAutoShops: favoriteAutoShops || []
            });

        } catch (error) {
            console.error("[getProfileDetails] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // --------- VEHICLE CRUD Operations ----------

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

    // Fetch all deals (only enabled ones)
    getAllDeals = async (req, res) => {
        try {
            // Only fetch deals where dealEnabled is true
            const deals = await DealModel.find({ dealEnabled: true }).lean();
            return res.status(200).json({
                success: true,
                deals
            });
        } catch (error) {
            console.error("[getAllDeals] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Fetch all auto shops (reuse logic from AutoShopController)
    getAllAutoShops = async (req, res) => {
        try {
            // Find all auto shops and populate services, subServices, and also populate the deals in myDeals correctly
            const autoShops = await BusinessProfileModel.find({})
                .populate({
                    path: 'myServices.service',
                })
                .populate({
                    path: 'myServices.subServices.subService',
                })
                .populate({
                    path: 'myDeals',
                    // Explicitly match the Deal model and select fields as needed
                    model: 'Deal'
                });

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

            // Find all JobCards where this user is the customer
            const jobCards = await JobCard.find({ customerId: userId })
                .populate([
                    { path: 'business', model: 'BusinessProfile', select: 'businessName businessType address contactNumber' },
                    { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' },
                ])
                .sort({ createdAt: -1 })
                .lean();

            return res.status(200).json({
                success: true,
                data: jobCards
            });
        } catch (error) {
            console.error("[getAllJobCards - CarOwner] Error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch JobCards", error: error.message });
        }
    };


}

  

export default UserController;
