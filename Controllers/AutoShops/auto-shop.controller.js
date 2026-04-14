import mongoose, { Types } from "mongoose";
import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import servicesSchema from "../../Schema/services.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";
import counterSchema from "../../Schema/counter.schema.js";
import VehicleType from "../../Schema/vehicle-type.schema.js";
import CarDetailsModel from "../../Schema/CarDetails.schema.js";


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

        // Extract business profile details (include gst field)
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
            gst, // new gst field
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

        // Parse gst as number
        if (typeof gst === "string" && gst !== "") {
            const parsedGst = Number(gst);
            gst = isNaN(parsedGst) ? undefined : parsedGst;
        }
        if (gst !== undefined && typeof gst !== "number") {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(400).json({ message: "gst must be a number." });
        }

        // Days of the week reference
        const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        // If openDays is a string that looks like an array, try to parse it
        if (typeof openDays === "string") {
            try {
                // Try JSON parse
                const tmp = JSON.parse(openDays);
                if (Array.isArray(tmp)) openDays = tmp;
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
            gst,
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

        // Prepare business profile data shaped according to businessProfileSchema, including gst field
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
            gst, // ensure gst is a number or undefined
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
            gst, // add gst
        } = req.body;

        // Parse lat/lng if sent as strings
        if (typeof lat === "string") {
            try { lat = parseFloat(lat); } catch { lat = undefined; }
        }
        if (typeof lng === "string") {
            try { lng = parseFloat(lng); } catch { lng = undefined; }
        }

        // Parse gst as number
        if (typeof gst === "string" && gst !== "") {
            const parsedGst = Number(gst);
            gst = isNaN(parsedGst) ? undefined : parsedGst;
        }
        if (gst !== undefined && typeof gst !== "number") {
            if (req.files) deleteUploadedFiles(req.files);
            return res.status(400).json({ message: "gst must be a number." });
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
        if (gst !== undefined) updateData.gst = gst; // allow gst to be updated; must be a number

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
            const { name, email, phone, designation, isActive } = req.body;
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

            // Ensure isActive is either boolean or undefined
            let parsedIsActive = undefined;
            if (typeof isActive !== "undefined") {
                if (typeof isActive === "boolean") {
                    parsedIsActive = isActive;
                } else if (typeof isActive === "string") {
                    // Accept 'true'/'false' as string values from form-data
                    parsedIsActive = isActive === "true";
                }
            }

            const teamMember = { name, email, phone, designation, photo };
            if (typeof parsedIsActive !== "undefined") {
                teamMember.isActive = parsedIsActive;
            }

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
            const { name, email, phone, designation, isActive } = req.body;
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

            // Support isActive change
            if (typeof isActive !== "undefined") {
                if (typeof isActive === "boolean") {
                    teamMember.isActive = isActive;
                } else if (typeof isActive === "string") {
                    teamMember.isActive = isActive === "true";
                }
            }

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
        // Get search from query param instead of req.body
        const { search } = req.query;
        const autoshopOwnerId = req.user?.id;

        if (!search || typeof search !== "string" || search.trim() === "") {
            return res.status(400).json({ message: "A search parameter is required." });
        }

        // Try to find all car owners matching anywhere in name, phone, email, or numberplate
        // First, search for vehicles matching numberplate if search could be a numberplate fragment
        let vehicleIds = [];
        const vehicleDocs = await VehicleModel.find(
            {
                licensePlateNo: { $regex: search, $options: "i" }
            },
            { _id: 1 }
        );
        vehicleIds = vehicleDocs.map(v => v._id);

        // Build the OR query
        const orConditions = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
        ];

        if (vehicleIds.length > 0) {
            orConditions.push({ myVehicles: { $in: vehicleIds } });
        }

        const userQuery = {
            role: "carowner",
            $or: orConditions
        };

        // Fetch users, populate their vehicles
        const users = await User.find(userQuery)
            .select("-password")
            .populate({
                path: "myVehicles",
                model: "Vehicle",
            });

        // Check which users are already customers
        let alreadyCustomerIds = [];
        if (users.length > 0 && autoshopOwnerId) {
            const autoshopOwner = await User.findById(autoshopOwnerId).select("myCustomers").lean();
            if (autoshopOwner && autoshopOwner.myCustomers && Array.isArray(autoshopOwner.myCustomers)) {
                const customerIds = autoshopOwner.myCustomers.map(id => id.toString());
                alreadyCustomerIds = users
                    .filter(u => customerIds.includes(u._id.toString()))
                    .map(u => u._id.toString());
            }
        }

        // Mark each user with a flag if they are already myCustomer
        const usersWithCustomerStatus = users.map(u => ({
            ...u.toObject(),
            alreadyAddedAsCustomer: alreadyCustomerIds.includes(u._id.toString())
        }));

        return res.status(200).json({
            message: users.length > 0 ? "Car owner(s) found." : "No car owners found with the given search.",
            alreadyAddedCustomerIds: alreadyCustomerIds,
            data: usersWithCustomerStatus
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
        const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" }).lean();
        if (!autoshopOwner) {
            return res.status(403).json({ message: "Forbidden. Only autoshopowners can add customers." });
        }

        // Check if already in myCustomers
        const alreadyPresent = Array.isArray(autoshopOwner.myCustomers) 
            && autoshopOwner.myCustomers.some(id => id.toString() === carOwnerId.toString());

        // Always fetch fresh so we get up-to-date myCustomersMeta too.
        let updatedUser;

        if (!alreadyPresent) {
            // Add to myCustomers, and add a fresh entry in myCustomersMeta
            updatedUser = await User.findByIdAndUpdate(
                autoshopOwnerId,
                {
                    $addToSet: { myCustomers: carOwnerId },
                    $push: { myCustomersMeta: { customer: carOwnerId, addedAt: new Date() } }
                },
                { new: true }
            ).lean();
        } else {
            // If already present, ensure myCustomersMeta has an entry (only 1 entry per customer)
            const existingMetaUser = await User.findById(autoshopOwnerId)
                                        .select("myCustomersMeta")
                                        .lean();
            const hasMeta = Array.isArray(existingMetaUser.myCustomersMeta) &&
                existingMetaUser.myCustomersMeta.some(
                    meta =>
                        meta.customer &&
                        meta.customer.toString() === carOwnerId.toString()
                );
            if (!hasMeta) {
                updatedUser = await User.findByIdAndUpdate(
                    autoshopOwnerId,
                    { $push: { myCustomersMeta: { customer: carOwnerId, addedAt: new Date() } } },
                    { new: true }
                ).lean();
            } else {
                // No more updates needed; fetch the up-to-date version for consistency in response
                updatedUser = await User.findById(autoshopOwnerId)
                    .select("myCustomers myCustomersMeta")
                    .lean();
            }
        }

        return res.status(200).json({
            message: "Car owner added to myCustomers successfully.",
            myCustomers: updatedUser.myCustomers,
            myCustomersMeta: updatedUser.myCustomersMeta
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
        const { phone, numberPlate, dateType, date, week, month, year } = req.query;

        if (!autoshopOwnerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        // Find autoshop owner and check role
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

        // === Prepare myCustomersMeta 'addedAt' filter ===
        let startDate, endDate;
        let _dateType = dateType || "daily";
        const now = new Date();

        if (_dateType === "daily") {
            let localDate = date ? new Date(date) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
            startDate = new Date(localDate.setHours(0, 0, 0, 0));
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 1);
        } else if (_dateType === "weekly") {
            let current = week ? new Date(week) : new Date();
            let day = current.getDay();
            let diffToMonday = ((day + 6) % 7);
            startDate = new Date(current);
            startDate.setDate(current.getDate() - diffToMonday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);
        } else if (_dateType === "monthly") {
            let _year = year ? Number(year) : now.getFullYear();
            let _month;

            // Handle both string and number; allow "2" or 2 for February, "Feb", "February", etc.
            if (typeof month !== "undefined" && month !== null) {
                if (typeof month === "string" && isNaN(month)) {
                    // String name
                    const monthNames = [
                        "january", "february", "march", "april", "may", "june",
                        "july", "august", "september", "october", "november", "december"
                    ];
                    let monthLower = month.trim().toLowerCase();
                    _month = monthNames.findIndex(mn => mn.startsWith(monthLower));
                    if (_month === -1) _month = now.getMonth(); // fallback to current month
                } else {
                    // Number (from query or numeric string)
                    // Accept 1 for Jan, 12 for Dec (convert to 0-based)
                    let parsedNum = Number(month);
                    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
                        _month = parsedNum - 1;
                    } else {
                        _month = now.getMonth();
                    }
                }
            } else {
                _month = now.getMonth();
            }

            startDate = new Date(_year, _month, 1, 0, 0, 0, 0);
            endDate = new Date(_year, _month + 1, 1, 0, 0, 0, 0);
        }

        // --- Filter the customer's IDs by addedAt (myCustomersMeta) ---
        const relevantMyCustomersMeta = Array.isArray(autoshopOwner.myCustomersMeta)
            ? autoshopOwner.myCustomersMeta.filter(meta => {
                if (!meta.customer || !meta.addedAt) return false;
                const added = new Date(meta.addedAt);
                return (!startDate || added >= startDate) && (!endDate || added < endDate);
            })
            : [];
        // Only proceed with those customers added during the filtered period.
        const filteredCustomerIds = relevantMyCustomersMeta.map(meta => meta.customer && meta.customer.toString()).filter(Boolean);

        if (filteredCustomerIds.length === 0) {
            return res.status(200).json({ myCustomers: [] });
        }

        // Build DB query for User customers ("carowner"s owned by this shop, plus filters)
        let customersQuery = User.find({
            _id: { $in: filteredCustomerIds }
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

        // Gather service IDs from myServices
        const myServiceIds = myServices.map(ms => ms.service && ms.service.toString()).filter(Boolean);

        // Fetch all master services
        const allMasterServices = await servicesSchema.find({}).lean();

        // Map for quick lookup by _id.toString()
        const masterServicesMap = {};
        for (const svc of allMasterServices) {
            masterServicesMap[svc._id.toString()] = svc;
        }

        // Map myServices to response format (with selected subservices)
        const result = [];

        // Track the IDs in myServices we found
        const foundMyServiceIdsSet = new Set();

        myServices.forEach(ms => {
            const serviceIdStr = ms.service && ms.service.toString();
            if (serviceIdStr && masterServicesMap[serviceIdStr]) {
                foundMyServiceIdsSet.add(serviceIdStr);
                result.push({
                    service: {
                        id: masterServicesMap[serviceIdStr]._id,
                        name: masterServicesMap[serviceIdStr].name,
                        desc: masterServicesMap[serviceIdStr].desc,
                    },
                    selectedSubServices: Array.isArray(ms.subServices)
                        ? ms.subServices.map(sub => ({
                            name: sub.name,
                            desc: sub.desc,
                            price: sub.price
                        }))
                        : []
                });
            }
        });

        // Add services NOT in myServices, with empty subservices
        allMasterServices.forEach(masterSvc => {
            const svcIdString = masterSvc._id.toString();
            if (!foundMyServiceIdsSet.has(svcIdString)) {
                result.push({
                    service: {
                        id: masterSvc._id,
                        name: masterSvc.name,
                        desc: masterSvc.desc,
                    },
                    selectedSubServices: []
                });
            }
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

            // If service is present, get list of currently existing sub service names
            let existingSubServiceNames = new Set();
            if (msIdx !== undefined) {
                const exSubServices = businessProfile.myServices[msIdx].subServices || [];
                for (const sub of exSubServices) {
                    if (typeof sub.name === "string") {
                        existingSubServiceNames.add(sub.name.trim().toLowerCase());
                    }
                }
            }

            if (msIdx === undefined) {
                // Not present at all: Add it (but check for duplicate subservice names in new list)
                const seenNames = new Set();
                for (const sub of incomingSubServices) {
                    if (typeof sub.name === "string") {
                        const lower = sub.name.trim().toLowerCase();
                        if (seenNames.has(lower)) {
                            return res.status(400).json({ message: `Duplicate subService name "${sub.name}" in submitted list for service "${serviceBlock.id}".` });
                        }
                        seenNames.add(lower);
                    }
                }
                businessProfile.myServices.push({
                    service: serviceBlock.id,
                    subServices: incomingSubServices
                });
            } else {
                // Already present: For any incoming subService, check if the name already exists 
                for (const sub of incomingSubServices) {
                    if (typeof sub.name === "string") {
                        const lower = sub.name.trim().toLowerCase();
                        if (existingSubServiceNames.has(lower)) {
                            return res.status(400).json({ message: `SubService with name "${sub.name}" already exists for service "${serviceBlock.id}".` });
                        }
                    }
                }

                // We'll use (name+desc+price) as uniqueness for custom subServices
                const exSubServices = businessProfile.myServices[msIdx].subServices || [];
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
   * Get all vehicle types and all services in one response.
   * Returns:
   *  {
   *    success: true,
   *    vehicleTypes: [...],
   *    services: [...]
   *  }
   */
  async getAllVehicleTypesAndServices(req, res) {
    try {
      const [vehicleTypes, services, carDetails] = await Promise.all([
        VehicleType.find({}).sort({ createdAt: -1 }).lean(),
        Services.find({}).sort({ createdAt: -1 }).lean(),
        CarDetailsModel.find({}).lean()
      ]);

      // Group car details by company, then for each company 
      // generate objects of {id, model, year}
      const carDetailsGrouped = [];
      for (const company of carDetails) {
        if (company?.companyName && Array.isArray(company.models)) {
          const modelsList = [];
          for (const model of company.models) {
            if (model?.modelName && Array.isArray(model.years)) {
              for (const year of model.years) {
                modelsList.push({
                  id: company._id?.toString?.() ?? undefined,
                  name:company.companyName,
                  model: model.modelName,
                  year: year
                });
              }
            }
          }
          carDetailsGrouped.push({
            company: company.companyName,
            id:company._id,
            models: modelsList
          });
        }
      }

      return res.status(200).json({
        success: true,
        services,
        carDetails: carDetailsGrouped
      });
    } catch (error) {
      console.error("[getAllVehicleTypesAndServices] Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch vehicle types, services, and car details"
      });
    }
  }

/**
 * Create a new deal (Service or Parts) and link it to the creator's business profile.
 * Now receives: dealType, servicesId, partName, description, discountedPrice, offerEndsOnDate,
 *   vehicleId, vehicleName, vehicleModel, vehicleYear (flat fields in body, not selectedVehicle object)
 * - If Service: uses servicesId only.
 * - If Parts: uses partName and vehicle* fields for vehicle info.
 * - Adds the deal's _id to BusinessProfile.myDeals.
 * - Sets Deal.createdBy to businessProfile._id.
 */
async createDeal(req, res) {
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

        let {
            dealType,
            servicesId,   // For Service deals
            partName,     // For Parts deals
            description,
            discountedPrice,
            offerEndsOnDate,
            vehicleId,    // For Parts deals
            vehicleName,
            vehicleModel,
            vehicleYear
        } = req.body;

        // Clean up inputs
        dealType = typeof dealType === "string" ? dealType.trim() : dealType;
        partName = typeof partName === "string" ? partName.trim() : undefined;
        description = typeof description === "string" ? description.trim() : "";
        discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
        servicesId = typeof servicesId === "string" ? servicesId.trim() : undefined;
        vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : undefined;
        vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : undefined;
        vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : undefined;
        vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : vehicleYear;

        // Validate dealType
        if (!dealType || (dealType !== "Service" && dealType !== "Parts")) {
            return res.status(400).json({
                success: false,
                message: "dealType is required and must be 'Service' or 'Parts'."
            });
        }

        // For "Service" deals, require servicesId (service _id)
        if (dealType === "Service") {
            if (!servicesId || !mongoose.Types.ObjectId.isValid(servicesId)) {
                return res.status(400).json({
                    success: false,
                    message: "servicesId is required and must be a valid MongoDB ObjectId for 'Service' deals."
                });
            }
            const service = await Services.findById(servicesId).lean();
            if (!service) {
                return res.status(404).json({ success: false, message: "The specified servicesId does not correspond to a valid service." });
            }
        }

        // For "Parts" deals, require partName and vehicleId & info in body
        if (dealType === "Parts") {
            if (!partName) {
                return res.status(400).json({ success: false, message: "partName is required for dealType 'Parts'." });
            }
            if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
                return res.status(400).json({ success: false, message: "vehicleId is required and must be a valid MongoDB ObjectId for 'Parts' deals." });
            }
            // vehicleName, vehicleModel, vehicleYear are not required by DB but should be present
            if (!vehicleName || !vehicleModel || !vehicleYear) {
                return res.status(400).json({ success: false, message: "vehicleName, vehicleModel, and vehicleYear are required for 'Parts' deals." });
            }
        }

        // Mandatory: description
        if (typeof description !== "string" || description.trim().length === 0) {
            return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
        }

        // Mandatory: discountedPrice (must be number >= 0)
        if (
            discountedPrice === undefined ||
            discountedPrice === null ||
            typeof discountedPrice !== "number" ||
            isNaN(discountedPrice) ||
            discountedPrice < 0
        ) {
            return res.status(400).json({ success: false, message: "discountedPrice is required and must be a number greater than or equal to zero." });
        }

        // offerEndsOnDate validation (expecting ISO format and in the future)
        if (!offerEndsOnDate || typeof offerEndsOnDate !== "string") {
            return res.status(400).json({ success: false, message: "offerEndsOnDate is required and must be a string in ISO format." });
        }
        let offerEndsDate = new Date(offerEndsOnDate);
        if (isNaN(offerEndsDate.getTime()) || offerEndsDate <= new Date()) {
            return res.status(400).json({
                success: false,
                message: "offerEndsOnDate must be a valid ISO date string and must be in the future."
            });
        }

        // Prevent duplicate: businessProfile._id, dealType, (servicesId or partName+vehicleId)
        let uniqueQuery = {
            dealType,
            createdBy: businessProfile._id
        };
        if (dealType === "Service") {
            uniqueQuery.servicesId = servicesId;
        } else {
            uniqueQuery.partName = partName;
            uniqueQuery.vehicle = vehicleId;
        }
        const duplicateDeal = await DealModel.findOne(uniqueQuery).lean();
        if (duplicateDeal) {
            return res.status(400).json({
                success: false,
                message: "A deal with these values already exists for your business profile."
            });
        }

        // Build deal document
        let dealDoc = {
            dealType,
            description,
            discountedPrice,
            offerEndsOnDate: offerEndsDate,
            createdBy: businessProfile._id
        };

        if (dealType === "Service") {
            dealDoc.serviceId = servicesId;
        } else {
            dealDoc.partName = partName;
            dealDoc.vehicle = vehicleId;
            // Store expanded vehicle fields as selectedVehicle object (id, name, modelName, year)
            dealDoc.selectedVehicle = {
                id: vehicleId,
                name: vehicleName,
                model: vehicleModel,
                year: vehicleYear
            };
        }

        console.log(dealDoc);

        const deal = new DealModel(dealDoc);
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
 * Edit an existing deal (only if current business profile created it).
 * Only allowed if dealType/owner matches. Can update all fields except createdBy.
 * Now receives: dealType, servicesId, partName, description, discountedPrice, offerEndsOnDate,
 *   vehicleId, vehicleName, vehicleModel, vehicleYear
 * - If Service: uses servicesId.
 * - If Parts: uses partName and vehicle*.
 */
async editDeal(req, res) {
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

        // Fetch current deal for validation/context
        let deal = await DealModel.findOne({ _id: id, createdBy: businessProfileId }).lean();
        if (!deal) {
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }
        let updates = {};

        // Parse allowed fields from body
        let {
            dealType,
            servicesId,
            partName,
            description,
            discountedPrice,
            offerEndsOnDate,
            vehicleId,
            vehicleName,
            vehicleModel,
            vehicleYear
        } = req.body;

        // Parse/clean fields
        dealType = typeof dealType === "string" ? dealType.trim() : deal.dealType;
        updates.dealType = dealType;

        if (dealType === "Service") {
            if (typeof servicesId === "undefined" || servicesId === null) {
                servicesId = deal.servicesId;
            }
            if (!servicesId || !mongoose.Types.ObjectId.isValid(servicesId)) {
                return res.status(400).json({
                    success: false,
                    message: "servicesId is required and must be a valid ObjectId for 'Service' deals."
                });
            }
            const service = await Services.findById(servicesId).lean();
            if (!service) {
                return res.status(404).json({ success: false, message: "The specified servicesId does not correspond to a valid service." });
            }
            updates.servicesId = servicesId;
            updates.partName = undefined;
            updates.vehicle = undefined;
            updates.selectedVehicle = undefined;
        }

        if (dealType === "Parts") {
            partName = typeof partName === "string" ? partName.trim() : deal.partName;
            vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : vehicleId;
            vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : vehicleName;
            vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : vehicleModel;
            vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : vehicleYear;

            if (!partName) {
                return res.status(400).json({ success: false, message: "partName is required for dealType 'Parts'." });
            }
            if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
                return res.status(400).json({ success: false, message: "vehicleId is required and must be a valid ObjectId for 'Parts' deals." });
            }
            if (!vehicleName || !vehicleModel || !vehicleYear) {
                return res.status(400).json({ success: false, message: "vehicleName, vehicleModel, and vehicleYear are required for 'Parts' deals." });
            }
            updates.partName = partName;
            updates.vehicle = vehicleId;
            updates.selectedVehicle = {
                id: vehicleId,
                name: vehicleName,
                modelName: vehicleModel,
                year: vehicleYear
            };
            updates.servicesId = undefined;
        }

        // Common fields updating
        if (typeof description !== "undefined") {
            if (typeof description !== "string" || !description.trim()) {
                return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
            }
            updates.description = description.trim();
        }
        if (typeof discountedPrice !== "undefined") {
            discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
            if (
                discountedPrice === undefined ||
                discountedPrice === null ||
                typeof discountedPrice !== "number" ||
                isNaN(discountedPrice) ||
                discountedPrice < 0
            ) {
                return res.status(400).json({ success: false, message: "discountedPrice is required and must be a number greater than or equal to zero." });
            }
            updates.discountedPrice = discountedPrice;
        }
        if (typeof offerEndsOnDate !== "undefined") {
            const offerDate = typeof offerEndsOnDate === "string" ? new Date(offerEndsOnDate) : offerEndsOnDate;
            if (!offerDate || isNaN(offerDate.getTime()) || offerDate <= new Date()) {
                return res.status(400).json({
                    success: false, 
                    message: "offerEndsOnDate must be a valid ISO date string and must be in the future."
                });
            }
            updates.offerEndsOnDate = offerDate;
        }

        // Check for duplicates (excluding current deal)
        let duplicateQuery = { dealType, createdBy: businessProfileId, _id: { $ne: id } };
        if (dealType === "Service") {
            duplicateQuery.servicesId = updates.servicesId;
        }
        if (dealType === "Parts") {
            duplicateQuery.partName = updates.partName;
            duplicateQuery.vehicle = updates.vehicle;
        }
        const duplicateDeal = await DealModel.findOne(duplicateQuery).lean();
        if (duplicateDeal) {
            return res.status(400).json({
                success: false,
                message: "A deal with these values already exists for your business profile."
            });
        }

        // Remove fields not present per schema/type
        if (dealType === "Service") {
            delete updates.partName;
            delete updates.vehicle;
            delete updates.selectedVehicle;
        } else if (dealType === "Parts") {
            delete updates.servicesId;
        }

        // Never allow editing createdBy
        delete updates.createdBy;

        const updatedDeal = await DealModel.findOneAndUpdate(
            { _id: id, createdBy: businessProfileId },
            updates,
            { new: true }
        );
        if (!updatedDeal) {
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }
        return res.status(200).json({ success: true, message: "Deal updated", data: updatedDeal });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error updating deal", error: error.message });
    }
}

/**
 * Delete a deal by ID (only if created by the current business profile).
 * Removes the deal's _id from BusinessProfile.myDeals.
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
 * Returns full Deal documents as an array, grouped by dealType ("Service" or "Parts").
 * Service deals include service info (servicesId), parts include partName and selectedVehicle fields.
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

        // Prepare deals to fetch
        const dealIds = (businessProfile.myDeals || []).map(id =>
            typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
        );

        // Fetch all deals for this business, along with service details if dealType Service
        const deals = await DealModel.find({
            _id: { $in: dealIds },
            createdBy: businessProfile._id
        })
            .populate({ path: "serviceId", select: "name desc", strictPopulate: false })
            .populate({ path: "createdBy", select: "name _id", strictPopulate: false })
            .lean();

        let serviceDeals = [];
        let partsDeals = [];

        deals.forEach(deal => {
            if (deal.dealType === "Service") {
                // Attach full service details from serviceId
                let serviceObj = null;
                if (deal.serviceId && (deal.serviceId.name || deal.serviceId.desc)) {
                    serviceObj = {
                        _id: deal.serviceId._id,
                        name: deal.serviceId.name,
                        desc: deal.serviceId.desc
                    };
                }
                serviceDeals.push({
                    dealType: deal.dealType,
                    service: serviceObj,
                    serviceId: serviceObj ? serviceObj._id : (deal.serviceId && deal.serviceId._id ? deal.serviceId._id : deal.serviceId),
                    description: deal.description,
                    discountedPrice: deal.discountedPrice,
                    offerEndsOnDate: deal.offerEndsOnDate,
                    createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
                    _id: deal._id
                });
            }

            if (deal.dealType === "Parts") {
                // Include selectedVehicle fields from deal (flat fields in deal.selectedVehicle)
                let selectedVehicle = null;
                if (
                    deal.selectedVehicle &&
                    typeof deal.selectedVehicle === "object" &&
                    deal.selectedVehicle.id
                ) {
                    selectedVehicle = {
                        id: deal.selectedVehicle.id,
                        name: deal.selectedVehicle.name,
                        model: deal.selectedVehicle.model, // Use 'model' as per deals.schema.js
                        year: deal.selectedVehicle.year
                    };
                }
                partsDeals.push({
                    dealType: deal.dealType,
                    partName: deal.partName,
                    selectedVehicle,
                    description: deal.description,
                    discountedPrice: deal.discountedPrice,
                    offerEndsOnDate: deal.offerEndsOnDate,
                    createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
                    _id: deal._id
                });
            }
        });

        // Sort services deals by service name, parts by partName
        serviceDeals.sort((a, b) => {
            const nameA = a.service && a.service.name ? String(a.service.name) : "";
            const nameB = b.service && b.service.name ? String(b.service.name) : "";
            return nameA.localeCompare(nameB);
        });
        partsDeals.sort((a, b) => {
            if (a.partName && b.partName) return String(a.partName).localeCompare(String(b.partName));
            if (a.partName) return -1;
            if (b.partName) return 1;
            return 0;
        });

        return res.status(200).json({
            success: true,
            serviceDeals,
            partsDeals
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

    // Import Counter and JobCard if not already imported at top of file:
    // import Counter from "../../Schema/counter.schema.js"; 
    // import JobCard from "../../Schema/jobCard.schema.js";

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

        // Add new fields
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
            technicalRemarks,
            labourCharge,    // <--- Added Number
            labourDuration   // <--- Added String
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

        // Optional: If you want to require these fields, uncomment below
        // if (labourCharge === undefined) missingFields.push("labourCharge");
        // if (!labourDuration) missingFields.push("labourDuration");

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

        // Calculate total amount
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

        // Add labour charge if provided
        let totalWithLabour = totalAmount;
        let parsedLabourCharge = 0;
        if (labourCharge !== undefined && !isNaN(parseFloat(labourCharge))) {
            parsedLabourCharge = parseFloat(labourCharge);
            totalWithLabour += parsedLabourCharge;
        }

        // ====== Generate jobNo using Counter collection ======
        let jobNo;
        try {
            // Use a transaction-like retry in case of very high concurrency
            // This increments the 'jobNo' counter and returns the new value atomically
            const counter = await counterSchema.findOneAndUpdate(
                { name: "jobNo" },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );

            if (counter && typeof counter.seq === "number") {
                // Format: J00001 (5 digits with leading zeros)
                const formatted = String(counter.seq).padStart(5, '0');
                jobNo = `J${formatted}`;
            } else {
                throw new Error("Failed to generate jobNo: Counter sequence is undefined");
            }
        } catch (e) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            console.error("[createJobCard] Error generating jobNo:", e);
            return res.status(500).json({ success: false, message: "Could not generate job number", error: e.message });
        }

        // Create the job card document
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
            totalPayableAmount: Number(totalWithLabour.toFixed(2)),
            // ---- Added fields below ----
            labourCharge: parsedLabourCharge,
            labourDuration: typeof labourDuration === "string" ? labourDuration : undefined,
            // ------------------------------
            status: "Pending",
            jobNo
        });

        await jobCardDoc.save();

        return res.status(201).json({
            success: true,
            message: "JobCard created successfully",
            data: {
                ...jobCardDoc.toObject(),
                totalPayableAmount: Number(totalWithLabour.toFixed(2)),
                services: servicesPayload,
                labourCharge: parsedLabourCharge,
                labourDuration: typeof labourDuration === "string" ? labourDuration : undefined
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
 * Edit an existing JobCard for an auto shop owner.
 * Allows updates only for JobCards belonging to this business.
 * Only allows edits if the JobCard status is still "Pending".
 * 
 * Expects:
 *   - req.params.jobCardId: ID of the job card to edit (in URL)
 *   - req.body: updatable fields (same as createJobCard, except status/jobNo/business/customerId/vehicleId cannot be changed)
 *   - Accepts new vehicle photos from req.files["vehiclePhotos"] (will append if < 5, or replace all if replacePhotos=true in body)
 * 
 * Returns updated JobCard document.
 */
async editJobCard(req, res) {
    // Accept vehiclePhotos from file uploads (multer) via req.files["vehiclePhotos"]
    // If there is an error anywhere that requires aborting, cleanup file uploads!

    const { jobCardId } = req.params;

    try {
        // Find the job card, user, and validate permissions
        const user = await User.findById(req.user.id);
        if (!user || !user.businessProfile) {
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(404).json({ success: false, message: "Business profile not found for user" });
        }
        const businessId = user.businessProfile;


        const jobCard = await JobCard.findById(jobCardId);
        if (!jobCard) {
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(404).json({ success: false, message: "JobCard not found" });
        }

        if (String(jobCard.business) !== String(businessId)) {
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(403).json({ success: false, message: "You do not have permission to edit this job card" });
        }

        if (jobCard.status !== "Pending") {
            if (req.files && req.files["vehiclePhotos"]) await deleteUploadedFiles(req.files["vehiclePhotos"]);
            return res.status(400).json({ success: false, message: "Cannot edit JobCard after it is approved or rejected" });
        }

        // Handle file uploads
        let uploadedPhotos = [];
        if (req.files && req.files["vehiclePhotos"]) {
            if (Array.isArray(req.files["vehiclePhotos"])) {
                uploadedPhotos = req.files["vehiclePhotos"];
            } else {
                uploadedPhotos = [req.files["vehiclePhotos"]];
            }
        }
        const uploadedPhotoPaths = uploadedPhotos.map(f => f.path || f.location || f.filename).filter(Boolean);

        // Merge or replace photos
        let finalVehiclePhotos = Array.isArray(jobCard.vehiclePhotos) ? [...jobCard.vehiclePhotos] : [];
        const maxPhotos = 5;
        const { replacePhotos } = req.body;

        if (replacePhotos === "true" || replacePhotos === true) {
            // Replace all
            if (finalVehiclePhotos.length && uploadedPhotoPaths.length) {
                await deleteUploadedFiles(finalVehiclePhotos);
            }
            finalVehiclePhotos = [...uploadedPhotoPaths];
        } else if (uploadedPhotoPaths.length) {
            // Append (if under limit)
            if (finalVehiclePhotos.length + uploadedPhotoPaths.length > maxPhotos) {
                await deleteUploadedFiles(uploadedPhotos);
                return res.status(400).json({ success: false, message: `Maximum ${maxPhotos} vehiclePhotos allowed` });
            }
            finalVehiclePhotos = finalVehiclePhotos.concat(uploadedPhotoPaths);
        }

        if (finalVehiclePhotos.length > maxPhotos) {
            // Defensive check (should never happen with above logic)
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: `Maximum ${maxPhotos} vehiclePhotos allowed` });
        }

        // Updatable fields
        // Parse services if needed
        let servicesPayload = [];
        let totalAmount = 0;
        if (req.body.services) {
            let services = req.body.services;
            if (typeof services === "string") {
                try {
                    services = JSON.parse(services);
                } catch (e) {
                    if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                    return res.status(400).json({ success: false, message: "Invalid services JSON format" });
                }
            }
            // Validate against business profile
            const businessProfile = await BusinessProfileModel.findById(businessId).lean();
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

            // Calculate amounts
            servicesPayload = (services || []).map(serviceItem => {
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
        } else {
            // If not updating services, use old ones and keep price as is
            servicesPayload = jobCard.services;
            let sum = 0;
            for (const sv of (Array.isArray(jobCard.services) ? jobCard.services : [])) {
                for (const sub of (Array.isArray(sv.subServices) ? sv.subServices : [])) {
                    sum += Number(sub.price || 0);
                }
            }
            totalAmount = sum;
        }

        // Validate enums if present
        const allowedServiceTypes = ['Repair', 'Maintenance', 'Inspection'];
        const allowedPriorityLevels = ['Normal', 'Urgent'];
        if (req.body.serviceType && !allowedServiceTypes.includes(req.body.serviceType)) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Invalid serviceType" });
        }
        if (req.body.priorityLevel && !allowedPriorityLevels.includes(req.body.priorityLevel)) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Invalid priorityLevel" });
        }

        // Labour charge
        let parsedLabourCharge = req.body.labourCharge !== undefined
            ? parseFloat(req.body.labourCharge)
            : (typeof jobCard.labourCharge === "number" ? jobCard.labourCharge : 0);
        if (isNaN(parsedLabourCharge)) parsedLabourCharge = 0;
        // If updating labourCharge in the request, add to total
        let totalWithLabour = totalAmount;
        if (req.body.labourCharge !== undefined) {
            totalWithLabour += parsedLabourCharge;
        } else if (typeof jobCard.labourCharge === "number" && !isNaN(jobCard.labourCharge)) {
            totalWithLabour += Number(jobCard.labourCharge);
        }

        // Updatable fields
        const fieldsToUpdate = {
            odometerReading: req.body.odometerReading !== undefined ? req.body.odometerReading : jobCard.odometerReading,
            dueOdometerReading: req.body.dueOdometerReading !== undefined ? req.body.dueOdometerReading : jobCard.dueOdometerReading,
            issueDescription: (req.body.issueDescription !== undefined ? req.body.issueDescription : jobCard.issueDescription),
            serviceType: req.body.serviceType !== undefined ? req.body.serviceType : jobCard.serviceType,
            priorityLevel: req.body.priorityLevel !== undefined ? req.body.priorityLevel : jobCard.priorityLevel,
            services: servicesPayload,
            additionalNotes: req.body.additionalNotes !== undefined ? req.body.additionalNotes : jobCard.additionalNotes,
            vehiclePhotos: finalVehiclePhotos,
            technicalRemarks: req.body.technicalRemarks !== undefined ? req.body.technicalRemarks : jobCard.technicalRemarks,
            totalPayableAmount: Number(totalWithLabour.toFixed(2)),
            labourCharge: parsedLabourCharge,
            labourDuration: req.body.labourDuration !== undefined
                ? (typeof req.body.labourDuration === "string" ? req.body.labourDuration : undefined)
                : jobCard.labourDuration,
        };

        // Perform the update
        for (const key in fieldsToUpdate) {
            jobCard[key] = fieldsToUpdate[key];
        }

        await jobCard.save();

        return res.status(200).json({
            success: true,
            message: "JobCard updated successfully",
            data: {
                ...jobCard.toObject(),
                totalPayableAmount: Number(totalWithLabour.toFixed(2)),
                services: servicesPayload,
                labourCharge: parsedLabourCharge,
                labourDuration: fieldsToUpdate.labourDuration
            }
        });
    } catch (err) {
        // Delete uploaded files if something broke
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
 * Delete a JobCard by ID (only if it belongs to this business).
 * Cleans up uploaded vehicle photos.
 * 
 * Expects:
 *   - req.params.jobCardId: ID of the job card to delete (in URL)
 * 
 * Returns success/failure.
 */
async deleteJobCard(req, res) {
    const { jobCardId } = req.params;
    try {
        // Find user and validate
        const user = await User.findById(req.user.id);
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found for user" });
        }
        const businessId = user.businessProfile;

        // Find the JobCard
        const jobCard = await JobCard.findById(jobCardId);
        if (!jobCard) {
            return res.status(404).json({ success: false, message: "JobCard not found" });
        }

        // Ensure this JobCard belongs to the logged-in user's business
        if (String(jobCard.business) !== String(businessId)) {
            return res.status(403).json({ success: false, message: "You do not have permission to delete this JobCard" });
        }

        // Clean up vehicle photos if any
        if (Array.isArray(jobCard.vehiclePhotos) && jobCard.vehiclePhotos.length > 0) {
            await deleteUploadedFiles(jobCard.vehiclePhotos);
        }

        // Delete the JobCard
        await JobCard.deleteOne({ _id: jobCardId });

        return res.status(200).json({ success: true, message: "JobCard deleted successfully" });
    } catch (err) {
        console.error("[deleteJobCard] Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete JobCard",
            error: err.message
        });
    }
}




/**
 * Search JobCards by multiple fields:
 * - JobNo (exact or partial)
 * - Car Owner Name
 * - Vehicle info (model, brand, regNo, VIN, etc)
 * - Car Owner Phone Number
 * - Car Owner Email
 *
 * This search works across all those fields and supports text/partial matches.
 *
 * Params:
 *   - req.query.q: Search string (required)
 *   - req.query.limit (optional)
 *   - req.query.page (optional)
 */
// Search JobCards by multiple fields: JobNo (partial), Car Owner Name, Vehicle info, Car Owner Phone, Car Owner Email
async searchJobCards(req, res) {
    try {
        const userId = req.user.id;
        const { q, page = 1, limit = 10 } = req.query;

        // Get the current auto shop owner's business profile
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found for user" });
        }

        const businessId = user.businessProfile;
        const searchStr = typeof q === "string" ? q.trim() : "";

        // If q is provided and not empty, do NOT use any other filters, search in all data for this business
        if (searchStr.length > 0) {
            const pipeline = [
                {
                    $match: {
                        business: typeof businessId === "string" ? Types.ObjectId(businessId) : businessId
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "customerId",
                        foreignField: "_id",
                        as: "customer"
                    }
                },
                { $unwind: "$customer" },
                {
                    $lookup: {
                        from: "vehicles",
                        localField: "vehicleId",
                        foreignField: "_id",
                        as: "vehicle"
                    }
                },
                { $unwind: "$vehicle" },
                {
                    $match: {
                        $or: [
                            { jobNo: { $regex: searchStr, $options: "i" } },
                            { "customer.name": { $regex: searchStr, $options: "i" } },
                            { "vehicle.regNo": { $regex: searchStr, $options: "i" } },
                            { "customer.phoneNumber": { $regex: searchStr, $options: "i" } },
                            { "customer.email": { $regex: searchStr, $options: "i" } }
                        ]
                    }
                },
                { $sort: { createdAt: -1 } },
                { $skip: (Number(page) - 1) * Number(limit) },
                { $limit: Number(limit) },
                {
                    $project: {
                        _id: 1,
                        jobNo: 1,
                        status: 1,
                        paymentStatus: 1,
                        serviceType: 1,
                        priorityLevel: 1,
                        createdAt: 1,
                        totalPayableAmount: 1,
                        vehiclePhotos: 1,
                        dealApplied: 1,
                        odometerReading: 1,
                        dueOdometerReading: 1,
                        issueDescription: 1,
                        services: 1,
                        additionalNotes: 1,
                        technicalRemarks: 1,
                        labourCharge: 1,
                        labourDuration: 1,
                        customer: {
                            _id: "$customer._id",
                            name: "$customer.name",
                            phoneNumber: "$customer.phoneNumber",
                            email: "$customer.email"
                        },
                        vehicle: {
                            _id: "$vehicle._id",
                            brand: "$vehicle.brand",
                            model: "$vehicle.model",
                            regNo: "$vehicle.regNo",
                            vin: "$vehicle.vin"
                        }
                    }
                }
            ];

            const results = await JobCard.aggregate(pipeline);

            // For total count (with only search filter)
            const countPipeline = [
                {
                    $match: {
                        business: typeof businessId === "string" ? Types.ObjectId(businessId) : businessId
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "customerId",
                        foreignField: "_id",
                        as: "customer"
                    }
                },
                { $unwind: "$customer" },
                {
                    $lookup: {
                        from: "vehicles",
                        localField: "vehicleId",
                        foreignField: "_id",
                        as: "vehicle"
                    }
                },
                { $unwind: "$vehicle" },
                {
                    $match: {
                        $or: [
                            { jobNo: { $regex: searchStr, $options: "i" } },
                            { "customer.name": { $regex: searchStr, $options: "i" } },
                            { "vehicle.regNo": { $regex: searchStr, $options: "i" } },
                            { "customer.phoneNumber": { $regex: searchStr, $options: "i" } },
                            { "customer.email": { $regex: searchStr, $options: "i" } }
                        ]
                    }
                },
                { $count: "total" }
            ];

            const totalResult = await JobCard.aggregate(countPipeline);
            const total = totalResult.length > 0 ? totalResult[0].total : 0;

            return res.status(200).json({
                success: true,
                total,
                page: Number(page),
                pageSize: results.length,
                data: results
            });
        }

        // If no q, proceed with default filtering (dates etc)
        const {
            dateType,
            date,
            week,
            month,
            year
        } = req.query;

        const emptySearch = (
            (!q || (typeof q === "string" && q.trim().length === 0)) &&
            !dateType && !date && !week && typeof month === "undefined" && typeof year === "undefined"
        );

        if (emptySearch) {
            // If no search, show paginated results for the business
            const pipeline = [
                {
                    $match: {
                        business: typeof businessId === "string" ? Types.ObjectId(businessId) : businessId
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "customerId",
                        foreignField: "_id",
                        as: "customer"
                    }
                },
                { $unwind: "$customer" },
                {
                    $lookup: {
                        from: "vehicles",
                        localField: "vehicleId",
                        foreignField: "_id",
                        as: "vehicle"
                    }
                },
                { $unwind: "$vehicle" },
                { $sort: { createdAt: -1 } },
                { $skip: (Number(page) - 1) * Number(limit) },
                { $limit: Number(limit) },
                {
                    $project: {
                        _id: 1,
                        jobNo: 1,
                        status: 1,
                        paymentStatus: 1,
                        serviceType: 1,
                        priorityLevel: 1,
                        createdAt: 1,
                        totalPayableAmount: 1,
                        vehiclePhotos: 1,
                        dealApplied: 1,
                        odometerReading: 1,
                        dueOdometerReading: 1,
                        issueDescription: 1,
                        services: 1,
                        additionalNotes: 1,
                        technicalRemarks: 1,
                        labourCharge: 1,
                        labourDuration: 1,
                        customer: {
                            _id: "$customer._id",
                            name: "$customer.name",
                            phoneNumber: "$customer.phoneNumber",
                            email: "$customer.email"
                        },
                        vehicle: {
                            _id: "$vehicle._id",
                            brand: "$vehicle.brand",
                            model: "$vehicle.model",
                            regNo: "$vehicle.regNo",
                            vin: "$vehicle.vin"
                        }
                    }
                }
            ];

            const results = await JobCard.aggregate(pipeline);
            // For total count
            const countPipeline = [
                {
                    $match: {
                        business: typeof businessId === "string" ? Types.ObjectId(businessId) : businessId
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "customerId",
                        foreignField: "_id",
                        as: "customer"
                    }
                },
                { $unwind: "$customer" },
                {
                    $lookup: {
                        from: "vehicles",
                        localField: "vehicleId",
                        foreignField: "_id",
                        as: "vehicle"
                    }
                },
                { $unwind: "$vehicle" },
                { $count: "total" }
            ];
            const totalResult = await JobCard.aggregate(countPipeline);
            const total = totalResult.length > 0 ? totalResult[0].total : 0;

            return res.status(200).json({
                success: true,
                total,
                page: Number(page),
                pageSize: results.length,
                data: results
            });
        }

        // If filters (dateType/date/week/month/year) are provided and q is NOT present
        let createdAtMatch = {};
        let _dateType = dateType || "daily";
        let startDate, endDate;
        const now = new Date();
        if (_dateType === "daily") {
            let localDate = date ? new Date(date) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
            startDate = new Date(localDate.setHours(0, 0, 0, 0));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
        } else if (_dateType === "weekly") {
            let current = week ? new Date(week) : new Date();
            let day = current.getDay();
            let diffToMonday = ((day + 6) % 7);
            startDate = new Date(current);
            startDate.setDate(current.getDate() - diffToMonday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);
        } else if (_dateType === "monthly") {
            let _year = year ? Number(year) : now.getFullYear();
            let _month;
            if (typeof month === "string" && isNaN(month)) {
                const monthNames = [
                    "january", "february", "march", "april", "may", "june",
                    "july", "august", "september", "october", "november", "december"
                ];
                _month = monthNames.findIndex(mn =>
                    mn.startsWith(month.trim().toLowerCase())
                );
                if (_month === -1) _month = now.getMonth();
            } else {
                _month = (typeof month !== "undefined") ? Number(month) : now.getMonth();
            }
            startDate = new Date(_year, _month, 1, 0, 0, 0, 0);
            endDate = new Date(_year, _month + 1, 1, 0, 0, 0, 0);
        }
        if (startDate && endDate) {
            createdAtMatch.createdAt = { $gte: startDate, $lt: endDate };
        }

        const pipeline = [
            {
                $match: {
                    business: typeof businessId === "string" ? Types.ObjectId(businessId) : businessId,
                    ...createdAtMatch
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            { $unwind: "$customer" },
            {
                $lookup: {
                    from: "vehicles",
                    localField: "vehicleId",
                    foreignField: "_id",
                    as: "vehicle"
                }
            },
            { $unwind: "$vehicle" },
            { $sort: { createdAt: -1 } },
            { $skip: (Number(page) - 1) * Number(limit) },
            { $limit: Number(limit) },
            {
                $project: {
                    _id: 1,
                    jobNo: 1,
                    status: 1,
                    paymentStatus: 1,
                    serviceType: 1,
                    priorityLevel: 1,
                    createdAt: 1,
                    totalPayableAmount: 1,
                    vehiclePhotos: 1,
                    dealApplied: 1,
                    odometerReading: 1,
                    dueOdometerReading: 1,
                    issueDescription: 1,
                    services: 1,
                    additionalNotes: 1,
                    technicalRemarks: 1,
                    labourCharge: 1,
                    labourDuration: 1,
                    customer: {
                        _id: "$customer._id",
                        name: "$customer.name",
                        phoneNumber: "$customer.phoneNumber",
                        email: "$customer.email"
                    },
                    vehicle: {
                        _id: "$vehicle._id",
                        brand: "$vehicle.brand",
                        model: "$vehicle.model",
                        regNo: "$vehicle.regNo",
                        vin: "$vehicle.vin"
                    }
                }
            }
        ];

        const results = await JobCard.aggregate(pipeline);

        // For total count (skip pagination)
        const countPipeline = pipeline.slice(0, pipeline.findIndex(st => st.$skip !== undefined || st.$limit !== undefined));
        countPipeline.push({ $count: "total" });
        const totalResult = await JobCard.aggregate(countPipeline);
        const total = totalResult.length > 0 ? totalResult[0].total : 0;

        return res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pageSize: results.length,
            data: results
        });

    } catch (error) {
        console.error("[searchJobCards] Error:", error);
        return res.status(500).json({ success: false, message: "Error searching job cards", error: error.message });
    }
}

/**
 * Mark (update) payment status for a JobCard.
 * Only allows: Pending -> Paid, Pending -> Cancelled, Paid -> Cancelled.
 * Does NOT allow Paid -> Pending, Cancelled -> Pending, Paid -> Paid, etc.
 * Only the autoshop owner of the business can perform this action.
 * 
 * Params:
 *   - req.params.jobCardId: ID of the job card (required, as a route param)
 *   - req.body.paymentStatus: "Paid" or "Cancelled"
 */
async markPaymentStatus(req, res) {
    try {
        const { jobCardId } = req.params;
        const { paymentStatus } = req.body;

        // Validate status
        const allowedStatus = ["Paid", "Cancelled"];
        if (!allowedStatus.includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid paymentStatus. Only 'Paid' or 'Cancelled' is allowed."
            });
        }

        // Fetch user, must have businessProfile (autoshop owner)
        const user = await User.findById(req.user.id);
        if (!user || !user.businessProfile) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized. User must be an auto shop owner."
            });
        }

        // Lazy import JobCard if not imported at top
        const JobCard = (await import("../../Schema/jobCard.schema.js")).default;

        // Find the job card
        const jobCard = await JobCard.findById(jobCardId);
        if (!jobCard) {
            return res.status(404).json({
                success: false,
                message: "JobCard not found"
            });
        }

        // Check the jobCard belongs to the current user's business
        if (String(jobCard.business) !== String(user.businessProfile)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to mark payment for this job card"
            });
        }

        // Only allow status transitions: Pending -> Paid/Cancelled, Paid -> Cancelled
        const validTransitions = {
            Pending: ["Paid", "Cancelled"],
            Paid: ["Cancelled"],
            Cancelled: []
        };

        if (!validTransitions[jobCard.paymentStatus]?.includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot change paymentStatus from '${jobCard.paymentStatus}' to '${paymentStatus}'`
            });
        }

        jobCard.paymentStatus = paymentStatus;
        await jobCard.save();

        return res.status(200).json({
            success: true,
            message: `Payment status updated to '${paymentStatus}'`,
            data: jobCard
        });
    } catch (error) {
        console.error("[markPaymentStatus] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update payment status",
            error: error.message
        });
    }
}

/**
 * Mark (update) job status for a JobCard.
 * Only allows: Pending -> Approved, Pending -> Rejected
 * Does NOT allow Approved/Rejected -> Pending, Approved <-> Rejected or re-setting to the same value, etc.
 * Only the autoshop owner of the business can perform this action.
 * 
 * Params:
 *   - req.params.jobCardId: ID of the job card (route param, required)
 *   - req.body.status: "Approved" or "Rejected" (required)
 */
async markJobStatus(req, res) {
    try {
        const { jobCardId } = req.params;
        let { status } = req.body;

        if (!jobCardId || !status) {
            return res.status(400).json({
                success: false,
                message: "jobCardId (route param) and status (body) are required"
            });
        }

        // Accept only these transitions:
        // Pending -> Approved
        // Pending -> Rejected
        status = String(status).trim();
        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Only 'Approved' or 'Rejected' allowed."
            });
        }

        // Fetch user & check ownership
        const user = await User.findById(req.user.id);
        if (!user || !user.businessProfile) {
            return res.status(404).json({
                success: false,
                message: "Business profile not found for user"
            });
        }

        // Find the job card
        const JobCard = (await import("../../Schema/jobCard.schema.js")).default;
        const jobCard = await JobCard.findById(jobCardId);
        if (!jobCard) {
            return res.status(404).json({
                success: false,
                message: "JobCard not found"
            });
        }

        // Check the jobCard belongs to the current user's business
        if (String(jobCard.business) !== String(user.businessProfile)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to mark status for this job card"
            });
        }

        // Only allow defined transitions
        const validTransitions = {
            Pending: ["Approved", "Rejected"],
            Approved: [],
            Rejected: []
        };

        if (!validTransitions[jobCard.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot change job status from '${jobCard.status}' to '${status}'`
            });
        }

        jobCard.status = status;
        await jobCard.save();

        return res.status(200).json({
            success: true,
            message: `Job status updated to '${status}'`,
            data: jobCard
        });

    } catch (error) {
        console.error("[markJobStatus] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update job status",
            error: error.message
        });
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

        // --- Filter Handling (daily, weekly, monthly) ---
        const {
            dateType,
            date,
            week,
            month,
            year
        } = req.query;

        let createdAtMatch = {};
        let _dateType = dateType || "daily";
        let startDate, endDate;
        const now = new Date();
        if (_dateType === "daily") {
            let localDate = date ? new Date(date) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
            startDate = new Date(localDate.setHours(0, 0, 0, 0));
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 1);
        } else if (_dateType === "weekly") {
            let current = week ? new Date(week) : new Date();
            let day = current.getDay();
            let diffToMonday = ((day + 6) % 7);
            startDate = new Date(current);
            startDate.setDate(current.getDate() - diffToMonday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);
        } else if (_dateType === "monthly") {
            let _year = year ? Number(year) : now.getFullYear();
            let _month;

            if (typeof month !== "undefined" && month !== null) {
                // Handle string month names, e.g. "february"
                if (typeof month === "string" && isNaN(month)) {
                    const monthNames = [
                        "january", "february", "march", "april", "may", "june",
                        "july", "august", "september", "october", "november", "december"
                    ];
                    _month = monthNames.findIndex(mn =>
                        mn.startsWith(month.trim().toLowerCase())
                    );
                    if (_month === -1) _month = now.getMonth();
                } else {
                    // Allow month as integer, or zero-padded ("01", "02", etc)
                    if (typeof month === "string" && month.match(/^\d{1,2}$/)) {
                        let monthNum = Number(month);
                        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                            _month = monthNum - 1; // Convert 1-12 to JS 0-indexed
                        } else {
                            _month = now.getMonth();
                        }
                    } else {
                        // If month is already a number, use it directly (assume 0-based or 1-based)
                        let monthNum = Number(month);
                        if (!isNaN(monthNum)) {
                            if (monthNum >= 1 && monthNum <= 12) {
                                _month = monthNum - 1; // 1-based -> 0-based
                            } else if (monthNum >= 0 && monthNum <= 11) {
                                _month = monthNum;
                            } else {
                                _month = now.getMonth();
                            }
                        } else {
                            _month = now.getMonth();
                        }
                    }
                }
            } else {
                _month = now.getMonth();
            }

            startDate = new Date(_year, _month, 1, 0, 0, 0, 0);
            endDate = new Date(_year, _month + 1, 1, 0, 0, 0, 0);
        }

        if (startDate && endDate) {
            createdAtMatch.createdAt = { $gte: startDate, $lt: endDate };
        }

        // Find all job cards created by this business, within date filter if supplied
        const jobCards = await JobCard.find({
                business: user.businessProfile,
                ...createdAtMatch
            })
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

/**
 * Get all job cards for this auto shop business with paymentStatus 'Paid'.
 * Returns: jobNo, Customer Name, Customer Contact No, Customer Email, totalPayableAmount, paymentStatus, createdDate, createdTime
 */
async getAllPaidJobCards(req, res) {
    try {
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Find user's business profile
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "AutoShop business profile not found" });
        }

        // Fetch business profile to get GST rate
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        let gstRate = businessProfile && typeof businessProfile.gst === "number" && !isNaN(businessProfile.gst)
            ? businessProfile.gst
            : 0;

        // Fetch all PAID job cards for this business
        const paidJobCards = await JobCard.find({
            business: user.businessProfile,
            paymentStatus: "Paid"
        })
        .select('_id jobNo customerId totalPayableAmount paymentStatus paymentMethod gst paymentAmount createdAt')
        .populate({
            path: 'customerId',
            model: 'User',
            select: 'name phone email'
        })
        .sort({ createdAt: -1 })
        .lean();

        const cashPayments = [];
        const onlinePayments = [];

        // Helper function to format date as DD/MM/YYYY
        function formatDate(dateObj) {
            if (!dateObj) return "";
            const d = new Date(dateObj);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }

        // Helper function to format time as HH:MM (24 hr)
        function formatTime(dateObj) {
            if (!dateObj) return "";
            const d = new Date(dateObj);
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${mins}`;
        }

        for (const job of paidJobCards) {
            // Format createdAt into date and time strings in requested format
            let createdDate = "";
            let createdTime = "";
            if (job.createdAt) {
                createdDate = formatDate(job.createdAt);
                createdTime = formatTime(job.createdAt);
            }

            // Prepare base job data with "amount" as previous totalPayableAmount for all payments
            const baseJob = {
                jobCardId: job._id,
                jobCardNumber: job.jobNo,
                customerName: job.customerId?.name || "",
                customerContactNo: job.customerId?.phone || "",
                customerEmail: job.customerId?.email || "",
                paymentStatus: job.paymentStatus,
                paymentMethod: job.paymentMethod || "Cash", // fallback to Cash
                amount: job.totalPayableAmount, // "amount" instead of "totalPayableAmount"
                date: createdDate,
                time: createdTime
            };

            if ((job.paymentMethod || "Cash") === "Online") {
                // For Online, explicitly include GST and display total (inclusive)
                const totalAmount = job.totalPayableAmount || 0;
                let gstAmount = 0;
                let totalPayableOnline = totalAmount;
                if (gstRate > 0) {
                    gstAmount = Number((totalAmount * (gstRate / 100)).toFixed(2));
                    totalPayableOnline = Number((totalAmount + gstAmount).toFixed(2));
                }

                onlinePayments.push({
                    ...baseJob,
                    totalPayableAmount: totalPayableOnline,
                    gstRate,
                    gstAmount
                });
            } else {
                // For Cash, just show normal amount
                cashPayments.push({
                    ...baseJob,
                    totalPayableAmount: job.totalPayableAmount
                });
            }
        }

        return res.status(200).json({
            success: true,
            cashPayments,
            onlinePayments
        });
    } catch (err) {
        console.error("[getAllPaidJobCards] Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch paid JobCards",
            error: err.message
        });
    }
}

/**
 * Get all job cards for this auto shop business with paymentStatus not 'Paid'.
 * Returns: jobNo, Customer Name, Customer Contact No, Customer Email, totalPayableAmount, paymentStatus, createdDate, createdTime
 */
async getAllUnpaidJobCards(req, res) {
    try {
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Find user's business profile
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "AutoShop business profile not found" });
        }

        // Fetch business profile to get GST rate for online payments
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        let gstRate = businessProfile && typeof businessProfile.gst === "number" && !isNaN(businessProfile.gst)
            ? businessProfile.gst
            : 0;

        // Helper function to format date as DD/MM/YYYY
        function formatDate(dateObj) {
            if (!dateObj) return "";
            const d = new Date(dateObj);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }

        // Helper function to format time as HH:MM (24 hr)
        function formatTime(dateObj) {
            if (!dateObj) return "";
            const d = new Date(dateObj);
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${mins}`;
        }

        // Fetch all job cards that are not "Paid" for the business
        const unpaidJobCards = await JobCard.find({
            business: user.businessProfile,
            paymentStatus: { $ne: 'Paid' }
        })
            .select('_id jobNo customerId totalPayableAmount paymentStatus paymentMethod unpaid createdAt')
            .populate({
                path: 'customerId',
                model: 'User',
                select: 'name phone email'
            })
            .sort({ createdAt: -1 })
            .lean();

        // Separate into Online and Cash unpaid job cards
        const cashUnpaid = [];
        const onlineUnpaid = [];

        unpaidJobCards.forEach(job => {
            // Format createdAt into date and time strings in requested format
            let createdDate = "";
            let createdTime = "";
            if (job.createdAt) {
                createdDate = formatDate(job.createdAt);
                createdTime = formatTime(job.createdAt);
            }

            const isOnline = job.paymentMethod === "Online" && job.unpaid === true;
            const baseData = {
                jobCardId: job._id,
                jobCardNumber: job.jobNo,
                customerName: job.customerId?.name || "",
                customerContactNo: job.customerId?.phone || "",
                customerEmail: job.customerId?.email || "",
                paymentStatus: job.paymentStatus,
                paymentMethod: job.paymentMethod || "Cash",
                unpaid: job.unpaid,
                amount: job.totalPayableAmount, // show previous amount (before GST if relevant)
                date: createdDate,
                time: createdTime
            };

            if (isOnline) {
                const totalAmount = job.totalPayableAmount || 0;
                let gstAmount = 0;
                let totalPayableOnline = totalAmount;
                if (gstRate > 0) {
                    gstAmount = Number((totalAmount * (gstRate / 100)).toFixed(2));
                    totalPayableOnline = Number((totalAmount + gstAmount).toFixed(2));
                }
                onlineUnpaid.push({
                    ...baseData,
                    // totalPayableAmount should be set to the online amount only
                    totalPayableAmount: totalPayableOnline,
                    gstRate,
                    gstAmount
                });
            } else {
                // All others are considered Cash (including undefined paymentMethod)
                cashUnpaid.push({
                    ...baseData,
                    totalPayableAmount: job.totalPayableAmount
                });
            }
        });

        return res.status(200).json({
            success: true,
            cashUnpaid,
            onlineUnpaid
        });

    } catch (err) {
        console.error("[getAllUnpaidJobCards] Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch unpaid JobCards",
            error: err.message
        });
    }
}

/**
 * Get a single Job Card by its _id (ObjectId).
 * Requires: req.params.jobCardId or req.query.jobCardId (as a string ObjectId)
 */
async getJobCardUsingJobCardId(req, res) {
    try {
        const userId = req.user && req.user.id;
        const jobCardId = req.params.jobCardId || req.query.jobCardId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!jobCardId) {
            return res.status(400).json({ success: false, message: "jobCardId is required in params or query" });
        }

        // Find the user to get the businessProfile
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile) {
            return res.status(404).json({ success: false, message: "Business profile not found for user" });
        }
        const businessId = user.businessProfile;

        let objectJobCardId, objectBusinessId;
        try {
            objectJobCardId = typeof jobCardId === "string" ? (Types.ObjectId.isValid(jobCardId) ? new Types.ObjectId(jobCardId) : null) : jobCardId;
            objectBusinessId = typeof businessId === "string" ? (Types.ObjectId.isValid(businessId) ? new Types.ObjectId(businessId) : null) : businessId;
        } catch (err) {
            return res.status(400).json({ success: false, message: "Invalid jobCardId or businessProfile ObjectId." });
        }

        if (!objectJobCardId || !objectBusinessId) {
            return res.status(400).json({ success: false, message: "Invalid jobCardId or businessProfile ObjectId." });
        }

        // Fetch the JobCard and deeply populate required fields
        const jobCard = await JobCard.findOne({
            _id: objectJobCardId,
            business: objectBusinessId
        })
        .populate([
            {
                path: 'customerId',
                model: 'User',
                select: 'name email phone pincode address'
            },
            {
                path: 'vehicleId',
                model: 'Vehicle',
                select: 'licensePlateNo make model'
            },
            {
                path: 'business',
                model: 'BusinessProfile',
                select: 'businessName businessAddress pincode gst businessHSTNumber businessEmail businessPhone'
            }
        ]);

        if (!jobCard) {
            return res.status(404).json({ success: false, message: "JobCard not found for business or you do not have permission." });
        }

        // Prepare business object for response (added businessHSTNumber)
        const bp = jobCard.business || {};
        const businessForResponse = {
            _id: bp._id ? bp._id.toString() : "",
            businessName: bp.businessName || "",
            businessAddress: bp.businessAddress || "",
            pincode: bp.pincode || "",
            businessPhone: bp.businessPhone || "",
            businessEmail: bp.businessEmail || "",
            gst: (typeof bp.gst === "number" && !isNaN(bp.gst)) ? bp.gst : 0,
            businessHSTNumber: bp.businessHSTNumber || ""
        };

        // Prepare customer object for response
        const cust = jobCard.customerId || {};
        const customerForResponse = {
            _id: cust._id ? cust._id.toString() : "",
            name: cust.name || "",
            email: cust.email || "",
            phone: cust.phone || "",
            pincode: cust.pincode || "",
            address: cust.address || ""
        };

        // Prepare vehicle object for response
        const veh = jobCard.vehicleId || {};
        let makeObj = {};
        // Accept "make" as { name, model } if present or try to extract if possible
        if (veh.make && typeof veh.make === "object") {
            makeObj.name = veh.make.name || "";
            makeObj.model = veh.model || (veh.make.model || "");
        } else {
            makeObj = {
                name: veh.make || "",
                model: veh.model || ""
            };
        }
        const vehicleForResponse = {
            _id: veh._id ? veh._id.toString() : "",
            licensePlateNo: veh.licensePlateNo || "",
            make: makeObj
        };

        // GST and Payables calculation
        let gstRate = (typeof bp.gst === "number" && !isNaN(bp.gst)) ? bp.gst : 0;
        let totalAmount = jobCard.totalPayableAmount || 0;
        let gstAmount = 0;
        let totalPayableOnline = totalAmount;
        if (gstRate > 0) {
            gstAmount = Number((totalAmount * (gstRate / 100)).toFixed(2));
            totalPayableOnline = Number((totalAmount + gstAmount).toFixed(2));
        }

        let invoiceTotal = Math.floor(totalPayableOnline);
        let roundOff = Number((totalPayableOnline - invoiceTotal).toFixed(2));

        // Compose main response object as required in format
        const data = {
            _id: jobCard._id ? jobCard._id.toString() : "",
            business: businessForResponse,
            customerId: customerForResponse,
            vehicleId: vehicleForResponse,
            odometerReading: jobCard.odometerReading,
            dueOdometerReading: jobCard.dueOdometerReading,
            issueDescription: jobCard.issueDescription,
            serviceType: jobCard.serviceType,
            priorityLevel: jobCard.priorityLevel,
            services: Array.isArray(jobCard.services) ? jobCard.services.map(service => ({
                service: service.service ? service.service.toString() : "",
                subServices: Array.isArray(service.subServices)
                    ? service.subServices.map(sub => ({
                        name: sub.name,
                        desc: sub.desc,
                        price: sub.price
                    }))
                    : []
            })) : [],
            additionalNotes: jobCard.additionalNotes || "",
            vehiclePhotos: Array.isArray(jobCard.vehiclePhotos) ? jobCard.vehiclePhotos : [],
            totalPayableAmount: jobCard.totalPayableAmount || 0,
            paymentStatus: jobCard.paymentStatus || "",
            paymentMethod: jobCard.paymentMethod || "",
            labourCharge: typeof jobCard.labourCharge === "number" ? jobCard.labourCharge : 0,
            status: jobCard.status || "",
            jobNo: jobCard.jobNo || "",
            createdAt: jobCard.createdAt,
            updatedAt: jobCard.updatedAt,
            __v: typeof jobCard.__v === "number" ? jobCard.__v : 0,
            unpaid: !!jobCard.unpaid,
            invoiceNumber: jobCard.jobNo ? `INV-${jobCard.jobNo}` : "",
            payableAmounts: {
                cash: totalAmount,
                online: totalPayableOnline,
                gstRate,
                gstAmount,
                invoiceTotal,
                roundOff
            }
        };

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        console.error("[getJobCardUsingJobCardId] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error retrieving job card",
            error: error.message
        });
    }
}


/**
 * Mark payment as unpaid for a specified job card, specifying via Cash or Online.
 * 
 * req.body:
 * - jobCardId
 * - paymentMethod: "Cash" | "Online"
 */
async markPaymentInvoice(req, res) {
    try {
        const { jobCardId } = req.body;
        const userId = req.user && req.user.id;
        const paymentMethod = "Online";

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Validate payment method
        const VALID_METHODS = ["Cash", "Online"];
        if (!VALID_METHODS.includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: `Invalid payment method. Allowed: ${VALID_METHODS.join(", ")}` });
        }

        // Find JobCard
        const jobCard = await JobCard.findById(jobCardId);
        if (!jobCard) {
            return res.status(404).json({ success: false, message: "JobCard not found." });
        }

        // Check for associated business profile (only own jobs)
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile || jobCard.business?.toString() !== user.businessProfile.toString()) {
            return res.status(403).json({ success: false, message: "You do not have permission to mark payment for this job card." });
        }

        // Update JobCard fields to mark as unpaid
        jobCard.paymentStatus = "Pending";
        jobCard.unpaid = true;
        // Optionally: store paymentMethod directly on the JobCard if needed for history/audit
        if (paymentMethod) {
            jobCard.paymentMethod = paymentMethod;
        }
        await jobCard.save();

        return res.status(200).json({
            success: true,
            message: `Payment for job card marked as unpaid via ${paymentMethod}`,
            jobCardId: jobCard._id,
            paymentStatus: jobCard.paymentStatus,
            unpaid: jobCard.unpaid,
            paymentMethod: jobCard.paymentMethod || paymentMethod
        });
    } catch (error) {
        console.error("[markPaymentUnpaid] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to mark payment as unpaid",
            error: error.message
        });
    }
}

/**
 * Collect payment for a job card (Cash/Online). Marks job card paid.
 * Only allows full payment for the total payable amount (no partial payments).
 * If payment method is "Online", GST must be included and fetched from businessProfile.
 * 
 * req.body:
 * - jobCardId
 * - paymentMethod: "Cash" | "Online"
 * - remark (optional)
 * - amount (required)
 */
async collectPayment(req, res) {
    try {
        const { jobCardId, paymentMethod, remark, amount } = req.body;
        const userId = req.user && req.user.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Validate payment method
        const VALID_METHODS = ["Cash", "Online"];
        if (!VALID_METHODS.includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: `Invalid payment method. Allowed: ${VALID_METHODS.join(", ")}` });
        }

        // Find JobCard
        const jobCard = await JobCard.findById(jobCardId);
        if (!jobCard) {
            return res.status(404).json({ success: false, message: "JobCard not found." });
        }

        // Must not already be marked Paid
        if (jobCard.paymentStatus === "Paid") {
            return res.status(400).json({ success: false, message: "This JobCard is already marked as paid." });
        }

        // Check for associated business profile (collect payment only for own jobs)
        const user = await User.findById(userId).lean();
        if (!user || !user.businessProfile || jobCard.business?.toString() !== user.businessProfile.toString()) {
            return res.status(403).json({ success: false, message: "You do not have permission to collect payment for this job card." });
        }

        // Always fetch businessProfile for GST calculation if needed
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile).lean();
        let totalAmount = jobCard.totalPayableAmount || 0;
        let gstRate = businessProfile && typeof businessProfile.gst === "number" && !isNaN(businessProfile.gst) ? businessProfile.gst : 0;
        let gstAmount = 0;
        let expectedAmount = totalAmount;

        if (paymentMethod === "Online") {

            if (gstRate > 0) {
                gstAmount = Number((totalAmount * (gstRate / 100)).toFixed(2));
                expectedAmount = Number((totalAmount + gstAmount).toFixed(2));
            }
        } else {
      
            gstAmount = 0; // No GST for Cash
            expectedAmount = totalAmount;
        }

        if (typeof amount !== "number" || amount !== expectedAmount) {
            return res.status(400).json({
                success: false,
                message: paymentMethod === "Online"
                    ? `Payment amount mismatch. Expected full amount (including GST): ${expectedAmount}`
                    : `Payment amount mismatch. Expected full amount: ${expectedAmount}`,
                expectedAmount,
                receivedAmount: amount,
                ...(paymentMethod === "Online" && gstAmount > 0 ? { gstAmount, gstRate } : {})
            });
        }

        // Update the JobCard directly to reflect payment collection (NO separate Payment model)
        jobCard.paymentStatus = "Paid";
        jobCard.unpaid = false;
        jobCard.paymentMethod = paymentMethod;
        if (remark) {
            jobCard.paymentRemark = remark;
        }
        if (gstAmount > 0) {
            jobCard.gst = {
                rate: gstRate,
                amount: gstAmount,
            };
        } else {
            jobCard.gst = undefined;
        }
        jobCard.paymentAmount = amount;
        jobCard.paymentTime = new Date();

        await jobCard.save();

        return res.status(200).json({
            success: true,
            message: paymentMethod === "Online"
                ? `Payment collected and job card marked as paid. Expected full amount (including GST): ${expectedAmount}`
                : "Payment collected and job card marked as paid.",
            jobCardId: jobCard._id,
            paymentStatus: jobCard.paymentStatus,
            unpaid: jobCard.unpaid,
            paymentMethod: jobCard.paymentMethod,
            paymentAmount: jobCard.paymentAmount,
            ...(jobCard.paymentRemark ? { paymentRemark: jobCard.paymentRemark } : {}),
            ...(paymentMethod === "Online" && gstAmount > 0 ? { gstAmount, gstRate } : {})
        });
    } catch (err) {
        console.error("[collectPayment] Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to collect payment",
            error: err.message
        });
    }
}



    /**
     * Create a new car details entry
     * POST /api/autoshop/car-details
     * Body: { companyName: string, models: [{ modelName: string, years: number[] }] }
     */
    async createCarDetails(req, res) {
        try {
            const { companyName, models } = req.body;
            // Check for required fields
            if (!companyName || !Array.isArray(models)) {
                console.log("[createCarDetails] Validation failed: companyName or models missing or invalid");
                return res.status(400).json({ message: "companyName and models are required" });
            }
            // Validate each model
            for (const model of models) {
                if (
                    (typeof model.modelName !== 'string' && typeof model.modelName !== 'number') ||
                    !Array.isArray(model.years) ||
                    !model.years.every(y => typeof y === 'number' || typeof y === 'string')
                ) {
                    console.log(`[createCarDetails] Validation failed for model:`, model);
                    return res.status(400).json({ message: "Each model must have modelName (string or number) and years (number[] or string[])" });
                }
            }
    

            const carDetails = new (await import("../../Schema/CarDetails.schema.js")).default({
                companyName: companyName.trim(),
                models
            });
            await carDetails.save();
            console.log("[createCarDetails] Car details created successfully:", carDetails);
            return res.status(201).json({ success: true, data: carDetails });
        } catch (err) {
            console.log("[createCarDetails] Error:", err);
            return res.status(500).json({ message: "Failed to create car details", error: err.message });
        }
    }

    /**
     * Edit/Update car details entry by ID
     * PATCH /api/autoshop/car-details/:id
     * Body: { companyName?: string, models?: [{ modelName: string, years: number[] }] }
     */
    async editCarDetails(req, res) {
        try {
            const id = req.params.id;
            const { companyName, models } = req.body;
            if (!id || (!companyName && !models)) {
                return res.status(400).json({ message: "id and some data to update are required" });
            }

            const update = {};
            if (companyName) update.companyName = companyName.trim();
            if (models) {
                if (!Array.isArray(models)) {
                    return res.status(400).json({ message: "models must be an array" });
                }
                for (const model of models) {
                    if (
                        typeof model.modelName !== 'string' ||
                        !Array.isArray(model.years) ||
                        !model.years.every(y => typeof y === 'number')
                    ) {
                        return res.status(400).json({ message: "Each model must have modelName (string) and years (number[])" });
                    }
                }
                update.models = models;
            }
            const CarDetailsModel = (await import("../../Schema/CarDetails.schema.js")).default;
            const carDetails = await CarDetailsModel.findByIdAndUpdate(
                id,
                { $set: update },
                { new: true }
            );
            if (!carDetails) {
                return res.status(404).json({ message: "Car details entry not found" });
            }
            return res.status(200).json({ success: true, data: carDetails });
        } catch (err) {
            console.error("[editCarDetails] Error:", err);
            return res.status(500).json({ message: "Failed to update car details", error: err.message });
        }
    }

    /**
     * Delete car details entry by ID
     * DELETE /api/autoshop/car-details/:id
     */
    async deleteCarDetails(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ message: "id parameter is required" });
            }
            const CarDetailsModel = (await import("../../Schema/CarDetails.schema.js")).default;
            const deleted = await CarDetailsModel.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ message: "Car details entry not found" });
            }
            return res.status(200).json({ success: true, message: "Car details entry deleted" });
        } catch (err) {
            console.error("[deleteCarDetails] Error:", err);
            return res.status(500).json({ message: "Failed to delete car details", error: err.message });
        }
    }

    /**
     * Fetch car details entries.
     * GET /api/autoshop/car-details
     * Optional query params: companyName
     */
    async fetchCarDetails(req, res) {
        try {
            const { companyName } = req.query;
            const CarDetailsModel = (await import("../../Schema/CarDetails.schema.js")).default;
            const filter = {};
            if (companyName) {
                filter.companyName = { $regex: new RegExp(companyName, 'i') };
            }
            const results = await CarDetailsModel.find(filter).lean();
            return res.status(200).json({ success: true, data: results });
        } catch (err) {
            console.error("[fetchCarDetails] Error:", err);
            return res.status(500).json({ message: "Failed to fetch car details", error: err.message });
        }
    }






}

export default AutoShopController;
