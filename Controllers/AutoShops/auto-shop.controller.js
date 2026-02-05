import mongoose from "mongoose";
import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import servicesSchema from "../../Schema/services.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";

class AutoShopController {



    //Profile
/**
 * Get current user's business profile.
 * Accessible to autoshopowner users. Assumes authentication middleware runs before this.
 */
async getProfile(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User ID missing from auth context." });
        }

        // Find user and populate businessProfile if it exists
        // Only fetch necessary fields for AutoShop owner
        const user = await User.findById(userId)
            .select("role businessProfile name email phone countryCode pincode address isAutoShopBusinessProfileComplete isProfileComplete isDisabled status createdAt updatedAt")
            .lean();
        if (!user || user.role !== "autoshopowner") {
            return res.status(404).json({ message: "Autoshopowner user not found." });
        }

        if (!user.businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();

        if (!businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Send both the businessProfile and user profile (excluding sensitive info like password)
        // Remove sensitive info if present
        const { password, ...userSafeProfile } = user;

        return res.status(200).json({ 
            success: true, 
            data: {
                businessProfile,
                userProfile: userSafeProfile
            }
        });
    } catch (error) {
        return res.status(500).json({ message: "Failed to get business profile", error: error.message });
    }
}

/**
 * Edit/update the current autoshopowner user's profile.
 * Only editable fields: name, email, countryCode, pincode, address
 * Does not allow editing phone or role.
 */
async editProfile(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Define which fields the autoshopowner can update
        const allowedFields = [
            "name", "email", "countryCode", "pincode", "address"
        ];

        // Collect the fields provided in the request body
        const updateFields = {};
        for (const key of allowedFields) {
            if (req.body[key] !== undefined) {
                updateFields[key] = req.body[key];
            }
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No profile fields provided to update." });
        }

        // Ensure user is autoshopowner before updating
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.role !== "autoshopowner") {
            return res.status(403).json({ message: "Forbidden. Only autoshopowner can edit this profile." });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found after update." });
        }

        // Return updated profile info (exclude confidential/sensitive data)
        const {
            name, email, phone, countryCode, pincode, address
        } = updatedUser;

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: { name, email, phone, countryCode, pincode, address }
        });
    } catch (error) {
        console.error("[editProfile - AutoShopController] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}



// async getAllAutoShops(req, res) {
//     try {
//         const autoShops = await AutoShopModel.find({});
//         res.status(200).json({ success: true, data: autoShops });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Failed to fetch auto shops', error: error.message });
//     }
// }

// Complete business profile for autoshopowner



async completeBusinessProfile(req, res) {
    let filesToDelete = [];
    let session = null;
    try {
        const userId = req.user?.id;
        console.log("[completeBusinessProfile] userId:", userId);

        // Validate user authentication
        if (!userId) {
            console.log("[completeBusinessProfile] No userId present in auth context");
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(401).json({ message: "Unauthorized. User ID missing from auth context." });
        }

        // Lookup user
        const user = await User.findById(userId);
        console.log("[completeBusinessProfile] User lookup result:", user ? "FOUND" : "NOT FOUND", user?._id || "");
        if (!user) {
            console.log("[completeBusinessProfile] No user found for userId:", userId);
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ message: "User not found." });
        }

        console.log("[completeBusinessProfile] User role:", user.role);
        if (user.role !== "autoshopowner") {
            console.log(`[completeBusinessProfile] User role not autoshopowner: ${user.role}`);
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(403).json({ message: "Only users with role 'autoshopowner' can complete a business profile." });
        }

        // Check if business profile is already complete
        if (user.isAutoShopBusinessProfileComplete && user.businessProfile) {
            console.log("[completeBusinessProfile] Business profile already completed for user:", userId);
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(400).json({ message: "Business profile already completed." });
        }

        // Extract business profile details (ignore businessMapLocation, parse lat/lng directly)
        let {
            businessName,
            businessAddress,
            pincode,
            businessPhone,
            businessEmail,
            businessHSTNumber,
            openHours,
            openDays,
            lat,
            lng,
        } = req.body;

        // Fallback for lat/lng as stringified JSON
        if (typeof lat === "string") {
            try {
                lat = parseFloat(lat);
            } catch {
                lat = undefined;
            }
        }
        if (typeof lng === "string") {
            try {
                lng = parseFloat(lng);
            } catch {
                lng = undefined;
            }
        }

        console.log("[completeBusinessProfile] Received business profile details: ", {
            businessName,
            businessAddress,
            pincode,
            lat,
            lng,
            businessPhone,
            businessEmail,
            businessHSTNumber,
            openHours,
            openDays,
        });

        // Required checks
        if (!businessName || !businessAddress || !pincode || !businessPhone || !businessEmail) {
            console.log("[completeBusinessProfile] Missing required fields", { businessName, businessAddress, pincode, businessPhone, businessEmail });
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(400).json({
                message: "Missing required fields: businessName, businessAddress, pincode, businessPhone, businessEmail"
            });
        }

        // Handle businessLogo (image upload via multer)
        let businessLogo = req.body.businessLogo;
        if (
            req.files &&
            req.files.businessLogo &&
            Array.isArray(req.files.businessLogo) &&
            req.files.businessLogo.length > 0
        ) {
            businessLogo = req.files.businessLogo[0].path;
            filesToDelete.push(req.files.businessLogo[0]);
            console.log("[completeBusinessProfile] Received new businessLogo:", businessLogo);
        } else {
            console.log("[completeBusinessProfile] No businessLogo uploaded via multer, using value from req.body");
        }

        // Prepare map location object using lat/lng
        let businessMapLocation = undefined;
        if ((lat !== undefined && lat !== null && lat !== "") || (lng !== undefined && lng !== null && lng !== "")) {
            businessMapLocation = {};
            if (lat !== undefined && lat !== null && lat !== "") businessMapLocation.lat = lat;
            if (lng !== undefined && lng !== null && lng !== "") businessMapLocation.lng = lng;
            // Remove if empty object
            if (Object.keys(businessMapLocation).length === 0) businessMapLocation = undefined;
        }

        // Prepare business profile data shaped according to businessProfileSchema
        const businessProfileDoc = {
            businessName,
            businessAddress,
            pincode,
            businessMapLocation,
            businessPhone,
            businessEmail,
            businessHSTNumber,
            openHours,
            openDays,
            businessLogo,
        };

        console.log("[completeBusinessProfile] Prepared businessProfileDoc for DB:", businessProfileDoc);

        // Start a MongoDB transaction
        session = await mongoose.startSession();
        session.startTransaction();

        let businessProfile;
        if (user.businessProfile) {
            console.log("[completeBusinessProfile] Updating existing businessProfile:", user.businessProfile);
            // Update existing
            businessProfile = await BusinessProfileModel.findByIdAndUpdate(
                user.businessProfile,
                { $set: businessProfileDoc },
                { new: true, session }
            );
        } else {
            // New business profile
            console.log("[completeBusinessProfile] Creating new businessProfile");
            businessProfile = new BusinessProfileModel(businessProfileDoc);
            await businessProfile.save({ session });
            user.businessProfile = businessProfile._id;
        }

        user.isAutoShopBusinessProfileComplete = true;
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        console.log("[completeBusinessProfile] Business profile completed successfully for user:", user._id);

        return res.status(200).json({
            success: true,
            message: "Business profile completed successfully.",
            businessProfile
        });

    } catch (error) {
        if (session) {
            try {
                await session.abortTransaction();
                session.endSession();
            } catch {}
        }
        // On error, clean up uploaded files if any (e.g. in multer upload)
        if (req.files) deleteUploadedFiles(req.files);

        console.error("[completeBusinessProfile] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Edit (update) business profile for autoshopowner.
 * Only allows editing of certain fields: (cannot edit name or HST number)
 */
async editBusinessProfile(req, res) {
    let filesToDelete = [];
    let session = null;
    try {
        const userId = req.user?.id;
        console.log("[editBusinessProfile] userId:", userId);

        // Validate user authentication
        if (!userId) {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(401).json({ message: "Unauthorized. User ID missing from auth context." });
        }

        // Lookup user and check role
        const user = await User.findById(userId);
        if (!user) {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ message: "User not found." });
        }

        if (user.role !== "autoshopowner") {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(403).json({ message: "Only users with role 'autoshopowner' can edit a business profile." });
        }

        // Must have an existing business profile
        if (!user.businessProfile) {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Fetch current business profile
        let businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Extract updatable fields from body (name and businessHSTNumber are NOT editable)
        let {
            businessAddress,
            pincode,
            longitude,
            latitude,
            businessPhone,
            businessEmail,
            openHours,
            openDays,
        } = req.body;

        // Handle businessLogo (image upload via multer)
        let businessLogo = businessProfile.businessLogo;
        if (
            req.files &&
            req.files.businessLogo &&
            Array.isArray(req.files.businessLogo) &&
            req.files.businessLogo.length > 0
        ) {
            // Optionally delete old logo file here (if desired)
            businessLogo = req.files.businessLogo[0].path;
            filesToDelete.push(req.files.businessLogo[0]);
        }

        // Parse longitude/latitude if sent as strings (ensure they're numbers or undefined)
        if (typeof longitude === "string") {
            longitude = parseFloat(longitude);
            if (isNaN(longitude)) longitude = undefined;
        }
        if (typeof latitude === "string") {
            latitude = parseFloat(latitude);
            if (isNaN(latitude)) latitude = undefined;
        }

        // Prepare update fields (only allowed fields)
        const updateData = {};

        if (businessAddress !== undefined) updateData.businessAddress = businessAddress;
        if (pincode !== undefined) updateData.pincode = pincode;
        // Only include longitude/latitude if BOTH are defined (not businessMapLocation)
        if (longitude !== undefined && latitude !== undefined) {
            updateData.longitude = longitude;
            updateData.latitude = latitude;
        }
        if (businessPhone !== undefined) updateData.businessPhone = businessPhone;
        if (businessEmail !== undefined) updateData.businessEmail = businessEmail;
        if (openHours !== undefined) updateData.openHours = openHours;
        if (openDays !== undefined) updateData.openDays = openDays;
        if (businessLogo !== undefined) updateData.businessLogo = businessLogo;

        // start a transaction
        session = await mongoose.startSession();
        session.startTransaction();

        // Update business profile document
        Object.assign(businessProfile, updateData);
        await businessProfile.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Business profile updated successfully.",
            businessProfile,
        });

    } catch (error) {
        if (session) {
            try {
                await session.abortTransaction();
                session.endSession();
            } catch {}
        }
        if (req.files) deleteUploadedFiles(req.files);

        console.error("[editBusinessProfile] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


//Team member

    // Add a team member to a business profile (photo as uploaded image)
    async addTeamMember(req, res) {
        try {
            const userId = req.user?.id;
            const { name, email, phone, designation } = req.body;
            // photo is expected in req.file (Multer), uploaded image
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            if (!name) {
                // Clean up upload
                if (req.file) deleteUploadedFile(req.file);
                return res.status(400).json({ message: "Name is required" });
            }

            const user = await User.findById(userId).populate("businessProfile");
       

            if (!user || !user.businessProfile) {
                if (req.file) deleteUploadedFile(req.file);
                return res.status(404).json({ message: "Business Profile not found" });
            }

            let photo = undefined;
            if (req.file) {
                // Store photo as relative path to the image
                photo = req.file.path.replace(/\\/g, "/"); // Normalize Windows paths
            }

            // Check if email or phone already exists among team members
            const existingTeamMembers = user.businessProfile.teamMembers || [];

            if (
                existingTeamMembers.some(
                    member =>
                        (email && member.email === email) ||
                        (phone && member.phone === phone)
                )
            ) {
                if (req.file) deleteUploadedFile(req.file);
                return res.status(400).json({ message: "A team member with this email or phone already exists." });
            }

            const teamMember = { name, email, phone, designation, photo };

            user.businessProfile.teamMembers.push(teamMember);
            await user.businessProfile.save();

            return res.status(200).json({
                message: "Team member added successfully.",
                teamMembers: user.businessProfile.teamMembers
            });
        } catch (error) {
            if (req.file) deleteUploadedFile(req.file);
            console.error("[addTeamMember] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Fetch team members from a business profile
    async fetchTeamMembers(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            const user = await User.findById(userId).populate("businessProfile");
            if (!user || !user.businessProfile) {
                return res.status(404).json({ message: "Business Profile not found" });
            }

            return res.status(200).json({
                teamMembers: user.businessProfile.teamMembers || []
            });
        } catch (error) {
            console.error("[fetchTeamMembers] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Delete a team member by ID from a business profile (deletes photo image file if present)
    async deleteTeamMember(req, res) {
        try {
            const userId = req.user?.id;
            const { memberId } = req.params; // expects /team-members/:memberId
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            if (!memberId) {
                return res.status(400).json({ message: "Member ID is required" });
            }

            const user = await User.findById(userId).populate("businessProfile");
            if (!user || !user.businessProfile) {
                return res.status(404).json({ message: "Business Profile not found" });
            }

            const teamMembers = user.businessProfile.teamMembers;
            const member = teamMembers.id(memberId);

            if (!member) {
                return res.status(404).json({ message: "Team member not found" });
            }

            // If the member has a photo, delete the uploaded file
            if (member.photo) {
                deleteUploadedFile({ path: member.photo });
            }

            member.deleteOne(); // Remove embedded document
            await user.businessProfile.save();

            return res.status(200).json({
                message: "Team member deleted successfully.",
                teamMembers: user.businessProfile.teamMembers
            });
        } catch (error) {
            console.error("[deleteTeamMember] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Edit (update) a team member's info in a business profile (photo as uploaded image)
    async editTeamMember(req, res) {
        try {
            const userId = req.user?.id;
            const { memberId } = req.params; // expects /team-members/:memberId
            const { name, email, phone, designation } = req.body;
            // new photo is expected in req.file (Multer)
            if (!userId) {
                if (req.file) deleteUploadedFile(req.file);
                return res.status(401).json({ message: "Unauthorized" });
            }
            if (!memberId) {
                if (req.file) deleteUploadedFile(req.file);
                return res.status(400).json({ message: "Member ID is required" });
            }

            const user = await User.findById(userId).populate("businessProfile");
            if (!user || !user.businessProfile) {
                if (req.file) deleteUploadedFile(req.file);
                return res.status(404).json({ message: "Business Profile not found" });
            }

            const teamMember = user.businessProfile.teamMembers.id(memberId);
            if (!teamMember) {
                if (req.file) deleteUploadedFile(req.file);
                return res.status(404).json({ message: "Team member not found" });
            }

            // If editing phone or email, check for duplicates among other team members
            if ((phone !== undefined && phone !== teamMember.phone) || (email !== undefined && email !== teamMember.email)) {
                // Check for phone/email uniqueness within other teamMembers (exclude current member)
                const otherTeamMembers = user.businessProfile.teamMembers.filter(m => m._id.toString() !== memberId);

                if (phone !== undefined && phone !== "") {
                    const phoneExists = otherTeamMembers.some(m => m.phone && m.phone === phone);
                    if (phoneExists) {
                        if (req.file) deleteUploadedFile(req.file);
                        return res.status(400).json({ message: "Phone must be unique among team members." });
                    }
                }

                if (email !== undefined && email !== "") {
                    const emailExists = otherTeamMembers.some(m => m.email && m.email === email);
                    if (emailExists) {
                        if (req.file) deleteUploadedFile(req.file);
                        return res.status(400).json({ message: "Email must be unique among team members." });
                    }
                }
            }

            // Update available fields only
            if (name !== undefined) teamMember.name = name;
            if (email !== undefined) teamMember.email = email;
            if (phone !== undefined) teamMember.phone = phone;
            if (designation !== undefined) teamMember.designation = designation;

            // Handle new photo upload, delete old photo if replaced
            if (req.file) {
                // Delete old photo if present
                if (teamMember.photo) {
                    deleteUploadedFile({ path: teamMember.photo });
                }
                teamMember.photo = req.file.path.replace(/\\/g, "/");
            }

            await user.businessProfile.save();

            return res.status(200).json({
                message: "Team member updated successfully.",
                teamMember
            });
        } catch (error) {
            if (req.file) deleteUploadedFile(req.file);
            console.error("[editTeamMember] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }


// Search car owners by name, phone, or email
searchCarOwner = async (req, res) => {
    try {
        const { name, phone, email } = req.query;

        if (!name && !phone && !email) {
            return res.status(400).json({ message: "At least one search parameter (name, phone, or email) is required." });
        }

        // Construct query object
        const searchQuery = { role: "carowner" };

        if (name) {
            // Case insensitive, partial match for name
            searchQuery.name = { $regex: name, $options: "i" };
        }
        if (phone) {
            searchQuery.phone = phone;
        }
        if (email) {
            searchQuery.email = email;
        }

        // Assuming there is a User model imported at the top
        const users = await User.find(searchQuery, { name: 1, phone: 1, email: 1, _id: 1 });

        return res.status(200).json({
            message: "Car owner(s) found.",
            data: users
        });
    } catch (error) {
        console.error("[searchCarOwner] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


// Adds a carowner to the autoshopowner's myCustomers array, if not already present
addToMyCustomers = async (req, res) => {
    try {
        const autoshopOwnerId = req.user?.id;
        const { carOwnerId } = req.body;

        if (!autoshopOwnerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        if (!carOwnerId) {
            return res.status(400).json({ message: "carOwnerId is required." });
        }

        // Find the car owner by id, and check role
        const carOwner = await User.findOne({ _id: carOwnerId, role: "carowner" });
        if (!carOwner) {
            return res.status(404).json({ message: "Car owner not found." });
        }

        // Only allow autoshopowner to add to myCustomers
        const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" });
        if (!autoshopOwner) {
            return res.status(403).json({ message: "Forbidden. Only autoshopowners can add customers." });
        }

        // Add the carOwnerId to autoshopOwner.myCustomers if not already present
        const updateResult = await User.findByIdAndUpdate(
            autoshopOwnerId,
            { $addToSet: { myCustomers: carOwnerId } }, // $addToSet avoids duplicates
            { new: true }
        ).lean();

        return res.status(200).json({
            message: "Car owner added to myCustomers successfully.",
            myCustomers: updateResult.myCustomers
        });
    } catch (error) {
        console.error("[addToMyCustomers] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


// Fetch the autoshopowner's current myCustomers (list of carowners, with some user details)
fetchMyCustomers = async (req, res) => {
    try {
        const autoshopOwnerId = req.user?.id;

        if (!autoshopOwnerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        // Find the autoshopowner and populate myCustomers with their vehicles
        const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" })
            .populate({
                path: "myCustomers",
                select: "name email phone countryCode status isDisabled",
                populate: [
                    {
                        path: "myVehicles",
                        model: "Vehicle",
                        select: "-carImages -licensePlateFrontImagePath -licensePlateBackImagePath"
                    }
                ]
            })
            .lean();

        if (!autoshopOwner) {
            return res.status(404).json({ message: "Auto shop owner not found." });
        }

        return res.status(200).json({
            myCustomers: autoshopOwner.myCustomers || [],
        });
    } catch (error) {
        console.error("[fetchMyCustomers] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

removeFromMyCustomers = async (req, res) => {
    try {
        const autoshopOwnerId = req.user?.id;
        const { carOwnerId } = req.body;

        if (!autoshopOwnerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        if (!carOwnerId) {
            return res.status(400).json({ message: "carOwnerId is required." });
        }

        // Remove the carOwnerId from autoshopOwner's myCustomers array
        const updateResult = await User.findByIdAndUpdate(
            autoshopOwnerId,
            { $pull: { myCustomers: carOwnerId } },
            { new: true }
        ).lean();

        if (!updateResult) {
            return res.status(404).json({ message: "Auto shop owner not found." });
        }

        return res.status(200).json({
            message: "Car owner removed from myCustomers successfully.",
            myCustomers: updateResult.myCustomers
        });
    } catch (error) {
        console.error("[removeFromMyCustomers] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


/**
 * Onboard a car owner with name, email, phone, pincode, role, address.
 * After successful creation, send OTP (default: 000000).
 * POST /autoshop/onboard-carowner
 * Body: { name, email, phone, countryCode, pincode, role, address }
 */
onboardCarOwner = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            countryCode,
            pincode,
            role,
            address,
            licensePlateNo,
            vinNo,
            vehicleName, // optional—may be undefined
            model,
            year,
            odometerReading
        } = req.body;

        // Only require main fields for car owner, NOT vehicle
        if (
            !name ||
            !email ||
            !phone ||
            !countryCode ||
            !pincode ||
            !role ||
            !address
        ) {
            return res.status(400).json({
                message: "All owner fields (name, email, phone, countryCode, pincode, role, address) are required.",
            });
        }

        // Only allow role carowner
        if (role !== "carowner") {
            return res.status(400).json({
                message: "Only role 'carowner' is allowed for onboarding via this endpoint.",
            });
        }

        // Check if ANY user (not just carowners) exists with this email or phone/countryCode
        if (email) {
            const existingEmailUser = await User.findOne({ email: email });
            if (existingEmailUser) {
                return res.status(409).json({
                    message: "A user with this email already exists.",
                    userId: existingEmailUser._id
                });
            }
        }
        if (phone && countryCode) {
            const existingPhoneUser = await User.findOne({ phone: phone, countryCode: countryCode });
            if (existingPhoneUser) {
                return res.status(409).json({
                    message: "A user with this phone and country code already exists.",
                    userId: existingPhoneUser._id
                });
            }
        }

        // Default OTP
        const otp = "000000";
        const expiresInMs = 1000 * 600; // 10 min
        const otpExpiresAt = new Date(Date.now() + expiresInMs);

        // Get autoshop owner ID from the JWT-authenticated user
        const onboardedBy = req.user?.id || null;

        // -- Create the CAROWNER first
        const newCarOwner = await User.create({
            name,
            email,
            phone,
            countryCode,
            pincode,
            role,
            address,
            isProfileComplete: true,
            otp,
            otpExpiresAt,
            otpGeneratedAt: new Date(),
            otpAttempts: 0,
            onboardedBy
        });

        let newVehicle = null;

        // If vehicle fields present (at least one of licensePlateNo, vinNo, vehicleName, model, year)
        if (
            licensePlateNo ||
            vinNo ||
            vehicleName ||
            model ||
            year
        ) {
            // Only add non-null/undefined fields to the payload for Vehicle
            const vehiclePayload = {};
            if (licensePlateNo !== undefined) vehiclePayload.licensePlateNo = licensePlateNo;
            if (vinNo !== undefined) vehiclePayload.vinNo = vinNo;
            if (vehicleName !== undefined) vehiclePayload.make = { ...vehiclePayload.make, name: vehicleName };
            if (model !== undefined) vehiclePayload.make = { ...vehiclePayload.make, model: model };
            if (year !== undefined) vehiclePayload.year = year;
            if (odometerReading !== undefined) vehiclePayload.odometerReading = odometerReading;

            // For Vehicle schema, both make.name and make.model are required
            // Only create vehicle if all required vehicle fields are present
            if (
                vehiclePayload.licensePlateNo &&
                vehiclePayload.vinNo &&
                vehiclePayload.make &&
                vehiclePayload.make.name &&
                vehiclePayload.make.model &&
                vehiclePayload.year
            ) {
                newVehicle = await VehicleModel.create(vehiclePayload);

                // -- Now link vehicle to car owner (push to their myVehicles array)
                newCarOwner.myVehicles = newCarOwner.myVehicles || [];
                newCarOwner.myVehicles.push(newVehicle._id);
                await newCarOwner.save();
            }
        }

        return res.status(201).json({
            message: "Car owner onboarded successfully. OTP sent.",
            otp: otp,
            carOwner: {
                id: newCarOwner._id,
                name: newCarOwner.name,
                email: newCarOwner.email,
                phone: newCarOwner.phone,
                countryCode: newCarOwner.countryCode,
                pincode: newCarOwner.pincode,
                role: newCarOwner.role,
                address: newCarOwner.address,
                isProfileComplete: newCarOwner.isProfileComplete,
                status: newCarOwner.status,
                onboardedBy: newCarOwner.onboardedBy,
                vehicle: newVehicle
                    ? {
                        id: newVehicle._id,
                        licensePlateNo: newVehicle.licensePlateNo,
                        vinNo: newVehicle.vinNo,
                        name: newVehicle.make?.name,
                        model: newVehicle.make?.model,
                        year: newVehicle.year,
                        odometerReading: newVehicle.odometerReading
                    }
                    : null
            },
        });
    } catch (error) {
        console.error("[onboardCarOwner] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

/**
 * Verifies an onboarded car owner by matching the provided phone number and OTP.
 * - Expects: { phone, otp }
 * - Phone and otp are both required.
 */
verifyOnboardedCarowner = async (req, res) => {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { phone, otp, countryCode } = req.body;

        // Require phone, countryCode, and otp
        if (!phone || !otp || !countryCode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Phone, country code, and OTP are required." });
        }

        // Normalize inputs
        const trimmedPhone = phone.trim();
        const normalizedCountryCode = countryCode.trim().replace(/^\+/, "");

        // Find the user by phone and countryCode together (and isProfileComplete)
        const carOwner = await User.findOne({
            phone: trimmedPhone,
            countryCode: countryCode,
            isProfileComplete: true,
        }).session(session);

        if (!carOwner) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Car owner not found." });
        }

        // Check for OTP expiry and validity
        if (!carOwner.otp || !carOwner.otpExpiresAt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "OTP not available. Please request a new OTP." });
        }
        if (carOwner.otp !== otp) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Invalid OTP." });
        }
        if (carOwner.otpExpiresAt < new Date()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
        }

        // Mark phone as verified if not already
        if (!carOwner.phoneVerified) carOwner.phoneVerified = true;

        // Clear OTP fields after successful verification
        carOwner.otp = null;
        carOwner.otpExpiresAt = null;
        carOwner.otpGeneratedAt = null;
        carOwner.otpAttempts = 0;
        await carOwner.save({ session });

        // --- Add this car owner to the autoshop owner's myCustomers array ---
        // Identify autoshop owner from req.user?.id
        const autoshopOwnerId = req.user?.id;
        console.log("[verifyOnboardedCarowner] autoshopOwnerId:", autoshopOwnerId);

        if (autoshopOwnerId) {
            // Fetch the autoshop owner user document
            const autoshopOwner = await User.findById(autoshopOwnerId).session(session);
            console.log("[verifyOnboardedCarowner] autoshopOwner found:", !!autoshopOwner, "ID:", autoshopOwner?._id);

            if (autoshopOwner) {
                // Allocate: add carOwner._id to myCustomers if not present
                if (!autoshopOwner.myCustomers) autoshopOwner.myCustomers = [];
                const alreadyExists = autoshopOwner.myCustomers.some(id => id.equals(carOwner._id));
                console.log("[verifyOnboardedCarowner] carOwner._id already in myCustomers:", alreadyExists);

                if (!alreadyExists) {
                    autoshopOwner.myCustomers.push(carOwner._id);
                    await autoshopOwner.save({ session });
                    console.log("[verifyOnboardedCarowner] carOwner._id added to myCustomers:", carOwner._id);
                }
            }
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            message: "Car owner verified successfully.",
            carOwner: {
                id: carOwner._id,
                name: carOwner.name,
                email: carOwner.email,
                phone: carOwner.phone,
                countryCode: carOwner.countryCode,
                status: carOwner.status,
                phoneVerified: carOwner.phoneVerified,
            }
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("[verifyOnboardedCarowner] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};





/**
 * Add services (and subservices) to current auto shop's business profile.
 * Expects req.user to be authenticated autoshopowner and req.body.services as described.
 */

/**
 * Fetch all services (and selected subservices) for the current auto shop's business profile.
 * Lists the "myServices" array with full service and subservice details.
 * Requires req.user to be authenticated autoshopowner.
 */
async getAllMyServices(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User ID missing." });
        }

        // Find the autoshopowner with their businessProfile populated
        const user = await User.findById(userId).select("businessProfile role").lean();
        if (!user || user.role !== "autoshopowner") {
            return res.status(404).json({ message: "AutoShop owner not found." });
        }
        if (!user.businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Get the business profile with myServices array
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        if (!businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        const myServices = businessProfile.myServices || [];

        // Prepare a list of unique service IDs to fetch
        const serviceIds = myServices.map(ms => ms.service);

        // Fetch all services from the master service schema
        const servicesData = await servicesSchema.find({ _id: { $in: serviceIds } }).lean();

        // Create a map: serviceId -> serviceDoc for easy lookup
        const servicesMap = {};
        for (const service of servicesData) {
            servicesMap[service._id.toString()] = service;
        }

        // For each myService, fetch service name/details and subservice details
        const result = myServices.map(ms => {
            const serviceDoc = servicesMap[ms.service?.toString()];
            // Map selected subservices (from myService) to full subservice details
            let selectedSubServices = [];
            if (serviceDoc && Array.isArray(ms.subServices)) {
                const allSubservices = serviceDoc.services || [];
                selectedSubServices = ms.subServices
                    .map(selSub => {
                        // selSub may have subService field as ObjectId or string
                        const subId = selSub.subService?.toString ? selSub.subService.toString() : selSub.subService;
                        return allSubservices.find(sub => sub._id.toString() === subId);
                    })
                    .filter(Boolean);
            }
            return {
                service: {
                    id: serviceDoc?._id,
                    name: serviceDoc?.name,
                    desc: serviceDoc?.desc
                },
                selectedSubServices: selectedSubServices.map(sub => ({
                    id: sub._id,
                    name: sub.name,
                    desc: sub.desc,
                    price: sub.price
                }))
            };
        });

        return res.status(200).json({
            success: true,
            services: result
        });
    } catch (error) {
        console.error("[getAllMyServices] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


async addToMyServices(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User ID missing." });
        }

        // Find the autoshopowner with their businessProfile populated
        const user = await User.findById(userId).select("businessProfile role").lean();
        if (!user || user.role !== "autoshopowner") {
            return res.status(404).json({ message: "AutoShop owner not found." });
        }
        if (!user.businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Validate and parse input
        const { services } = req.body;
        if (!Array.isArray(services) || services.length === 0) {
            return res.status(400).json({ message: "services (array) is required in request body." });
        }

        // Validate all subServices exist in their respective Service (from services schema)
        for (const serviceBlock of services) {
            if (!serviceBlock.id) {
                return res.status(400).json({ message: "All entries in services must have an id (service Id)." });
            }

            const serviceDoc = await servicesSchema.findById(serviceBlock.id).lean();
            if (!serviceDoc) {
                return res.status(400).json({ message: `Service with id "${serviceBlock.id}" does not exist.` });
            }

            if (Array.isArray(serviceBlock.services) && serviceBlock.services.length > 0) {
                // Make a set of valid subservice _ids as strings
                const validSubIds = new Set((serviceDoc.services || []).map(sub => sub._id.toString()));
                for (const subId of serviceBlock.services) {
                    if (!validSubIds.has(subId.toString())) {
                        return res.status(400).json({
                            message: `SubService with id "${subId}" does not exist inside Service "${serviceBlock.id}".`
                        });
                    }
                }
            }
        }

        // Get the latest business profile (not lean so we can update)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Build a map of present services and subservices
        // present: { [serviceId]: Set of subServiceIds }
        const present = {};
        for (const entry of businessProfile.myServices) {
            if (!entry.service) continue;
            const sId = entry.service.toString();
            if (!present[sId]) present[sId] = new Set();
            for (const subObj of (entry.subServices||[])) {
                if (subObj && subObj.subService) present[sId].add(subObj.subService.toString());
            }
        }

        // Only add services and subservices that are NOT already present
        for (const serviceBlock of services) {
            const serviceId = serviceBlock.id?.toString();
            if (!serviceId) continue;
            const inputSubIds = Array.isArray(serviceBlock.services) 
                ? serviceBlock.services.map(id => id.toString())
                : [];

            let myServiceObj = businessProfile.myServices.find(ms => ms.service.toString() === serviceId);

            // If service doesn't exist at all and no subservices are present, add entire service with all its subservices from request
            if (!myServiceObj) {
                businessProfile.myServices.push({
                    service: serviceBlock.id,
                    subServices: inputSubIds.map(subId => ({ subService: subId }))
                });
                // Mark them as present now for deduplication if duplicates in array
                present[serviceId] = new Set(inputSubIds);
                continue;
            }

            // Service already exists. Only add subservices that are not present
            const alreadyPresentSubs = present[serviceId] || new Set();
            let added = false;
            for (const subId of inputSubIds) {
                if (!alreadyPresentSubs.has(subId)) {
                    myServiceObj.subServices.push({ subService: subId });
                    alreadyPresentSubs.add(subId);
                    added = true;
                }
            }
            // If all subservices were already present, nothing will be added
        }

        await businessProfile.save();

        return res.status(200).json({ success: true, message: "Services added successfully.", myServices: businessProfile.myServices });
    } catch (error) {
        console.error("[addToMyServices] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Remove services (and/or subservices) from current auto shop's business profile.
 * Expects req.user to be authenticated autoshopowner and req.body.services as described.
 */
async removeFromMyServices(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User ID missing." });
        }

        // Find the autoshopowner with their businessProfile populated
        const user = await User.findById(userId).select("businessProfile role").lean();
        if (!user || user.role !== "autoshopowner") {
            return res.status(404).json({ message: "AutoShop owner not found." });
        }
        if (!user.businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        const { services } = req.body;
        if (!Array.isArray(services) || services.length === 0) {
            return res.status(400).json({ message: "services (array) is required in request body." });
        }

        // Build removal map: serviceId -> Set of subServiceIds (if array empty, remove whole service)
        const toRemove = {};
        for (const s of services) {
            const serviceId = s.id;
            if (!serviceId) continue;
            toRemove[serviceId] = Array.isArray(s.services) ? new Set(s.services) : new Set();
        }

        // Edit business profile
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Filter myServices according to removal plan
        businessProfile.myServices = businessProfile.myServices.filter(ms => {
            const svcId = ms.service.toString();
            if (!toRemove[svcId]) return true; // Not targeted for removal

            const subServicesToRemove = toRemove[svcId];
            if (!subServicesToRemove.size) {
                // No subServices array—instructed to remove whole service
                return false;
            }

            // Remove specific subServices
            ms.subServices = (ms.subServices||[]).filter(ss => !subServicesToRemove.has(ss.subService.toString()));

            // If after removal this service has no subServices left, remove service entirely
            return ms.subServices.length > 0;
        });

        await businessProfile.save();

        return res.status(200).json({ success: true, message: "Services removed successfully.", myServices: businessProfile.myServices });
    } catch (error) {
        console.error("[removeFromMyServices] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// DEALS HANDLING SECTION

/**
 * Create a new deal and link it to the creator's business profile.
 * - Adds the deal's _id to BusinessProfile.myDeals.
 * - Sets Deal.createdBy to businessProfile._id.
 */
async createDeal(req, res) {
    try {
        const id = req.user.id;

        // Fetch the user to get their businessProfile
        const user = await User.findById(id).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Fetch the business profile for this user (requirement: user.businessProfile must exist)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }

        const {
            name,
            description,
            value,
            valueId,
            percentageDiscount,
            dealEnabled,
            startDate,
            endDate,
            additionalDetails,
            couponCode, // <-- Coupon code is mandatory now
        } = req.body;

        // Validate mandatory fields
        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof value !== "string" ||
            !value.trim() ||
            typeof percentageDiscount !== "number" ||
            typeof couponCode !== "string" ||
            !couponCode.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "name (string), value (string), percentageDiscount (number), and couponCode (string) are required.",
            });
        }

        // Validate value (must be one of the allowed enum values)
        const allowedValues = ["services", "subservices", "all"];
        if (!allowedValues.includes(value)) {
            return res.status(400).json({
                success: false,
                message: `value must be one of: ${allowedValues.join(", ")}`,
            });
        }

        // Check couponCode uniqueness in this business profile
        const existingDealWithCoupon = await DealModel.findOne({
            couponCode: couponCode.trim(),
            createdBy: businessProfile._id,
        }).lean();

        if (existingDealWithCoupon) {
            return res.status(400).json({
                success: false,
                message: "A deal with the same coupon code already exists in your business profile."
            });
        }

        // Service or subservice existence validation imports
        let servicesSchema;
        try {
            servicesSchema = (await import("../../Schema/services.schema.js")).default;
        } catch (err) {
            console.error("Failed to import services schema:", err);
            return res.status(500).json({ success: false, message: "Internal Server Error (import failure)" });
        }

        // If value is 'services' or 'subservices', valueId must be a valid ObjectId and checked in services schema
        let processedValueId = undefined;

        if (value === "services" || value === "subservices") {
            if (!valueId || typeof valueId !== "string") {
                return res.status(400).json({
                    success: false,
                    message: `valueId (string/ObjectId) is required when value is "${value}".`,
                });
            }
            const mongoose = (await import('mongoose')).default;
            if (!mongoose.Types.ObjectId.isValid(valueId)) {
                return res.status(400).json({
                    success: false,
                    message: `valueId "${valueId}" is not a valid ObjectId.`,
                });
            }
            processedValueId = valueId;

            if (value === "services") {
                // Check if this service exists in the master services collection
                const service = await servicesSchema.findById(valueId).lean();
                if (!service) {
                    return res.status(400).json({
                        success: false,
                        message: `Service with id "${valueId}" does not exist.`,
                    });
                }

                // ===== BusinessProfile MyServices Presence Check =====
                // Check if the service is present in the business profile's myServices
                const existsInMyServices = (businessProfile.myServices || []).some(
                    (myService) => myService.service && myService.service.toString() === valueId
                );
                if (!existsInMyServices) {
                    return res.status(400).json({
                        success: false,
                        message: `Service with id "${valueId}" is not present in your BusinessProfile myServices, so you cannot create a deal for it.`,
                    });
                }
                // ===================================================
            } else if (value === "subservices") {
                // For subservices, find a service that has a subservice with this _id in its 'services' array
                const parent = await servicesSchema.findOne({
                    "services._id": valueId
                }).lean();
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        message: `SubService with id "${valueId}" does not exist in any service.`,
                    });
                }

                // ===== BusinessProfile MyServices and SubService Presence Check =====
                // Check if the parent service present in business profile's myServices
                const myServiceObj = (businessProfile.myServices || []).find(
                    (myService) => myService.service && myService.service.toString() === parent._id.toString()
                );
                if (!myServiceObj) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot create a deal: The parent Service containing your SubService is not present in your BusinessProfile myServices.`,
                    });
                }
                // Check if the subService id is in the myServiceObj.subServices
                const foundSubService = (myServiceObj.subServices || []).some(
                    (sub) => sub.subService && sub.subService.toString() === valueId
                );
                if (!foundSubService) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot create a deal: The requested SubService with id "${valueId}" is not present in your BusinessProfile myServices for Service "${parent._id}".`,
                    });
                }
                // ===================================================
            }
        }
        // If value is 'all', valueId must be undefined or ignored
        if (value === "all" && valueId) {
            return res.status(400).json({
                success: false,
                message: "valueId should not be provided when value is 'all'."
            });
        }

        // Prepare deal object for mongoose
        const dealData = {
            name,
            description,
            value,
            percentageDiscount,
            dealEnabled: dealEnabled !== undefined ? dealEnabled : false,
            startDate,
            endDate,
            additionalDetails,
            createdBy: businessProfile._id,
            couponCode, // Coupon code is mandatory, so always include
        };
        if (processedValueId) dealData.valueId = processedValueId;

        const deal = new DealModel(dealData);
        await deal.save();

        // Add newly created deal to the business's myDeals
        businessProfile.myDeals = businessProfile.myDeals || [];
        businessProfile.myDeals.push(deal._id);
        await businessProfile.save();

        return res.status(201).json({
            success: true,
            message: "Deal created successfully",
            data: deal
        });
    } catch (error) {
        console.error("[createDeal] Error:", error);
        // For Mongoose validation errors provide more details
        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: "Validation error creating deal",
                error: error.message
            });
        }
        return res.status(500).json({
            success: false,
            message: "Error creating deal",
            error: error.message
        });
    }
}

/**
 * Edit an existing deal (only if the current business profile created it).
 * - Only allows update if the deal's createdBy matches the user's businessProfile.
 * - Does not update createdBy.
 */
async editDeal(req, res) {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Fetch the business profile for this user (requirement: user.businessProfile must exist)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        
        const businessProfileId = businessProfile._id;

        const { id } = req.params;
        const updateData = { ...req.body };
        // Prevent changing createdBy
        delete updateData.createdBy;

        // Ensure deal belongs to this business profile
        const deal = await DealModel.findOneAndUpdate(
            { _id: id, createdBy: businessProfileId },
            updateData,
            { new: true }
        );
        if (!deal) {
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }
        return res.status(200).json({ success: true, message: "Deal updated", data: deal });
    } catch (error) {
        console.error("[editDeal] Error:", error);
        return res.status(500).json({ success: false, message: "Error updating deal", error: error.message });
    }
}

/**
 * Delete a deal by ID (only if created by the current business profile).
 * - Also removes the deal's _id from BusinessProfile.myDeals.
 */
async deleteDeal(req, res) {
    try {
       const userId = req.user.id;

        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Fetch the business profile for this user (requirement: user.businessProfile must exist)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        
        const businessProfileId = businessProfile._id;
        
        const { id } = req.params;

        // Only delete if created by this business profile
        const deal = await DealModel.findOneAndDelete({ _id: id, createdBy: businessProfileId });
        if (!deal) {
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }

        // Remove deal from myDeals array of the business profile
        await BusinessProfileModel.findByIdAndUpdate(
            businessProfileId,
            { $pull: { myDeals: deal._id } }
        );

        return res.status(200).json({ success: true, message: "Deal deleted" });
    } catch (error) {
        console.error("[deleteDeal] Error:", error);
        return res.status(500).json({ success: false, message: "Error deleting deal", error: error.message });
    }
}

/**
 * Fetch all deals for the current business profile (BusinessProfile.myDeals).
 * - Populates the actual Deal documents.
 */
async fetchMyDeals(req, res) {
    try {


        const id = req.user.id;

        // Fetch the user to get their businessProfile
        const user = await User.findById(id).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Fetch the business profile for this user (requirement: user.businessProfile must exist)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile)
        .populate("myDeals");
        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
       

    
        // Return all deals in myDeals
        return res.status(200).json({
            success: true,
            data: businessProfile.myDeals || []
        });

    } catch (error) {
        console.error("[fetchMyDeals] Error:", error);
        return res.status(500).json({ success: false, message: "Error fetching deals", error: error.message });
    }
}

/**
 * Fetch Job Card Page for the current business, including:
 * - MyCustomers with their vehicle details,
 * - My Services,
 * - My Deals.
 *
 * Expects the current authenticated user (`req.user`) to have a `businessProfile`.
 */
async fetchJobCardPage(req, res) {
    try {
        const userId = req.user.id;

        // Fetch user with businessProfile and populate customers/vehicles
        const user = await User.findById(userId).populate({
            path: "myCustomers",
            populate: { path: "myVehicles", model: "Vehicle" }
        }).lean();
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found for user" });
        }

        // Get the business profile with myDeals, and myServices.service (for service name & desc)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile)
            .populate({
                path: "myServices.service",
                select: "name desc" // Only fetch the name/desc, not the full subservices array
            })
            .populate("myDeals")
            .lean();

        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }

        // For each myService in myServices, populate a subServices array with the actual subService objects
        if (businessProfile.myServices && Array.isArray(businessProfile.myServices)) {
            // Get all unique service ids
            const serviceIds = businessProfile.myServices.map(ms => ms.service?._id).filter(Boolean);
            const allServiceDocs = await (await import("../../Schema/services.schema.js")).default.find({
                _id: { $in: serviceIds }
            }).lean();

            // Map serviceId -> serviceDoc
            const serviceMap = {};
            allServiceDocs.forEach(serviceDoc => {
                serviceMap[serviceDoc._id.toString()] = serviceDoc;
            });

            businessProfile.myServices = businessProfile.myServices.map(myService => {
                const serviceDoc = serviceMap[myService.service?._id?.toString()];
                if (!serviceDoc || !Array.isArray(myService.subServices)) {
                    return {
                        ...myService,
                        subServices: []
                    };
                }
                const selectedSubServiceIds = (myService.subServices || []).map(s => s.subService?.toString());
                // Populate subServices array in the same place, with only the matching subService objects
                const populatedSubServices = (serviceDoc.services || []).filter(sub =>
                    selectedSubServiceIds.includes(sub._id.toString())
                );
                // For compatibility: insert the actual subService docs into .subServices
                return {
                    ...myService,
                    service: {
                        _id: serviceDoc._id,
                        name: serviceDoc.name,
                        desc: serviceDoc.desc
                    },
                    subServices: populatedSubServices
                };
            });
        }

        // Structure the response payload with cleaned myServices
        return res.status(200).json({
            success: true,
            data: {
                myCustomers: user.myCustomers || [],
                myServices: businessProfile.myServices || [],
                myDeals: businessProfile.myDeals || []
            }
        });
    } catch (error) {
        console.error("[fetchJobCardPage] Error:", error);
        return res.status(500).json({ success: false, message: "Error fetching job card page", error: error.message });
    }
}




/**
 * Create a JobCard for an auto shop owner.
 * Validates:
 *   - customerId is a customer of this AutoShop
 *   - vehicleId is present in customer's vehicles
 *   - serviceType and priorityLevel enums are valid
 *   - All services/subServices exist in this BusinessProfile's myServices
 * Returns: Created JobCard document
 */

async createJobCard(req, res) {
    // Accept vehiclePhotos from file uploads (multer) via req.files["vehiclePhotos"]
    // If there is an error anywhere that requires aborting, cleanup file uploads!

    try {
        if (typeof req.body.services === "string") {
            try {
                req.body.services = JSON.parse(req.body.services);
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid services JSON format"
                });
            }
        }

        const {
            customerId,
            vehicleId,
            odometerReading,
            issueDescription,
            serviceType,
            priorityLevel,
            services,
            additionalNotes,
            technicalRemarks,
            dealCode // Accept dealCode from the body (coupon code)
        } = req.body;

        if (typeof req.body.services === "string") {
            req.body.services = JSON.parse(req.body.services);
        }

        // Get the uploaded files from req.files["vehiclePhotos"], array of file objects (if any)
        let uploadedPhotos = [];
        if (req.files && req.files["vehiclePhotos"]) {
            if (Array.isArray(req.files["vehiclePhotos"])) {
                uploadedPhotos = req.files["vehiclePhotos"];
            } else if (req.files["vehiclePhotos"]) {
                uploadedPhotos = [req.files["vehiclePhotos"]];
            }
        }
        const vehiclePhotos = uploadedPhotos.map(f => f.path || f.location || f.filename).filter(Boolean);
        

        // Validate basic required fields
        const missingFields = [];
        if (!customerId) missingFields.push("customerId");
        if (!vehicleId) missingFields.push("vehicleId");
        if (!serviceType) missingFields.push("serviceType");
        if (!priorityLevel) missingFields.push("priorityLevel");
        if (!Array.isArray(services)) missingFields.push("services");

        if (missingFields.length > 0) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(", ")}`
            });
        }

        // Validate enums
        const allowedServiceTypes = ['Repair', 'Maintenance', 'Inspection'];
        const allowedPriorityLevels = ['Normal', 'Urgent'];
        if (!allowedServiceTypes.includes(serviceType)) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Invalid serviceType" });
        }
        if (!allowedPriorityLevels.includes(priorityLevel)) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Invalid priorityLevel" });
        }
        if (vehiclePhotos.length > 5) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Maximum 5 vehiclePhotos allowed" });
        }

        // 1. Find user/customer and check if customerId belongs to this workshop's customers
        const user = await User.findById(req.user.id);
        if (!user) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(404).json({ success: false, message: "AutoShop owner user not found" });
        }
        const myCustomersList = Array.isArray(user.myCustomers)
            ? user.myCustomers.map(c => c.customer?._id?.toString() || c._id?.toString() || c.toString())
            : [];
        if (!myCustomersList.includes(customerId.toString())) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(403).json({ success: false, message: "Customer not registered with this business" });
        }

        // 2. Fetch customer & validate vehicleId in their myVehicles
        const customerUser = await User.findById(customerId);
        if (!customerUser) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        const myVehiclesList = Array.isArray(customerUser.myVehicles)
            ? customerUser.myVehicles.map(v =>
                v.vehicle?._id?.toString() || v._id?.toString() || v.toString()
            ) : [];
        if (!myVehiclesList.includes(vehicleId.toString())) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Vehicle does not belong to customer" });
        }

        // 3. Fetch AutoShop businessProfile, validate offered services and subservices
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        if (!businessProfile) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        // Build allowed services & subServices set from BusinessProfile.myServices
        const allowedServiceIds = new Set();
        const allowedSubServiceIdsByService = {};
        (businessProfile.myServices || []).forEach(ms => {
            const serviceId = ms.service?._id?.toString() || ms.service?.toString();
            if (serviceId) {
                allowedServiceIds.add(serviceId);
                allowedSubServiceIdsByService[serviceId] = new Set(
                    (ms.subServices || []).map(ss => ss.subService?.toString())
                );
            }
        });

        console.log("--", allowedServiceIds);

        // 4. Check each service in payload
        for (const s of services) {
            const sid = s.id?.toString();
            if (!sid || !allowedServiceIds.has(sid)) {
                if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                return res.status(400).json({ success: false, message: `Service ${sid} not provided by this AutoShop` });
            }
            // Check subService IDs if present
            if (Array.isArray(s.subServices)) {
                const allowedSubIds = allowedSubServiceIdsByService[sid] || new Set();
                for (const sub of s.subServices) {
                    const subId = sub.id?.toString();
                    if (subId && !allowedSubIds.has(subId)) {
                        if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                        return res.status(400).json({ success: false, message: `SubService ${subId} not available under Service ${sid}` });
                    }
                }
            }
        }

        // 5. Calculate total amount (pre-discount) and process price data
        // We'll expect each subService object to contain a price. Ignore ones missing price, but warn.
        let totalAmount = 0;
        let serviceMap = new Map();
        // We'll use this to also store the discounted price structure for step 8
        let servicesWithDiscounts = JSON.parse(JSON.stringify(services || []));

        (services || []).forEach((serviceItem, serviceIdx) => {
            const sId = serviceItem.id?.toString();
            if (!sId) return;
            let subTotal = 0;
            if (Array.isArray(serviceItem.subServices)) {
                serviceItem.subServices.forEach((ss, subIdx) => {
                    const price = parseFloat(ss.price || 0);
                    if (!isNaN(price)) {
                        totalAmount += price;
                        subTotal += price;
                        // Will possibly be updated with discount later
                    }
                });
            }
            serviceMap.set(sId, subTotal);
        });

        // 6. Handle deal/coupon code (if provided), and recalculate discounted total
        let appliedDeal = null;
        let discountAmount = 0;
        let discountPercentage = 0;
        let newTotalAmount = totalAmount;

        // Create discount details structure for response, reflecting where the discounts were taken from
        let serviceDiscountDetails = [];

        if (dealCode && typeof dealCode === "string" && dealCode.trim()) {
            // Try to find a valid deal for this business profile and coupon code (enabled and not expired)
            const now = new Date();
            appliedDeal = await DealModel.findOne({
                couponCode: dealCode,
                createdBy: businessProfile._id,
                dealEnabled: true,
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            }).lean();

            if (appliedDeal) {
                // Only apply deal for relevant services or subservices as per deal rules
                let eligibleSubtotal = 0;

                // Deal Type: "all"
                if (appliedDeal.value === "all") {
                    eligibleSubtotal = totalAmount;
                    discountPercentage = appliedDeal.percentageDiscount || 0;
                    // Apply discount to all services and subservices
                    (servicesWithDiscounts || []).forEach((serviceItem, idx) => {
                        let subDiscounts = [];
                        if (Array.isArray(serviceItem.subServices)) {
                            serviceItem.subServices.forEach((ss, sIdx) => {
                                const price = parseFloat(ss.price || 0);
                                let subDiscount = 0;
                                if (!isNaN(price) && discountPercentage > 0) {
                                    subDiscount = Number(((price * discountPercentage) / 100).toFixed(2));
                                    ss.discountedPrice = Number((price - subDiscount).toFixed(2));
                                    ss.discountAmount = subDiscount;
                                } else {
                                    ss.discountedPrice = price;
                                    ss.discountAmount = 0;
                                }
                                subDiscounts.push({
                                    subServiceId: ss.id,
                                    originalPrice: price,
                                    discountedPrice: ss.discountedPrice,
                                    discountAmount: subDiscount
                                });
                                eligibleSubtotal += price;
                            });
                        }
                        serviceDiscountDetails.push({
                            serviceId: serviceItem.id,
                            discounts: subDiscounts
                        });
                    });
                }
                // Deal Type: "services"
                else if (appliedDeal.value === "services" && appliedDeal.valueId) {
                    discountPercentage = appliedDeal.percentageDiscount || 0;
                    const eligibleServiceId = appliedDeal.valueId.toString();
                    (servicesWithDiscounts || []).forEach((serviceItem, idx) => {
                        let subDiscounts = [];
                        if (serviceItem.id?.toString() === eligibleServiceId && Array.isArray(serviceItem.subServices)) {
                            serviceItem.subServices.forEach((ss, sIdx) => {
                                const price = parseFloat(ss.price || 0);
                                let subDiscount = 0;
                                if (!isNaN(price) && discountPercentage > 0) {
                                    subDiscount = Number(((price * discountPercentage) / 100).toFixed(2));
                                    ss.discountedPrice = Number((price - subDiscount).toFixed(2));
                                    ss.discountAmount = subDiscount;
                                    eligibleSubtotal += price;
                                } else {
                                    ss.discountedPrice = price;
                                    ss.discountAmount = 0;
                                }
                                subDiscounts.push({
                                    subServiceId: ss.id,
                                    originalPrice: price,
                                    discountedPrice: ss.discountedPrice,
                                    discountAmount: subDiscount
                                });
                            });
                            serviceDiscountDetails.push({
                                serviceId: serviceItem.id,
                                discounts: subDiscounts
                            });
                        } else if (Array.isArray(serviceItem.subServices)) {
                            // No discount for these subservices
                            serviceItem.subServices.forEach((ss, sIdx) => {
                                const price = parseFloat(ss.price || 0);
                                ss.discountedPrice = price;
                                ss.discountAmount = 0;
                                subDiscounts.push({
                                    subServiceId: ss.id,
                                    originalPrice: price,
                                    discountedPrice: price,
                                    discountAmount: 0
                                });
                            });
                            serviceDiscountDetails.push({
                                serviceId: serviceItem.id,
                                discounts: subDiscounts
                            });
                        }
                    });
                }
                // Deal Type: "subservices"
                else if (appliedDeal.value === "subservices" && appliedDeal.valueId) {
                    discountPercentage = appliedDeal.percentageDiscount || 0;
                    const eligibleSubServiceId = appliedDeal.valueId.toString();
                    (servicesWithDiscounts || []).forEach((serviceItem, idx) => {
                        let subDiscounts = [];
                        if (Array.isArray(serviceItem.subServices)) {
                            serviceItem.subServices.forEach((ss, sIdx) => {
                                const price = parseFloat(ss.price || 0);
                                let subDiscount = 0;
                                if (
                                    ss.id?.toString() === eligibleSubServiceId &&
                                    !isNaN(price) &&
                                    discountPercentage > 0
                                ) {
                                    subDiscount = Number(((price * discountPercentage) / 100).toFixed(2));
                                    ss.discountedPrice = Number((price - subDiscount).toFixed(2));
                                    ss.discountAmount = subDiscount;
                                    eligibleSubtotal += price;
                                } else {
                                    ss.discountedPrice = price;
                                    ss.discountAmount = 0;
                                }
                                subDiscounts.push({
                                    subServiceId: ss.id,
                                    originalPrice: price,
                                    discountedPrice: ss.discountedPrice,
                                    discountAmount: subDiscount
                                });
                            });
                        }
                        serviceDiscountDetails.push({
                            serviceId: serviceItem.id,
                            discounts: subDiscounts
                        });
                    });
                }

                // Apply discount if eligible
                if (eligibleSubtotal > 0 && discountPercentage > 0) {
                    discountAmount = Number(((eligibleSubtotal * discountPercentage) / 100).toFixed(2));
                    // Sum recalculated actual
                    newTotalAmount = Number(
                        (totalAmount - discountAmount).toFixed(2)
                    );
                }
            } else {
                // no deal found, rebuild discounts as no discount case
                if (servicesWithDiscounts) {
                    servicesWithDiscounts.forEach(serviceItem => {
                        let subDiscounts = [];
                        if (Array.isArray(serviceItem.subServices)) {
                            serviceItem.subServices.forEach(ss => {
                                const price = parseFloat(ss.price || 0);
                                ss.discountedPrice = price;
                                ss.discountAmount = 0;
                                subDiscounts.push({
                                    subServiceId: ss.id,
                                    originalPrice: price,
                                    discountedPrice: price,
                                    discountAmount: 0
                                });
                            });
                        }
                        serviceDiscountDetails.push({
                            serviceId: serviceItem.id,
                            discounts: subDiscounts
                        });
                    });
                }
            }
        } else {
            // No deal provided: set discountedPrice = price everywhere
            if (servicesWithDiscounts) {
                servicesWithDiscounts.forEach(serviceItem => {
                    let subDiscounts = [];
                    if (Array.isArray(serviceItem.subServices)) {
                        serviceItem.subServices.forEach(ss => {
                            const price = parseFloat(ss.price || 0);
                            ss.discountedPrice = price;
                            ss.discountAmount = 0;
                            subDiscounts.push({
                                subServiceId: ss.id,
                                originalPrice: price,
                                discountedPrice: price,
                                discountAmount: 0
                            });
                        });
                    }
                    serviceDiscountDetails.push({
                        serviceId: serviceItem.id,
                        discounts: subDiscounts
                    });
                });
            }
        }

        // 7. Insert JobCard (add total, discount, dealCode, discountAmount)
        // Use discounted (and discountAmount) fields for output, but store original prices structure.
        // Store path(s) of uploaded Vehicle photos in vehiclePhotos field
        // Ensure only the file paths/URLs of uploaded photos are stored in the JobCard
        const jobCardDoc = new JobCard({
            business: user.businessProfile,
            customerId,
            vehicleId,
            odometerReading,
            issueDescription,
            serviceType,
            priorityLevel,
            services: servicesWithDiscounts.map(serviceItem => ({
                id: serviceItem.id,
                subServices: Array.isArray(serviceItem.subServices)
                    ? serviceItem.subServices.map(ss => ({
                        id: ss.id,
                        price: ss.price,
                        discountedPrice: ss.discountedPrice,
                        discountAmount: ss.discountAmount
                    }))
                    : []
            })),
            additionalNotes,
            vehiclePhotos: Array.isArray(vehiclePhotos) ? vehiclePhotos : [], // Only array of file paths/URLs
            technicalRemarks,
            dealApplied: appliedDeal ? {
                name: appliedDeal.name,
                percentageDiscount: appliedDeal.percentageDiscount,
                dealCode: appliedDeal.couponCode
            } : undefined,
            totalPayableAmount: Number(newTotalAmount.toFixed(2)),
        });

        await jobCardDoc.save();

        return res.status(201).json({
            success: true,
            message: "JobCard created successfully",
            data: {
                ...jobCardDoc.toObject(),
                services: servicesWithDiscounts // send services with discount breakdown
            },
            dealApplied: appliedDeal ? {
                name: appliedDeal.name,
                percentageDiscount: appliedDeal.percentageDiscount,
                dealCode: appliedDeal.couponCode
            } : null,
            serviceDiscountDetails, // Expanded breakdown for each service/subservice
            totalPayableAmount: Number(newTotalAmount.toFixed(2)) // Added: total payable amount
        });
    } catch (err) {
        // Delete uploaded vehicle photo(s) if an error occurred
        if (req.files && req.files["vehiclePhotos"]) {
            const files =
                Array.isArray(req.files["vehiclePhotos"])
                    ? req.files["vehiclePhotos"]
                    : [req.files["vehiclePhotos"]];
            if (files.length) {
                await deleteUploadedFiles(files);
            }
        }
        console.error("[createJobCard] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to create JobCard", error: err.message });
    }
}

/**
 * Get all JobCards for the current AutoShop owner (business).
 * Returns job cards created by this user/business.
 */
async getAllJobCards(req, res) {
    try {
        // Get the requesting user
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Get the user's business profile
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "AutoShop business profile not found" });
        }

        // Find all job cards created by this business
        const jobCards = await JobCard.find({ business: user.businessProfile })
            .populate([
                { path: 'customerId', model: 'User', select: 'name phone email' },
                { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' },
            ])
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: jobCards
        });
    } catch (err) {
        console.error("[getAllJobCards] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch JobCards", error: err.message });
    }
}

/**
 * Get all payments for the current auto shop's business profile.
 * Returns all JobCards for this business where paymentStatus is 'Paid'.
 * Only selects relevant payment fields and populates minimal customer & vehicle info.
 */
async getAllPayments(req, res) {
    try {
        // Get the requesting user
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Find the user's linked business profile
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "AutoShop business profile not found" });
        }

        // Find all JobCards for this business with paymentStatus 'Paid'
        const jobCardsWithPayments = await JobCard.find({
                business: user.businessProfile
            })
            .select('customerId vehicleId totalPayableAmount paymentStatus dealApplied  createdAt')
            .populate([
                { path: 'customerId', model: 'User', select: 'name phone email' },
                { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' }
            ])
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: jobCardsWithPayments
        });

    } catch (err) {
        console.error("[getAllPayments] Error:", err);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to fetch payments", 
            error: err.message 
        });
    }
}

















}

export default AutoShopController;
