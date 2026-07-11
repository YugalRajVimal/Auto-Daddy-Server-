import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import { User } from "../../Schema/user.schema.js";

/**
 * HomeProfileController
 * Handles: dashboard, profile completion, profile fetch/edit
 */
class HomeProfileController {
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
                profilePhoto,
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
                profilePhoto,
                favoriteAutoShopsIds: favoriteAutoShops
            });

        } catch (error) {
            console.error("[getProfileDetails] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    editProfile = async (req, res) => {
        try {
            const userId = req.user?.id;
            console.log("[editProfile] userId:", userId);

            if (!userId) {
                console.log("[editProfile] Unauthorized: No userId found.");
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Fetch the user and check role
            const user = await User.findById(userId).lean();
            console.log("[editProfile] User fetched:", !!user, user && { id: user._id, role: user.role });

            if (!user) {
                console.log("[editProfile] User not found for id:", userId);
                return res.status(404).json({ message: "User not found." });
            }

            // Only allow carowner users to edit their profile here
            if (user.role !== "carowner") {
                console.log("[editProfile] Forbidden: User is not a carowner. Role:", user.role);
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
                console.log("[editProfile] profilePhoto uploaded:", updateFields.profilePhoto);
            }

            console.log("[editProfile] updateFields:", updateFields);

            if (Object.keys(updateFields).length === 0) {
                console.log("[editProfile] No fields provided to update.");
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
                console.log("[editProfile] Checking if email already taken:", emailToCheck, !!existingUser);

                if (existingUser) {
                    console.log("[editProfile] Email already used by another user:", emailToCheck);
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

            console.log("[editProfile] updatedUser:", !!updatedUser, updatedUser && { id: updatedUser._id });

            if (!updatedUser) {
                console.log("[editProfile] User not found after update:", userId);
                return res.status(404).json({ message: "User not found." });
            }

            // Only return relevant info, still include phone in response (not updated)
            const {
                name, email, phone, countryCode, pincode, address, profilePhoto, city
            } = updatedUser;

            console.log("[editProfile] Returning success for user:", userId);

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
}

export default HomeProfileController;
