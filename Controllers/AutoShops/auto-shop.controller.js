import mongoose from "mongoose";
import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import servicesSchema from "../../Schema/services.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";


class AutoShopController {


    /**
     * Get dashboard details for autoshopowner.
     * Returns a count of jobCards grouped by each date.
     */
    /**
     * Get dashboard details for autoshopowner.
     * Returns a count of jobCards grouped by each date.
     * This version aligns with the JobCard schema, using `business` as the
     * reference field for the autoshopowner's business profile.
     * 
     * Handles: TypeError: Class constructor ObjectId cannot be invoked without 'new'
     */
    async getDashboardDetails(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized. User ID missing." });
            }

            // Ensure the user is an autoshopowner, fetch profile
            const user = await User.findById(userId).lean();
            if (!user || user.role !== "autoshopowner") {
                return res.status(403).json({ message: "Forbidden. Only autoshopowners can access dashboard details." });
            }

            // Now: find their business profile (which JobCards reference via `business`)
            if (!user.businessProfile) {
                return res.status(404).json({ message: "No business profile associated with user." });
            }
            const businessId = (typeof user.businessProfile === "string")
                ? new mongoose.Types.ObjectId(user.businessProfile)
                : user.businessProfile;

            // Aggregate job cards grouped by date, for this business.
            const jobCardsByDate = await JobCard.aggregate([
                {
                    $match: {
                        business: businessId
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);

            // Format as { date, count }
            const result = jobCardsByDate.map(item => ({
                date: item._id,
                count: item.count
            }));

            // Fetch business profile to get businessLogo and businessName
            const businessProfile = await BusinessProfileModel.findById(
                businessId,
                'businessLogo businessName'
            ).lean();
            const businessLogo = businessProfile ? businessProfile.businessLogo : null;
            const businessName = businessProfile ? businessProfile.businessName : null;

            return res.status(200).json({
                success: true,
                jobCardsByDate: result,
                businessLogo,
                businessName
            });

        } catch (error) {
            console.error("[getDashboardDetails] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

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

        // Days of the week reference
        const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday","Sunday"];
        // If openDays is a string that looks like an array, try to parse it
        if (typeof openDays === "string") {
            try {
                // Try JSON parse
                const tmp = JSON.parse(openDays);
                if (Array.isArray(tmp)) {
                    openDays = tmp;
                }
            } catch (e) {
                // fallback: split by comma if not valid JSON array
                openDays = openDays.split(",").map(s => s.trim()).filter(Boolean);
            }
        }

        // Validate openDays as array of strings
        if (!Array.isArray(openDays)) {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(400).json({ message: "openDays must be an array of day names." });
        }

        // Validate each value is a valid day name
        for (const day of openDays) {
            if (!VALID_DAYS.includes(day)) {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(400).json({
                    message: `openDays can only contain any of [${VALID_DAYS.join(", ")}]. Invalid value: "${day}"`
                });
            }
        }

        // Compute closedDays by excluding openDays from all valid days (Monday-Saturday)
        const closedDays = VALID_DAYS.filter(day => !openDays.includes(day));

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
            closedDays,
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
            closedDays,
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
            console.log("[editBusinessProfile] No userId present in auth context");
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(401).json({ message: "Unauthorized. User ID missing from auth context." });
        }

        // Lookup user
        const user = await User.findById(userId);
        console.log("[editBusinessProfile] User lookup result:", user ? "FOUND" : "NOT FOUND", user?._id || "");
        if (!user) {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ message: "User not found." });
        }

        if (user.role !== "autoshopowner") {
            console.log(`[editBusinessProfile] User role not autoshopowner: ${user.role}`);
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(403).json({ message: "Only users with role 'autoshopowner' can edit a business profile." });
        }

        // Must have an existing business profile
        if (!user.businessProfile) {
            console.log("[editBusinessProfile] No businessProfile field in user document");
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Fetch existing business profile
        let businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            console.log("[editBusinessProfile] Business profile document not found for id:", user.businessProfile);
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Only allow editing allowed fields (do not allow editing businessName or businessHSTNumber)
        let {
            businessAddress,
            pincode,
            businessPhone,
            businessEmail,
            openHours,
            openDays,
            lat,
            lng,
        } = req.body;

        // Parse lat/lng if sent as strings
        if (typeof lat === "string") {
            try { lat = parseFloat(lat); } catch { lat = undefined; }
        }
        if (typeof lng === "string") {
            try { lng = parseFloat(lng); } catch { lng = undefined; }
        }

        // If openDays is a stringified array, parse
        if (typeof openDays === "string") {
            try {
                const tmp = JSON.parse(openDays);
                if (Array.isArray(tmp)) openDays = tmp;
            } catch (e) {
                openDays = openDays.split(",").map(s => s.trim()).filter(Boolean);
            }
        }

        // Validate openDays if present
        const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        if (openDays !== undefined) {
            if (!Array.isArray(openDays)) {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(400).json({ message: "openDays must be an array of day names." });
            }
            for (const day of openDays) {
                if (!VALID_DAYS.includes(day)) {
                    if (req.files) deleteUploadedFiles(req.files);
                    return res.status(400).json({
                        message: `openDays can only contain any of [${VALID_DAYS.join(", ")}]. Invalid value: "${day}"`
                    });
                }
            }
        }

        // Compute closedDays if openDays present
        let closedDays;
        if (openDays !== undefined) {
            closedDays = VALID_DAYS.filter(day => !openDays.includes(day));
        }

        // Handle businessLogo (multer upload)
        let businessLogo = businessProfile.businessLogo;
        if (
            req.files &&
            req.files.businessLogo &&
            Array.isArray(req.files.businessLogo) &&
            req.files.businessLogo.length > 0
        ) {
            businessLogo = req.files.businessLogo[0].path;
            filesToDelete.push(req.files.businessLogo[0]);
            console.log("[editBusinessProfile] Received new businessLogo:", businessLogo);
        }

        // Prepare map location (overwrites prev if either lat/lng given)
        let businessMapLocation = businessProfile.businessMapLocation || {};
        let latDefined = lat !== undefined && lat !== null && lat !== "";
        let lngDefined = lng !== undefined && lng !== null && lng !== "";

        if (latDefined || lngDefined) {
            businessMapLocation = {};
            if (latDefined) businessMapLocation.lat = lat;
            if (lngDefined) businessMapLocation.lng = lng;
            if (Object.keys(businessMapLocation).length === 0) businessMapLocation = undefined;
        }

        // Prepare update object (only allowed fields)
        const updateData = {};

        if (businessAddress !== undefined) updateData.businessAddress = businessAddress;
        if (pincode !== undefined) updateData.pincode = pincode;
        if (latDefined || lngDefined) updateData.businessMapLocation = businessMapLocation;
        if (businessPhone !== undefined) updateData.businessPhone = businessPhone;
        if (businessEmail !== undefined) updateData.businessEmail = businessEmail;
        if (openHours !== undefined) updateData.openHours = openHours;
        if (openDays !== undefined) {
            updateData.openDays = openDays;
            updateData.closedDays = closedDays;
        }
        if (businessLogo !== undefined) updateData.businessLogo = businessLogo;

        console.log("[editBusinessProfile] Update fields:", updateData);

        // Start transaction
        session = await mongoose.startSession();
        session.startTransaction();

        // Update business profile doc
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
            } catch { }
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


// Search car owners by name, phone, email, or numberplate, return all user details with vehicle(s) details
searchCarOwner = async (req, res) => {
    try {
        const { name, phone, email, numberplate } = req.query;

        if (!name && !phone && !email && !numberplate) {
            return res.status(400).json({ message: "At least one search parameter (name, phone, email, or numberplate) is required." });
        }

        let userQuery = { role: "carowner" };

        if (numberplate) {
            // Find vehicles that match the license plate number (case-insensitive, partial match)
            const vehicleDocs = await VehicleModel.find(
                { licensePlateNo: { $regex: numberplate, $options: "i" } },
                { _id: 1 }
            );

            if (vehicleDocs.length === 0) {
                return res.status(200).json({
                    message: "No car owners found with the given vehicle numberplate.",
                    data: []
                });
            }

            const vehicleIds = vehicleDocs.map(v => v._id);
            userQuery.myVehicles = { $in: vehicleIds };
        }
        if (name) {
            userQuery.name = { $regex: name, $options: "i" };
        }
        if (phone) {
            userQuery.phone = phone;
        }
        if (email) {
            userQuery.email = email;
        }

        // Fetch all user fields (+details) and vehicles, except password
        const users = await User.find(userQuery)
            .select("-password") // exclude password field
            .populate({
                path: "myVehicles",
                model: "Vehicle",
                // You may want to keep all details; otherwise, adjust fields as needed
            });

        return res.status(200).json({
            message: users.length > 0 ? "Car owner(s) found." : "No car owners found with the given criteria.",
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
        const { phone, numberPlate } = req.query;

        if (!autoshopOwnerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        // First, find the autoshop owner (and sanity check role)
        const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" }).lean();

        if (!autoshopOwner) {
            return res.status(404).json({ message: "Auto shop owner not found." });
        }

        // Prepare numberPlate search if provided
        let vehicleIdsForPlate = [];
        if (numberPlate) {
            const vehicleDocs = await VehicleModel.find(
                { licensePlateNo: { $regex: numberPlate, $options: "i" } },
                { _id: 1 }
            );
            vehicleIdsForPlate = vehicleDocs.map(v => v._id.toString());
        }

        // Populate only those customers matching filter(s)
        let customersQuery = User.find({
            _id: { $in: autoshopOwner.myCustomers || [] }
        })
        .select("name email phone countryCode status isDisabled myVehicles address pincode")
        .populate({
            path: "myVehicles",
            model: "Vehicle",
            select: "-carImages -licensePlateFrontImagePath -licensePlateBackImagePath"
        });

        // Build filtering conditions
        let andConditions = [];

        if (phone) {
            andConditions.push({ phone: phone });
        }

        if (numberPlate && vehicleIdsForPlate.length > 0) {
            andConditions.push({ myVehicles: { $in: vehicleIdsForPlate } });
        } else if (numberPlate && vehicleIdsForPlate.length === 0) {
            // No vehicles match, so return empty directly
            return res.status(200).json({ myCustomers: [] });
        }

        if (andConditions.length) {
            customersQuery = customersQuery.where({ $and: andConditions });
        }

        const myCustomers = await customersQuery.lean();

        // Ensure address and pincode are always sent. (Included in .select and thus in the object)

        return res.status(200).json({
            myCustomers: myCustomers || [],
        });
    } catch (error) {
        console.error("[fetchMyCustomers] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Edit a customer (car owner) in myCustomers as an auto shop owner.
 * This allows updating the customer's profile fields (name, email, phone, countryCode, address, pincode)
 * Optionally: vehicles can be added/removed by updating "myVehicles" field (array of vehicle _ids).
 * Only allows updating car owners already present in "myCustomers".
 * 
 * PATCH /autoshop/edit-customer
 * Body: {
 *   carOwnerId,                   // required
 *   name, email, phone, countryCode, address, pincode, // optional fields to update
 *   myVehicles (optional array of vehicle _ids)
 * }
 */
editCustomer = async (req, res) => {
    try {
        const autoshopOwnerId = req.user?.id;
        const {
            carOwnerId,
            name,
            email,
            phone,
            countryCode,
            address,
            pincode,
            vehicles // array of vehicle objects per requirement
        } = req.body;

        if (!autoshopOwnerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }
        if (!carOwnerId) {
            return res.status(400).json({ message: "carOwnerId is required." });
        }

        // Fetch the autoshop owner and check they have this customer in myCustomers
        const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" }).lean();
        if (!autoshopOwner) {
            return res.status(404).json({ message: "Auto shop owner not found." });
        }
        if (
            !autoshopOwner.myCustomers ||
            !autoshopOwner.myCustomers.map(id => id.toString()).includes(carOwnerId.toString())
        ) {
            return res.status(403).json({ message: "This car owner is not your customer." });
        }

        // Now, fetch the car owner to check their existing myVehicles array
        const customer = await User.findOne({ _id: carOwnerId, role: "carowner" }).lean();
        if (!customer) {
            return res.status(404).json({ message: "Car owner not found." });
        }
        const existingVehicleIds = Array.isArray(customer.myVehicles)
            ? customer.myVehicles.map(id => id.toString())
            : [];

        // Prepare update fields
        let updateFields = {};
        if (name !== undefined) updateFields.name = name;
        if (email !== undefined) updateFields.email = email;
        if (phone !== undefined) updateFields.phone = phone;
        if (countryCode !== undefined) updateFields.countryCode = countryCode;
        if (address !== undefined) updateFields.address = address;
        if (pincode !== undefined) updateFields.pincode = pincode;

        // Will collect the vehicle ObjectIds for the updated myVehicles array
        let updatedVehicleObjectIds = [];

        if (Array.isArray(vehicles)) {
            for (const v of vehicles) {
                // Expect: vId, licensePlateNo, vinNo, vehicleName, model, year, odometerReading
                let vehicleDoc = null;
                if (v.vId && mongoose.Types.ObjectId.isValid(v.vId)) {
                    const vehId = v.vId;
                    // Check: Is vehId in this customer's myVehicles?
                    if (!existingVehicleIds.includes(vehId.toString())) {
                        return res.status(400).json({
                            message: `Invalid vehicle id (${vehId}) for this customer.`
                        });
                    }
                    vehicleDoc = await VehicleModel.findOneAndUpdate(
                        { _id: vehId },
                        {
                            $set: {
                                licensePlateNo: v.licensePlateNo,
                                vinNo: v.vinNo,
                                "make.name": v.vehicleName,
                                "make.model": v.model,
                                year: v.year,
                                odometerReading: v.odometerReading
                            }
                        },
                        { new: true }
                    );
                    if (vehicleDoc) {
                        updatedVehicleObjectIds.push(vehicleDoc._id);
                    }
                }
                // If vId not present, create a new vehicle document (no validation needed here)
                if (!vehicleDoc) {
                    // All fields required for new creation must be present
                    if (v.licensePlateNo && v.vinNo && v.vehicleName && v.model && v.year && v.odometerReading) {
                        const newVehicle = new VehicleModel({
                            licensePlateNo: v.licensePlateNo,
                            vinNo: v.vinNo,
                            make: { name: v.vehicleName, model: v.model },
                            year: v.year,
                            odometerReading: v.odometerReading
                        });
                        const savedVehicle = await newVehicle.save();
                        updatedVehicleObjectIds.push(savedVehicle._id);
                    }
                }
            }
            updateFields.myVehicles = updatedVehicleObjectIds;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No update fields provided." });
        }

        // Only update the customer if their role is 'carowner'
        const customerDoc = await User.findOneAndUpdate(
            { _id: carOwnerId, role: "carowner" },
            { $set: updateFields },
            { new: true }
        )
        .select("name email phone countryCode status isDisabled myVehicles address pincode")
        .populate({
            path: "myVehicles",
            model: "Vehicle",
            select: "-carImages -licensePlateFrontImagePath -licensePlateBackImagePath"
        })
        .lean();

        if (!customerDoc) {
            return res.status(404).json({ message: "Car owner not found." });
        }

        // Return updated customer info
        return res.status(200).json({
            message: "Customer updated successfully.",
            customer: customerDoc
        });

    } catch (error) {
        console.error("[editCustomer] Error:", error);
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
 * Onboard a car owner with name, email, phone, pincode, role, address, and optionally multiple vehicles.
 * After successful creation, send OTP (default: 000000).
 * POST /autoshop/onboard-carowner
 * Body: {
 *    name, email, phone, countryCode, pincode, role, address,
 *    vehicles: [
 *      {
 *        licensePlateNo, vinNo, vehicleName, model, year, odometerReading
 *      },
 *      ...
 *    ]
 * }
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
            vehicles // Expect an array of vehicle objects or undefined
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

        let newVehicles = [];
        // Handle vehicles array
        if (Array.isArray(vehicles)) {
            for (const veh of vehicles) {
                // Only add non-null/undefined fields to the payload for Vehicle
                const {
                    licensePlateNo,
                    vinNo,
                    vehicleName,
                    model,
                    year,
                    odometerReading
                } = veh || {};

                const vehiclePayload = {};
                if (licensePlateNo !== undefined) vehiclePayload.licensePlateNo = licensePlateNo;
                if (vinNo !== undefined) vehiclePayload.vinNo = vinNo;
                if (vehicleName !== undefined) vehiclePayload.make = { ...(vehiclePayload.make || {}), name: vehicleName };
                if (model !== undefined) vehiclePayload.make = { ...(vehiclePayload.make || {}), model: model };
                if (year !== undefined) vehiclePayload.year = year;
                if (odometerReading !== undefined) vehiclePayload.odometerReading = odometerReading;

                // For Vehicle schema, both make.name and make.model are required
                if (
                    vehiclePayload.licensePlateNo &&
                    vehiclePayload.vinNo &&
                    vehiclePayload.make &&
                    vehiclePayload.make.name &&
                    vehiclePayload.make.model &&
                    vehiclePayload.year
                ) {
                    const createdVehicle = await VehicleModel.create(vehiclePayload);

                    newCarOwner.myVehicles = newCarOwner.myVehicles || [];
                    newCarOwner.myVehicles.push(createdVehicle._id);
                    newVehicles.push(createdVehicle);
                }
            }
            if (newVehicles.length > 0) {
                await newCarOwner.save();
            }
        } else if (
            // Fallback: accept vehicle data at root level for backward compatibility
            req.body.licensePlateNo ||
            req.body.vinNo ||
            req.body.vehicleName ||
            req.body.model ||
            req.body.year
        ) {
            // Only add non-null/undefined fields to the payload for Vehicle
            const vehiclePayload = {};
            if (req.body.licensePlateNo !== undefined) vehiclePayload.licensePlateNo = req.body.licensePlateNo;
            if (req.body.vinNo !== undefined) vehiclePayload.vinNo = req.body.vinNo;
            if (req.body.vehicleName !== undefined) vehiclePayload.make = { ...(vehiclePayload.make || {}), name: req.body.vehicleName };
            if (req.body.model !== undefined) vehiclePayload.make = { ...(vehiclePayload.make || {}), model: req.body.model };
            if (req.body.year !== undefined) vehiclePayload.year = req.body.year;
            if (req.body.odometerReading !== undefined) vehiclePayload.odometerReading = req.body.odometerReading;

            if (
                vehiclePayload.licensePlateNo &&
                vehiclePayload.vinNo &&
                vehiclePayload.make &&
                vehiclePayload.make.name &&
                vehiclePayload.make.model &&
                vehiclePayload.year
            ) {
                const createdVehicle = await VehicleModel.create(vehiclePayload);
                newCarOwner.myVehicles = newCarOwner.myVehicles || [];
                newCarOwner.myVehicles.push(createdVehicle._id);
                newVehicles.push(createdVehicle);
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
                vehicles: newVehicles.map(v => ({
                    id: v._id,
                    licensePlateNo: v.licensePlateNo,
                    vinNo: v.vinNo,
                    name: v.make?.name,
                    model: v.make?.model,
                    year: v.year,
                    odometerReading: v.odometerReading
                }))
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

// Fetch all services
async fetchServices(req, res) {
    try {
      const allServices = await Services.find({});
      res.status(200).json({ success: true, data: allServices });
    } catch (err) {
      res.status(500).json({ success: false, message: "Error fetching services", error: err.message });
    }
  }

/**
 * Fetch all services (and selected subservices) for the current auto shop's business profile.
 * Uses the business profile schema defined in @file_context_0 (bussiness-profile.js),
 * where myServices is an array of objects:
 *   {
 *     service: ObjectId,           // Points to Services collection
 *     subServices: [               // Manually entered (custom) subservices for this autoshop
 *       { name, desc, price }
 *     ]
 *   }
 * Each entry in myServices contains only custom subservice info (not references to master subservices).
 * Response: For each, gives master service info and the custom subservices as saved.
 */
async getAllMyServices(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User ID missing." });
        }

        // Look up the shop owner, ensure role/biz profile present
        const user = await User.findById(userId).select("businessProfile role").lean();
        if (!user || user.role !== "autoshopowner") {
            return res.status(404).json({ message: "AutoShop owner not found." });
        }
        if (!user.businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Find business profile (use .lean() for perf)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        if (!businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        const myServices = Array.isArray(businessProfile.myServices)
            ? businessProfile.myServices : [];

        // If no myServices, return empty
        if (!myServices.length) {
            return res.status(200).json({ success: true, services: [] });
        }

        // Gather service IDs to resolve master info
        const serviceIds = myServices.map(ms => ms.service).filter(Boolean);
        if (!serviceIds.length) {
            return res.status(200).json({ success: true, services: [] });
        }

        // Get service master info from Services collection
        // Use .find({ _id: { $in: [...] } })
        const servicesData = await servicesSchema.find({ _id: { $in: serviceIds } }).lean();
        const servicesMap = {};
        for (const svc of servicesData) {
            servicesMap[svc._id.toString()] = svc;
        }

        // Build result as: [{ service: { id, name, desc }, selectedSubServices: [...] }, ...]
        const result = myServices.map(ms => {
            const serviceDoc = ms.service
                ? servicesMap[ms.service.toString()]
                : null;
            return {
                service: serviceDoc
                  ? {
                        id: serviceDoc._id,
                        name: serviceDoc.name,
                        desc: serviceDoc.desc
                    }
                  : null,
                selectedSubServices: Array.isArray(ms.subServices)
                  ? ms.subServices.map(sub => ({
                        // These are custom details as saved by this shop
                        name: sub.name,
                        desc: sub.desc,
                        price: sub.price
                    }))
                  : []
            };
        }).filter(item => item.service); // skip entries where the master service is missing/deleted

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
            return res.status(400).json({ message: "`services` (array) is required in request body." });
        }

        // Validate all services exist in services master schema
        for (const serviceBlock of services) {
            if (!serviceBlock.id) {
                return res.status(400).json({ message: "All entries in services must have an id (service Id)." });
            }
            const serviceDoc = await servicesSchema.findById(serviceBlock.id).lean();
            if (!serviceDoc) {
                return res.status(400).json({ message: `Service with id "${serviceBlock.id}" does not exist.` });
            }
            // Each serviceBlock.subServices must be an array (can be empty)
            if (!Array.isArray(serviceBlock.subServices)) {
                return res.status(400).json({ message: `subServices must be an array in service "${serviceBlock.id}".` });
            }
            // Check that custom subServices each have required fields
            for (const sub of serviceBlock.subServices) {
                if (
                    !sub ||
                    typeof sub.name !== "string" ||
                    sub.name.trim() === ""
                ) {
                    return res.status(400).json({ message: `Each subService in service "${serviceBlock.id}" must have a non-empty 'name'.` });
                }
                // desc (optional), price (optional but if present must be number)
                if ("price" in sub && typeof sub.price !== "number") {
                    return res.status(400).json({ message: `subService 'price' (if provided) must be a number in service "${serviceBlock.id}".` });
                }
            }
        }

        // Get the latest business profile (not lean so we can update)
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            return res.status(404).json({ message: "Business profile not found." });
        }

        // Build a map of present services for easy lookup: serviceId => index of myServices
        const presentServiceIdx = {};
        for (let i = 0; i < businessProfile.myServices.length; ++i) {
            const ms = businessProfile.myServices[i];
            if (ms.service) presentServiceIdx[ms.service.toString()] = i;
        }

        // Only add/update services/subServices as per schema: 
        // "myServices" is array of { service: ObjectId, subServices: [ { name, desc, price } ] }
        for (const serviceBlock of services) {
            const serviceId = serviceBlock.id?.toString();
            if (!serviceId) continue;

            // Create normalized array of incoming subServices (name, desc, price)
            const incomingSubServices = (serviceBlock.subServices || []).map(sub => ({
                name: sub.name,
                desc: sub.desc || "",
                price: typeof sub.price === "number" ? sub.price : undefined,
            }));

            // See if this service is already present for this business
            const msIdx = presentServiceIdx[serviceId];
            if (msIdx === undefined) {
                // Not present at all: Add it
                businessProfile.myServices.push({
                    service: serviceBlock.id,
                    subServices: incomingSubServices
                });
            } else {
                // Already present: append only those subservices with unique name/desc/price
                const exSubServices = businessProfile.myServices[msIdx].subServices || [];

                // We'll use (name+desc+price) as uniqueness for custom subServices
                const exSet = new Set(
                    exSubServices.map(s =>
                        `${s.name?.trim()}|${(s.desc||"").trim()}|${typeof s.price === "number" ? s.price : ""}`
                    )
                );

                for (const sub of incomingSubServices) {
                    const key = `${sub.name?.trim()}|${(sub.desc||"").trim()}|${typeof sub.price === "number" ? sub.price : ""}`;
                    if (!exSet.has(key)) {
                        exSubServices.push(sub);
                        exSet.add(key);
                    }
                }
                businessProfile.myServices[msIdx].subServices = exSubServices;
            }
        }

        await businessProfile.save();

        return res.status(200).json({
            success: true,
            message: "Services added successfully.",
            myServices: businessProfile.myServices
        });
    } catch (error) {
        console.error("[addToMyServices] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Remove services (and/or subservices) from current auto shop's business profile.
 * Expects req.user to be authenticated autoshopowner and req.body.services as described.
 */

// async removeFromMyServices(req, res) {
//     try {
//         const userId = req.user?.id;
//         if (!userId) {
//             return res.status(401).json({ message: "Unauthorized. User ID missing." });
//         }

//         // Find the autoshopowner with their businessProfile populated
//         const user = await User.findById(userId).select("businessProfile role").lean();
//         if (!user || user.role !== "autoshopowner") {
//             return res.status(404).json({ message: "AutoShop owner not found." });
//         }
//         if (!user.businessProfile) {
//             return res.status(404).json({ message: "Business profile not found." });
//         }

//         const { services } = req.body;
//         if (!Array.isArray(services) || services.length === 0) {
//             return res.status(400).json({ message: "services (array) is required in request body." });
//         }

//         /**
//          * Expect request body like:
//          *   services: [
//          *     {
//          *       id: "serviceId",
//          *       subServices: [
//          *          { name, desc, price } // MATCH BY these fields
//          *       ]
//          *     },
//          *     ...
//          *   ]
//          * 
//          * If subServices array is empty or omitted, remove whole service entry.
//          */

//         // Build removal map: serviceId -> Set of subService keys (name|desc|price). If set empty: remove whole service.
//         const toRemove = {};
//         for (const s of services) {
//             const serviceId = s.id?.toString();
//             if (!serviceId) continue;
//             if (!Array.isArray(s.subServices) || s.subServices.length === 0) {
//                 // Remove whole service
//                 toRemove[serviceId] = null;
//             } else {
//                 // Remove only matching subservices by composite key
//                 const subServiceKeys = new Set(
//                     s.subServices.map(sub => {
//                         return `${sub.name?.trim()}|${(sub.desc||"").trim()}|${typeof sub.price === "number" ? sub.price : ""}`;
//                     })
//                 );
//                 toRemove[serviceId] = subServiceKeys;
//             }
//         }

//         // Edit business profile
//         const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
//         if (!businessProfile) {
//             return res.status(404).json({ message: "Business profile not found." });
//         }

//         // Filter myServices according to removal plan
//         businessProfile.myServices = businessProfile.myServices.filter(ms => {
//             const svcId = ms.service.toString();
//             if (!(svcId in toRemove)) return true; // Not targeted for removal

//             const removeSubKeys = toRemove[svcId];
//             if (removeSubKeys === null) {
//                 // Remove whole service
//                 return false;
//             }

//             // Remove specific subServices by composite key match (name|desc|price)
//             ms.subServices = (ms.subServices || []).filter(ss => {
//                 const key = `${ss.name?.trim()}|${(ss.desc||"").trim()}|${typeof ss.price === "number" ? ss.price : ""}`;
//                 return !removeSubKeys.has(key);
//             });

//             // If after removal this service has no subServices left, remove service entirely
//             return ms.subServices.length > 0;
//         });

//         await businessProfile.save();

//         return res.status(200).json({ success: true, message: "Services removed successfully.", myServices: businessProfile.myServices });
//     } catch (error) {
//         console.error("[removeFromMyServices] Error:", error);
//         return res.status(500).json({ message: "Internal Server Error" });
//     }
// }

// DEALS HANDLING SECTION


async editMyServices(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized." });
      }
  
      const user = await User.findById(userId)
        .select("businessProfile role")
        .lean();
  
      if (!user || user.role !== "autoshopowner") {
        return res.status(404).json({ message: "AutoShop owner not found." });
      }
  
      if (!user.businessProfile) {
        return res.status(404).json({ message: "Business profile not found." });
      }
  
      const { services } = req.body;
      if (!Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ message: "`services` array is required." });
      }
  
      const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
      if (!businessProfile) {
        return res.status(404).json({ message: "Business profile not found." });
      }

      // Make sure servicesSchema is imported as 'servicesSchema'
      for (const block of services) {
        const serviceId = block.id?.toString();
        if (!serviceId) continue;

        // Check in master services schema that this service exists
        const serviceDoc = await servicesSchema.findById(serviceId).lean();
        if (!serviceDoc) {
          return res.status(400).json({ message: `Service with id "${serviceId}" does not exist.` });
        }
  
        const msIndex = businessProfile.myServices.findIndex(
          ms => ms.service.toString() === serviceId
        );
  
        // 🔥 REMOVE ENTIRE SERVICE
        if (block.removeService === true) {
          if (msIndex !== -1) {
            businessProfile.myServices.splice(msIndex, 1);
          }
          continue;
        }
  
        const incomingSubs = Array.isArray(block.subServices) ? block.subServices : [];
  
        // 🔥 SERVICE DOES NOT EXIST → ADD
        if (msIndex === -1) {
          businessProfile.myServices.push({
            service: serviceId,
            subServices: incomingSubs.map(s => ({
              name: s.name,
              desc: s.desc || "",
              price: typeof s.price === "number" ? s.price : undefined
            }))
          });
          continue;
        }
  
        // 🔥 SERVICE EXISTS → EDIT / REMOVE SUBSERVICES
        let existingSubs = businessProfile.myServices[msIndex].subServices || [];
  
        if (block.removeSubServices === true) {
          const removeNames = new Set(
            incomingSubs.map(s => s.name.trim())
          );
          existingSubs = existingSubs.filter(
            s => !removeNames.has(s.name.trim())
          );
        } else {
          // ADD / UPDATE subServices (matched by name)
          const subMap = new Map(
            existingSubs.map(s => [s.name.trim(), s])
          );
  
          for (const sub of incomingSubs) {
            if (!sub.name || typeof sub.name !== "string") continue;
  
            if (subMap.has(sub.name.trim())) {
              // UPDATE
              const ex = subMap.get(sub.name.trim());
              if ("desc" in sub) ex.desc = sub.desc || "";
              if ("price" in sub && typeof sub.price === "number") ex.price = sub.price;
            } else {
              // ADD
              existingSubs.push({
                name: sub.name,
                desc: sub.desc || "",
                price: typeof sub.price === "number" ? sub.price : undefined
              });
            }
          }
        }
  
        // If no subServices left → remove service
        if (existingSubs.length === 0) {
          businessProfile.myServices.splice(msIndex, 1);
        } else {
          businessProfile.myServices[msIndex].subServices = existingSubs;
        }
      }
  
      await businessProfile.save();
  
      return res.status(200).json({
        success: true,
        message: "Services updated successfully.",
        myServices: businessProfile.myServices
      });
  
    } catch (error) {
      console.error("[editMyServices] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
  
/**
 * Create a new deal and link it to the creator's business profile.
 * - Adds the deal's _id to BusinessProfile.myDeals.
 * - Sets Deal.createdBy to businessProfile._id.
 * - Adapts to deals.schema.js fields: productName, productImage, description, price, discountedPrice, dealEnabled, offersEndOnDate, createdBy.
 */
/**
 * Create a new deal and link it to the creator's business profile.
 * - Adds the deal's _id to BusinessProfile.myDeals.
 * - Sets Deal.createdBy to businessProfile._id.
 * - Adapts to deals.schema.js fields: productName, productImage, description, price, discountedPrice, dealEnabled, offersEndOnDate, createdBy.
 */
async createDeal(req, res) {
    let uploadedProductImagePath;
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).lean();
        if (!user) {
            if (req.files && req.files.productImage && req.files.productImage[0]?.path) {
                if (req.files.productImage[0].path !== undefined) {
                    deleteUploadedFiles([req.files.productImage[0].path]);
                }
            }
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            if (req.files && req.files.productImage && req.files.productImage[0]?.path) {
                if (req.files.productImage[0].path !== undefined) {
                    deleteUploadedFiles([req.files.productImage[0].path]);
                }
            }
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }

        if (req.files && req.files.productImage && req.files.productImage[0]?.path) {
            uploadedProductImagePath = req.files.productImage[0].path;
        }

        // Prevent productImage in req.body from being accepted as path
        if ('productImage' in req.body) {
            delete req.body.productImage;
        }

        let {
            productName,
            description = "",
            price,
            discountedPrice,
            dealEnabled,
            offersEndOnDate,
            serviceId
        } = req.body;

        price = typeof price === "string" ? Number(price) : price;
        discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
        dealEnabled = (dealEnabled === true || dealEnabled === "true") ? true : false;

        if (
            typeof productName !== "string" || !productName.trim() ||
            typeof price !== "number" || isNaN(price) ||
            typeof discountedPrice !== "number" || isNaN(discountedPrice) ||
            !offersEndOnDate ||
            typeof serviceId !== "string" || !serviceId.trim()
        ) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(400).json({
                success: false,
                message: "productName (string), price (number), discountedPrice (number), offersEndOnDate (date), and serviceId (string) are required.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(serviceId.trim())) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(400).json({
                success: false,
                message: "serviceId must be a valid MongoDB ObjectId."
            });
        }

        const service = await Services.findById(serviceId.trim()).lean();
        if (!service) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(404).json({
                success: false,
                message: "The specified serviceId does not correspond to a valid service."
            });
        }

        if (price < 0 || discountedPrice < 0) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(400).json({
                success: false,
                message: "price and discountedPrice must not be negative."
            });
        }
        if (discountedPrice > price) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(400).json({
                success: false,
                message: "discountedPrice cannot be greater than price."
            });
        }

        let offerEndDate = offersEndOnDate instanceof Date
            ? offersEndOnDate
            : new Date(offersEndOnDate);
        if (isNaN(offerEndDate.getTime())) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(400).json({
                success: false,
                message: "offersEndOnDate must be a valid date."
            });
        }

        const existingDeal = await DealModel.findOne({
            productName: productName.trim(),
            createdBy: businessProfile._id,
            serviceId: serviceId.trim(),
        }).lean();
        if (existingDeal) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(400).json({
                success: false,
                message: "A deal with the same product name already exists for this service in your business profile."
            });
        }

        let finalProductImage = uploadedProductImagePath || "";

        const deal = new DealModel({
            productName: productName.trim(),
            productImage: finalProductImage,
            description: typeof description === "string" ? description : "",
            price: price,
            discountedPrice: discountedPrice,
            dealEnabled: !!dealEnabled,
            offersEndOnDate: offerEndDate,
            createdBy: businessProfile._id,
            serviceId: serviceId.trim()
        });

        await deal.save();

        if (!Array.isArray(businessProfile.myDeals)) businessProfile.myDeals = [];
        businessProfile.myDeals.push(deal._id);
        await businessProfile.save();

        return res.status(201).json({
            success: true,
            message: "Deal created successfully",
            data: deal
        });

    } catch (error) {
        console.log(error);
        if (uploadedProductImagePath !== undefined) {
            deleteUploadedFiles([uploadedProductImagePath]);
        }
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
 */
async editDeal(req, res) {
    let uploadedProductImagePath;
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).lean();
        if (!user) {
            if (req.files && req.files.productImage && req.files.productImage[0]?.path) {
                if (req.files.productImage[0].path !== undefined) {
                    deleteUploadedFiles([req.files.productImage[0].path]);
                }
            }
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            if (req.files && req.files.productImage && req.files.productImage[0]?.path) {
                if (req.files.productImage[0].path !== undefined) {
                    deleteUploadedFiles([req.files.productImage[0].path]);
                }
            }
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        const businessProfileId = businessProfile._id;

        const { id } = req.params;
        const updateData = { ...req.body };

        if ('productImage' in updateData) {
            delete updateData.productImage;
        }

        if (req.files && req.files.productImage && req.files.productImage[0]?.path) {
            uploadedProductImagePath = req.files.productImage[0].path;
            updateData.productImage = uploadedProductImagePath;
        }

        delete updateData.createdBy;

        if ('productName' in updateData) {
            if (typeof updateData.productName !== "string" || !updateData.productName.trim()) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({ success: false, message: "productName must be a non-empty string." });
            }
            updateData.productName = updateData.productName.trim();
        }
        if ('description' in updateData && typeof updateData.description !== "string") {
            updateData.description = "";
        }
        if ('price' in updateData) {
            updateData.price = typeof updateData.price === "string" ? Number(updateData.price) : updateData.price;
            if (typeof updateData.price !== "number" || isNaN(updateData.price)) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({ success: false, message: "price must be a number." });
            }
            if (updateData.price < 0) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({ success: false, message: "price must not be negative." });
            }
        }
        if ('discountedPrice' in updateData) {
            updateData.discountedPrice = typeof updateData.discountedPrice === "string"
                ? Number(updateData.discountedPrice) : updateData.discountedPrice;
            if (typeof updateData.discountedPrice !== "number" || isNaN(updateData.discountedPrice)) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({ success: false, message: "discountedPrice must be a number." });
            }
            if (updateData.discountedPrice < 0) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({ success: false, message: "discountedPrice must not be negative." });
            }
        }
        if ('offersEndOnDate' in updateData) {
            let offersEndDate = updateData.offersEndOnDate instanceof Date 
                ? updateData.offersEndOnDate 
                : new Date(updateData.offersEndOnDate);
            if (isNaN(offersEndDate.getTime())) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({ success: false, message: "offersEndOnDate must be a valid date." });
            }
            updateData.offersEndOnDate = offersEndDate;
        }
        if ('dealEnabled' in updateData) {
            updateData.dealEnabled = (
                updateData.dealEnabled === true ||
                updateData.dealEnabled === "true"
            );
        }

        if ('serviceId' in updateData) {
            if (typeof updateData.serviceId !== "string" || !updateData.serviceId.trim()) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({
                    success: false,
                    message: "serviceId must be a non-empty string."
                });
            }
            updateData.serviceId = updateData.serviceId.trim();
            if (!mongoose.Types.ObjectId.isValid(updateData.serviceId)) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({
                    success: false,
                    message: "serviceId must be a valid MongoDB ObjectId."
                });
            }
            const service = await Services.findById(updateData.serviceId).lean();
            if (!service) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(404).json({
                    success: false,
                    message: "The specified serviceId does not correspond to a valid service."
                });
            }
        }

        if ('discountedPrice' in updateData && 'price' in updateData) {
            if (updateData.discountedPrice > updateData.price) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({
                    success: false,
                    message: "discountedPrice cannot be greater than price."
                });
            }
        }

        // Prevent duplicate deal (uniqueness for businessProfileId, serviceId, productName)
        if ('productName' in updateData && 'serviceId' in updateData) {
            const otherDeal = await DealModel.findOne({
                productName: updateData.productName,
                serviceId: updateData.serviceId,
                createdBy: businessProfileId,
                _id: { $ne: id }
            }).lean();
            if (otherDeal) {
                if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                return res.status(400).json({
                    success: false,
                    message: "A deal with the same product name already exists for this service in your business profile."
                });
            }
        } else if ('productName' in updateData) {
            const currentDeal = await DealModel.findOne({ _id: id, createdBy: businessProfileId }).lean();
            if (currentDeal && currentDeal.serviceId) {
                const otherDeal = await DealModel.findOne({
                    productName: updateData.productName,
                    serviceId: currentDeal.serviceId,
                    createdBy: businessProfileId,
                    _id: { $ne: id }
                }).lean();
                if (otherDeal) {
                    if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                    return res.status(400).json({
                        success: false,
                        message: "A deal with the same product name already exists for this service in your business profile."
                    });
                }
            }
        } else if ('serviceId' in updateData) {
            const currentDeal = await DealModel.findOne({ _id: id, createdBy: businessProfileId }).lean();
            if (currentDeal && currentDeal.productName) {
                const otherDeal = await DealModel.findOne({
                    productName: currentDeal.productName,
                    serviceId: updateData.serviceId,
                    createdBy: businessProfileId,
                    _id: { $ne: id }
                }).lean();
                if (otherDeal) {
                    if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
                    return res.status(400).json({
                        success: false,
                        message: "A deal with the same product name already exists for this service in your business profile."
                    });
                }
            }
        }

        const deal = await DealModel.findOneAndUpdate(
            { _id: id, createdBy: businessProfileId },
            updateData,
            { new: true }
        );
        if (!deal) {
            if (uploadedProductImagePath !== undefined) deleteUploadedFiles([uploadedProductImagePath]);
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }
        return res.status(200).json({ success: true, message: "Deal updated", data: deal });
    } catch (error) {
        if (uploadedProductImagePath !== undefined) {
            deleteUploadedFiles([uploadedProductImagePath]);
        }
        return res.status(500).json({ success: false, message: "Error updating deal", error: error.message });
    }
}

/**
 * Delete a deal by ID (only if created by the current business profile).
 * - Removes the deal's _id from BusinessProfile.myDeals.
 */
async deleteDeal(req, res) {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        const businessProfileId = businessProfile._id;
        const { id } = req.params;

        // Delete only if createdBy matches
        const deal = await DealModel.findOneAndDelete({ _id: id, createdBy: businessProfileId });
        if (!deal) {
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }

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
 * Returns full Deal documents as an array.
 */
async fetchMyDeals(req, res) {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }

        // myDeals is an array of ObjectId referencing Deal
        const deals = await DealModel.find({
            _id: { $in: businessProfile.myDeals || [] },
            createdBy: businessProfile._id
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: deals
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

        // Get the business profile, populating references for myServices and myDeals
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile)
            .populate({
                path: "myServices.service",
                select: "name desc" // Only fetch the name & desc for service reference
            })
            .populate("myDeals")
            .lean();

        if (!businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }

        // myServices.subServices is [{ name, desc, price }] - no ObjectId
        let cleanedMyServices = (businessProfile.myServices || []).map(myService => {
            let serviceDoc = myService.service;
            const serviceInfo = serviceDoc && (serviceDoc.name || serviceDoc.desc)
                ? {
                    _id: serviceDoc._id,
                    name: serviceDoc.name,
                    desc: serviceDoc.desc
                }
                : myService.service;

            return {
                ...myService,
                service: serviceInfo,
                subServices: Array.isArray(myService.subServices)
                    ? myService.subServices.map(sub => ({
                        name: sub.name,
                        desc: sub.desc,
                        price: sub.price
                    }))
                    : []
            };
        });

        // Structure the response payload with cleaned myServices
        return res.status(200).json({
            success: true,
            data: {
                myCustomers: user.myCustomers || [],
                myServices: cleanedMyServices,
                // myDeals: businessProfile.myDeals || []
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
        // Parse services if it's a string
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
            dueOdometerReading,
            issueDescription,
            serviceType,
            priorityLevel,
            services,
            additionalNotes,
            technicalRemarks
            // status  // REMOVED: status does not come from req.body anymore
        } = req.body;

        // Uploaded photos handling
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
        // const allowedStatus = ['Pending', 'Approved', 'Rejected']; // No longer relevant for input
        if (!allowedServiceTypes.includes(serviceType)) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Invalid serviceType" });
        }
        if (!allowedPriorityLevels.includes(priorityLevel)) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Invalid priorityLevel" });
        }
        // status validation removed, always "Pending" on creation
        if (vehiclePhotos.length > 5) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Maximum 5 vehiclePhotos allowed" });
        }

        // Find user/business & validate customer
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

        // Fetch customer & check vehicleId
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

        // Get business profile, and build allowed services/subservices lookup using serviceId and subService.name
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        if (!businessProfile) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }

        // Build allowed services & subServices lookup by serviceId and subService name (not ObjectId)
        const allowedServiceIds = new Set();
        const allowedSubServiceNamesByService = {};
        (businessProfile.myServices || []).forEach(ms => {
            const serviceId = ms.service?._id?.toString() || ms.service?.toString();
            if (serviceId) {
                allowedServiceIds.add(serviceId);
                allowedSubServiceNamesByService[serviceId] = new Set(
                    (ms.subServices || []).map(ss =>
                        (ss.subService?.name || ss.name || (typeof ss.subService === "string" ? ss.subService : undefined))
                    ).filter(Boolean)
                );
            }
        });

        // Validate input services & subservices (by service id and subService name, not objectId)
        for (const s of services) {
            const sid = s.service?.toString() || s.id?.toString(); // now field is "service"
            if (!sid || !allowedServiceIds.has(sid)) {
                if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                return res.status(400).json({ success: false, message: `Service ${sid} not provided by this AutoShop` });
            }
            if (Array.isArray(s.subServices)) {
                const allowedSubNames = allowedSubServiceNamesByService[sid] || new Set();
                for (const sub of s.subServices) {
                    const subName = typeof sub.name === "string" ? sub.name : null;
                    if (!subName || !allowedSubNames.has(subName)) {
                        if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                        return res.status(400).json({
                            success: false,
                            message: `SubService "${subName}" not available under Service ${sid}`
                        });
                    }
                }
            }
        }

        // Calculate total amount (no discounts, deal/coupon removed)
        let totalAmount = 0;
        const servicesPayload = (services || []).map(serviceItem => {
            let subTotal = 0;
            const mappedSubServices = Array.isArray(serviceItem.subServices)
                ? serviceItem.subServices.map(ss => {
                    const price = parseFloat(ss.price ?? 0);
                    if (!isNaN(price)) subTotal += price;
                    return {
                        name: ss.name,
                        desc: ss.desc,
                        price: isNaN(price) ? 0 : price,
                    };
                })
                : [];
            totalAmount += subTotal;

            // Service is always ref to Services ObjectID
            return {
                service: serviceItem.service?.toString() || serviceItem.id?.toString(), // accept either, but schema expects "service"
                subServices: mappedSubServices
            };
        });

        // Create the job card document as per corrected schema,
        // subServices = [{ name, desc, price }], no ObjectId for subService
        // status will always be "Pending" on creation
        const jobCardDoc = new JobCard({
            business: user.businessProfile,
            customerId,
            vehicleId,
            odometerReading,
            dueOdometerReading,
            issueDescription,
            serviceType,
            priorityLevel,
            services: servicesPayload,
            additionalNotes,
            vehiclePhotos: Array.isArray(vehiclePhotos) ? vehiclePhotos : [],
            technicalRemarks,
            totalPayableAmount: Number(totalAmount.toFixed(2)),
            status: "Pending"
        });

        await jobCardDoc.save();

        return res.status(201).json({
            success: true,
            message: "JobCard created successfully",
            data: {
                ...jobCardDoc.toObject(),
                // attach calculated total & cleaned services array
                totalPayableAmount: Number(totalAmount.toFixed(2)),
                services: servicesPayload
            }
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
 * Edit a job card. Allows autoshopowner to update specific fields on their own job card.
 * Only Pending status job cards can be edited.
 * All validations similar to createJobCard will be performed.
 *
 * Only updates the following fields: odometerReading, dueOdometerReading,
 * issueDescription, services, additionalNotes, technicalRemarks, vehiclePhotos.
 * Will overwrite ALL those fields.
 * Accepts vehiclePhotos - optional; if not sent, keeps existing. If sent, replaces.
 * If new files are uploaded, cleans up old photos (from FS/S3 accordingly).
 */
async editJobCard(req, res) {
    // Accept vehiclePhotos from file uploads (multer) via req.files["vehiclePhotos"]

    try {
        const { jobCardId } = req.params;

        // Parse services if it's a string
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
            odometerReading,
            dueOdometerReading,
            issueDescription,
            serviceType, // can't be updated but validated for match
            priorityLevel, // can't be updated but validated for match
            services,
            additionalNotes,
            technicalRemarks
        } = req.body;

        // Find requesting user
        const user = await User.findById(req.user.id);
        if (!user) {
            // delete any uploaded new photos
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(404).json({ success: false, message: "AutoShop owner user not found" });
        }

        // Find the job card and check business ownership
        const jobCard = await JobCard.findById(jobCardId);
        if (!jobCard) {
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(404).json({ success: false, message: "JobCard not found" });
        }
        if (
            !jobCard.business ||
            jobCard.business.toString() !== (user.businessProfile?.toString?.() || user.businessProfile)
        ) {
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(403).json({ success: false, message: "You do not own this JobCard" });
        }
        if (jobCard.status !== "Pending") {
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(400).json({ success: false, message: "Only Pending job cards can be edited." });
        }

        // Only allow update on fields outlined
        // Get uploaded photos if available
        let uploadedPhotos = [];
        if (req.files && req.files["vehiclePhotos"]) {
            if (Array.isArray(req.files["vehiclePhotos"])) {
                uploadedPhotos = req.files["vehiclePhotos"];
            } else if (req.files["vehiclePhotos"]) {
                uploadedPhotos = [req.files["vehiclePhotos"]];
            }
        }
        let vehiclePhotos;
        if (uploadedPhotos.length) {
            vehiclePhotos = uploadedPhotos.map(f => f.path || f.location || f.filename).filter(Boolean);
        } else {
            // If no new upload, keep existing
            vehiclePhotos = jobCard.vehiclePhotos || [];
        }

        // Validate if fields are present and correct, similar to createJobCard
        const missingFields = [];
        if (!services || !Array.isArray(services)) missingFields.push("services");
        if (!odometerReading && odometerReading !== 0) missingFields.push("odometerReading");
        if (!priorityLevel) missingFields.push("priorityLevel");
        if (!serviceType) missingFields.push("serviceType");
        if (missingFields.length > 0) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(", ")}`
            });
        }

        // Validate type matches current
        if (priorityLevel !== jobCard.priorityLevel) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Cannot change priorityLevel" });
        }
        if (serviceType !== jobCard.serviceType) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Cannot change serviceType" });
        }

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

        // Validate customer (should not change)
        const customerUser = await User.findById(jobCard.customerId || jobCard.customer?._id);
        if (!customerUser) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        const myVehiclesList = Array.isArray(customerUser.myVehicles)
            ? customerUser.myVehicles.map(v =>
                v.vehicle?._id?.toString() || v._id?.toString() || v.toString()
            ) : [];
        if (!myVehiclesList.includes((jobCard.vehicleId || jobCard.vehicle?._id)?.toString())) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Vehicle does not belong to customer" });
        }

        // Get business profile and build allowed services/subservices as in createJobCard
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        if (!businessProfile) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }

        // Build allowed services/subServices
        const allowedServiceIds = new Set();
        const allowedSubServiceNamesByService = {};
        (businessProfile.myServices || []).forEach(ms => {
            const serviceId = ms.service?._id?.toString() || ms.service?.toString();
            if (serviceId) {
                allowedServiceIds.add(serviceId);
                allowedSubServiceNamesByService[serviceId] = new Set(
                    (ms.subServices || []).map(ss =>
                        (ss.subService?.name || ss.name || (typeof ss.subService === "string" ? ss.subService : undefined))
                    ).filter(Boolean)
                );
            }
        });

        // Validate input services/subservices (by service id and subService name, not objectId)
        for (const s of services) {
            const sid = s.service?.toString() || s.id?.toString();
            if (!sid || !allowedServiceIds.has(sid)) {
                if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                return res.status(400).json({ success: false, message: `Service ${sid} not provided by this AutoShop` });
            }
            if (Array.isArray(s.subServices)) {
                const allowedSubNames = allowedSubServiceNamesByService[sid] || new Set();
                for (const sub of s.subServices) {
                    const subName = typeof sub.name === "string" ? sub.name : null;
                    if (!subName || !allowedSubNames.has(subName)) {
                        if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                        return res.status(400).json({
                            success: false,
                            message: `SubService "${subName}" not available under Service ${sid}`
                        });
                    }
                }
            }
        }

        // Calculate new total
        let totalAmount = 0;
        const servicesPayload = (services || []).map(serviceItem => {
            let subTotal = 0;
            const mappedSubServices = Array.isArray(serviceItem.subServices)
                ? serviceItem.subServices.map(ss => {
                    const price = parseFloat(ss.price ?? 0);
                    if (!isNaN(price)) subTotal += price;
                    return {
                        name: ss.name,
                        desc: ss.desc,
                        price: isNaN(price) ? 0 : price,
                    };
                })
                : [];
            totalAmount += subTotal;

            return {
                service: serviceItem.service?.toString() || serviceItem.id?.toString(),
                subServices: mappedSubServices
            };
        });

        // If new vehicle photos are uploaded, remove old ones
        if (uploadedPhotos.length && Array.isArray(jobCard.vehiclePhotos) && jobCard.vehiclePhotos.length) {
            // Remove old vehicle photos (deleteUploadedFiles expects File[] or array of filename/paths)
            try {
                await deleteUploadedFiles(jobCard.vehiclePhotos);
            } catch(err) {
                // Ignore error, log
                console.warn("Failed to clean up previous vehicle photos after jobcard edit", err);
            }
        }

        // Update editable fields
        jobCard.odometerReading = odometerReading;
        jobCard.dueOdometerReading = dueOdometerReading;
        jobCard.issueDescription = issueDescription;
        jobCard.services = servicesPayload;
        jobCard.additionalNotes = additionalNotes;
        jobCard.technicalRemarks = technicalRemarks;
        jobCard.vehiclePhotos = Array.isArray(vehiclePhotos) ? vehiclePhotos : [];
        jobCard.totalPayableAmount = Number(totalAmount.toFixed(2));

        await jobCard.save();

        return res.status(200).json({
            success: true,
            message: "JobCard updated successfully",
            data: {
                ...jobCard.toObject(),
                totalPayableAmount: Number(totalAmount.toFixed(2)),
                services: servicesPayload
            }
        });
    } catch (err) {
        // Cleanup any newly uploaded files on error
        if (req.files && req.files["vehiclePhotos"]) {
            const files =
                Array.isArray(req.files["vehiclePhotos"])
                    ? req.files["vehiclePhotos"]
                    : [req.files["vehiclePhotos"]];
            if (files.length) {
                await deleteUploadedFiles(files);
            }
        }
        console.error("[editJobCard] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to edit JobCard", error: err.message });
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
