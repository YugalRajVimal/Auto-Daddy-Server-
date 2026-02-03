import mongoose from "mongoose";
import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/fileDelete.middleware.js";
import AutoShopModel from "../../Schema/auto-shops.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";

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

        // Find the autoshopowner and populate myCustomers field
        const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" })
            .populate({
                path: "myCustomers",
                select: "name email phone countryCode status isDisabled", // select some carowner fields to return
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
















}

export default AutoShopController;
