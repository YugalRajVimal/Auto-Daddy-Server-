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
// import CarDetailsModel from "../../Schema/CarDetails.schema.js";
import WebsiteTemplateSchema from "../../Schema/WebsiteTemplateSchema.js";
import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import canadianMunicipalities from "../cityData.js";
import CarCompany from "../../Schema/car-company-schema.js";
import axios from "axios";
import InviteHelpSchema from "../../Schema/InviteHelp.schema.js";



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


    /**
     * Dashboard API: Returns summarized business profile and sales/income overview,
     * as well as sample values for other dashboard widgets.
     * - Real business info: businessName, businessContactNo, idBusinessActive (profile active), 
     *   incomeOverview {totalSale, received, pending} for daily, weekly, monthly
     * - Sample/placeholder data: subscriptionDaysLeftCount, thoughtOfTheDay, aboutUs, privacyPolicy, FAQs, Documents, Disclaimer
     */
    /**
     * Dashboard API: Returns summarized business profile and sales/income overview,
     * as well as sample values for other dashboard widgets.
     * Calculates jobCard income correctly (including GST for online payments) similar to getAllPaidJobCards.
     */
    async getDashboardDataNew(req, res) {
        try {
            const userId = req.user && req.user.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized. User ID missing." });
            }

            // Fetch user with businessProfile and user details for business user
            const user = await User.findById(userId)
                .select(
                    "name email countryCode phone pincode address profilePhoto isDisabled isProfileComplete businessProfile"
                )
                .lean();
            if (!user || !user.businessProfile) {
                return res.status(404).json({ message: "Business profile not found." });
            }

            // Prepare business user details according to schema/user.schema.js (1-70)
            const businessUserDetails = {
                name: user.name || null,
                email: user.email || null,
                countryCode: user.countryCode || null,
                phone: user.phone || null,
                pincode: user.pincode || null,
                address: user.address || null,
                profilePhoto: user.profilePhoto || null,
                isDisabled: typeof user.isDisabled === "boolean" ? user.isDisabled : false,
                isProfileComplete: typeof user.isProfileComplete === "boolean" ? user.isProfileComplete : false,
                // Optionally add any other "business user" fields needed here from user.schema.js
            };

            // Fetch business profile with additional fields as per request
            const businessProfile = await BusinessProfileModel.findById(
                user.businessProfile,
                [
                    // Core
                    "businessName",
                    "businessPhone",
                    "isBusinessActive",
                    "gst",
                    "subscriptions",
                    // Additional requested
                    "businessMapLocation",
                    "city",
                    "openHours",
                    "openDays",
                    "closedDays",
                    "myServices"
                ].join(" ")
            ).lean();
            if (!businessProfile) {
                return res.status(404).json({ message: "Business profile not found." });
            }

            console.log(businessProfile)

            const businessName = businessProfile.businessName || null;
            const businessContactNo = businessProfile.businessPhone || null;
            const city = businessProfile.city || null;

            // --- Add lat long
            let businessLat = null, businessLng = null;
            if (
                businessProfile.businessMapLocation &&
                typeof businessProfile.businessMapLocation === "object"
            ) {
                businessLat = businessProfile.businessMapLocation.lat || null;
                businessLng = businessProfile.businessMapLocation.lng || null;
            }

            // --- Handle openHours, openDays, closedDays
            const openHours = businessProfile.openHours || null;
            const openDays = Array.isArray(businessProfile.openDays) ? businessProfile.openDays : null;
            const closedDays = Array.isArray(businessProfile.closedDays) ? businessProfile.closedDays : null;

            // --- Business services (need to populate .myServices[].service for name, desc from Services)
            let services = [];
            if (Array.isArray(businessProfile.myServices) && businessProfile.myServices.length > 0) {
                // Populate service ref fields by querying Services schema
                // @services.schema.js (1-10)
                const serviceIds = businessProfile.myServices.map(s => s.service).filter(s => !!s);
                let serviceDocs = [];
                if (serviceIds.length > 0) {
                    // Use distinct to avoid duplicate queries
                    const uniqueServiceIds = [...new Set(serviceIds.map(id => id.toString()))];
                    serviceDocs = await Services.find({
                        _id: { $in: uniqueServiceIds }
                    }).select("name desc").lean();
                }
                // Map serviceId => doc for lookup
                const servicesById = {};
                for (const doc of serviceDocs) {
                    servicesById[doc._id.toString()] = doc;
                }
                // Compose output array with name, desc, any subService
                services = businessProfile.myServices.map(ms => {
                    const sid = ms.service?.toString?.();
                    const serviceDoc = sid && servicesById[sid] ? servicesById[sid] : {};
                    return {
                        id: sid || null,
                        name: serviceDoc.name || null,
                        desc: serviceDoc.desc || null,
                        // Optionally attach sub-services (with name/desc/price)
                        subServices: Array.isArray(ms.subServices)
                            ? ms.subServices.map(ss => ({
                                  name: ss.name || null,
                                  desc: ss.desc || null,
                                  price: typeof ss.price === 'number' ? ss.price : null
                              }))
                            : []
                    }
                });
            }

            // Get the GST rate if exists and is numeric, else 0
            let businessGst = 0;
            if (typeof businessProfile.gst === "number" && !isNaN(businessProfile.gst)) {
                businessGst = businessProfile.gst;
            }

            // Parse query params for dateType and date range calculation
            let { dateType, date, month, year } = req.query;
            dateType = (dateType || 'daily').toLowerCase();

            const now = new Date();
            let start, end;

            // Helper to get start and end of selected period
            const MONTH_NAME_TO_INDEX = {
                'january': 0, 'february': 1, 'march': 2, 'april': 3,
                'may': 4, 'june': 5, 'july': 6, 'august': 7,
                'september': 8, 'october': 9, 'november': 10, 'december': 11
            };

            if (dateType === 'daily') {
                let targetDate;
                if (date) {
                    targetDate = new Date(date);
                    if (isNaN(targetDate.getTime())) {
                        return res.status(400).json({ message: "Invalid date format for daily data." });
                    }
                } else {
                    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                }
                start = new Date(targetDate.setHours(0, 0, 0, 0));
                end = new Date(start);
                end.setDate(start.getDate() + 1);
            } else if (dateType === 'weekly') {
                let baseDate = now;
                if (date) {
                    baseDate = new Date(date);
                    if (isNaN(baseDate.getTime())) {
                        return res.status(400).json({ message: "Invalid date format for weekly data." });
                    }
                } else {
                    baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                }
                // Week starts on Monday
                const weekday = baseDate.getDay() || 7;
                start = new Date(baseDate);
                start.setDate(baseDate.getDate() - (weekday - 1));
                start.setHours(0,0,0,0);
                end = new Date(start);
                end.setDate(start.getDate() + 7);
            } else if (dateType === 'monthly') {
                let m, y;
                if (month && year) {
                    let monthRaw = month.toString().trim().toLowerCase();
                    if (!isNaN(monthRaw)) {
                        m = parseInt(monthRaw, 10) - 1; // 0-based
                        if (isNaN(m) || m < 0 || m > 11) {
                            return res.status(400).json({ message: "Invalid month for monthly data." });
                        }
                    } else if (MONTH_NAME_TO_INDEX.hasOwnProperty(monthRaw)) {
                        m = MONTH_NAME_TO_INDEX[monthRaw];
                    } else {
                        return res.status(400).json({ message: "Invalid month name for monthly data." });
                    }
                    y = parseInt(year, 10);
                    if (isNaN(y)) {
                        return res.status(400).json({ message: "Invalid year for monthly data." });
                    }
                } else {
                    m = now.getMonth();
                    y = now.getFullYear();
                }
                start = new Date(y, m, 1, 0, 0, 0, 0);
                end = new Date(y, m + 1, 1, 0, 0, 0, 0);
            } else {
                return res.status(400).json({ message: "Invalid 'dateType'. Must be one of 'daily', 'weekly', 'monthly'." });
            }

            // Fetch all jobCards in this business and date window, fetch required fields only
            const jobCards = await JobCard.find(
                {
                    business: user.businessProfile,
                    createdAt: { $gte: start, $lt: end }
                },
                "totalPayableAmount amountPaid paymentStatus paymentMethod"
            ).lean();

            // Calculate correctly: 
            // - For paid cards: 
            //    - If Online, sum amountPaid + GST on paid
            //    - If Cash, sum as is
            // - For pending: totalPayableAmount - amountPaid
            // - For total sale: totalPayableAmount sum (not amountPaid)
            let totalSale = 0;
            let received = 0;
            let pending = 0;

            for (const card of jobCards) {
                const total = typeof card.totalPayableAmount === "number" ? card.totalPayableAmount : 0;
                const paid = typeof card.amountPaid === "number" ? card.amountPaid : 0;

                totalSale += total;

                if (card.paymentStatus === "Paid") {
                    if (card.paymentMethod === "Online") {
                        const gstExtra = businessGst ? (paid * businessGst) / 100 : 0;
                        received += paid + gstExtra;
                    } else {
                        // Cash
                        received += paid;
                    }
                }
                // Pending calculation (total minus paid if not already paid)
                pending += total - paid;
            }

            // Round off
            totalSale = Math.round(totalSale * 100) / 100;
            received = Math.round(received * 100) / 100;
            pending = Math.round(pending * 100) / 100;

            // Income overview object based on dateType
            let incomeOverview = {};
            if (dateType === 'daily') {
                incomeOverview.daily = {
                    date: start.toISOString().slice(0, 10),
                    totalSale,
                    received,
                    pending
                };
            } else if (dateType === 'weekly') {
                incomeOverview.weekly = {
                    weekStart: start.toISOString().slice(0, 10),
                    weekEnd: (new Date(end - 1)).toISOString().slice(0, 10),
                    totalSale,
                    received,
                    pending
                };
            } else if (dateType === 'monthly') {
                incomeOverview.monthly = {
                    month: (start.getMonth() + 1).toString().padStart(2, '0'),
                    year: start.getFullYear(),
                    totalSale,
                    received,
                    pending
                };
            }

            // --- Calculate subscriptionDaysLeftCount from the current active subscription per @bussiness-profile.js (1-125)
            let subscriptionDaysLeftCount = 0;
            if (
                Array.isArray(businessProfile.subscriptions) &&
                businessProfile.subscriptions.length > 0
            ) {
                // Subscriptions can be in any order, ensure most recent and active are checked first
                const sortedSubs = businessProfile.subscriptions
                    .slice()
                    .sort((a, b) => new Date(b.purchasedOn) - new Date(a.purchasedOn));
                
                const nowTime = Date.now();

                let found = false;
                for (const sub of sortedSubs) {
                    // paymentStatus check first (if Pending, show 0)
                    if (
                        sub &&
                        sub.paymentStatus &&
                        typeof sub.paymentStatus === "string" &&
                        sub.paymentStatus.toLowerCase() === "pending"
                    ) {
                        subscriptionDaysLeftCount = 0;
                        found = true;
                        break;
                    }
                    // If not pending, calculate active days left
                    if (
                        sub &&
                        typeof sub.days === "number" &&
                        sub.days > 0 &&
                        sub.purchasedOn
                    ) {
                        const startDate = new Date(sub.purchasedOn);
                        const endDate = new Date(startDate.getTime() + sub.days * 24 * 60 * 60 * 1000);
                        if (nowTime >= startDate.getTime() && nowTime < endDate.getTime()) {
                            // Active subscription
                            subscriptionDaysLeftCount = Math.ceil((endDate - nowTime) / (1000 * 60 * 60 * 24));
                            found = true;
                            break;
                        }
                    }
                }
                // If none found (all expired, or status Pending not present), subscriptionDaysLeftCount will be 0
            }

            // Fetch dashboard data from DB and use defaults if not found (from dashboardData.schema.js)
            let thoughtOfTheDay, aboutUs, privacyPolicy, FAQs, Documents, Disclaimer;

            try {
                const dashboardData = await DashboardDataModel.findOne({}).lean();
                if (!dashboardData) {
                    return res.status(404).json({ message: "Dashboard data not found." });
                }
                thoughtOfTheDay = dashboardData.thoughtOfTheDay;
                aboutUs = dashboardData.aboutUs;
                privacyPolicy = dashboardData.privacyPolicy;
                FAQs = dashboardData.FAQs;
                Documents = dashboardData.documents;
                Disclaimer = dashboardData.disclaimer;
            } catch (err) {
                return res.status(500).json({ message: "Failed to fetch dashboard data.", error: err?.message || err.toString() });
            }

            return res.status(200).json({
                success: true,
                businessName,
                businessContactNo,
                idBusinessActive:businessProfile.isBusinessActive,
                city,
                latitude: businessLat,
                longitude: businessLng,
                openHours,
                openDays,
                closedDays,
                services,
                incomeOverview,
                subscriptionDaysLeftCount,
                thoughtOfTheDay,
                aboutUs,
                privacyPolicy,
                FAQs,
                Documents,
                Disclaimer,
                businessUserDetails
            });

        } catch (error) {
            console.error("[getDashboardDataNew] - Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    /**
     * Update the active status (`isBusinessActive`) for the current user's business profile.
     * Expects: { isBusinessActive: Boolean } in body.
     * Accessible to autoshopowner users only.
     */
    async updateBusinessActiveStatus(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized. User ID missing from auth context." });
            }

            // Only allow autoshopowner
            const user = await User.findById(userId)
                .select("role businessProfile")
                .lean();
            if (!user || user.role !== "autoshopowner") {
                return res.status(404).json({ message: "Autoshopowner user not found." });
            }
            if (!user.businessProfile) {
                return res.status(404).json({ message: "Business profile not found for user." });
            }

            const { isBusinessActive } = req.body;
            if (typeof isBusinessActive !== "boolean") {
                return res.status(400).json({ message: "`isBusinessActive` must be a boolean value." });
            }

            const updatedBusinessProfile = await BusinessProfileModel.findByIdAndUpdate(
                user.businessProfile,
                { isBusinessActive },
                { new: true }
            ).lean();

            if (!updatedBusinessProfile) {
                return res.status(404).json({ message: "Business profile not found." });
            }

            return res.status(200).json({
                success: true,
                message: "Business active status updated successfully.",
                businessProfile: updatedBusinessProfile
            });
        } catch (error) {
            console.error("[updateBusinessActiveStatus]", error);
            return res.status(500).json({ message: "Failed to update business active status.", error: error.message });
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

            // Populate ONLY main companyName and _id for carCompanies
            const businessProfile = await BusinessProfileModel.findById(user.businessProfile)
                .populate({
                    path: "carCompanies",
                    select: "companyName"
                })
                .lean();

            if (!businessProfile) {
                return res.status(404).json({ message: "Business profile not found." });
            }

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
    /**
     * Only allows "autoshopowner" role to edit their profile.
     * Editable fields: name, email, countryCode, pincode, address
     * Cannot edit phone or role.
     */
    async editProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized. User ID missing." });
            }

            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }
            if (user.role !== "autoshopowner") {
                return res.status(403).json({ message: "Only autoshopowner can edit this profile." });
            }

            // Only autoshopowner can proceed
            const allowedFields = ["name", "email", "countryCode", "pincode", "address"];
            const updateFields = {};

            for (const key of allowedFields) {
                if (req.body[key] !== undefined) {
                    updateFields[key] = req.body[key];
                }
            }

            if (Object.keys(updateFields).length === 0) {
                return res.status(400).json({ message: "No profile fields provided to update." });
            }

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: updateFields },
                { new: true, runValidators: true }
            ).lean();

            if (!updatedUser) {
                return res.status(404).json({ message: "User not found after update." });
            }

            // Return updated user profile (sensitive data omitted)
            const { name, email, phone, countryCode, pincode, address } = updatedUser;

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


    /**
     * @description Complete the business profile. Each day in openHours should have its own timings.
     */
    async completeBusinessProfile(req, res) {
        let filesToDelete = [];
        let session = null;
        try {
            const userId = req.user?.id;
            console.log("[completeBusinessProfile] userId:", userId);

            // Validate user authentication
            if (!userId) {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(401).json({ message: "Unauthorized. User ID missing from auth context." });
            }

            // Lookup user
            const user = await User.findById(userId);
            if (!user) {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(404).json({ message: "User not found." });
            }

            if (user.role !== "autoshopowner") {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(403).json({ message: "Only users with role 'autoshopowner' can complete a business profile." });
            }

            // Check if business profile is already complete
            if (user.isAutoShopBusinessProfileComplete && user.businessProfile) {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(400).json({ message: "Business profile already completed." });
            }

            // Extract business profile details
            let {
                businessName,
                businessAddress,
                city,
                pincode,
                businessPhone,
                businessEmail,
                businessHSTNumber,
                openHours, // per-day timings
                serviceWeWorkWith,
                lat,
                lng,
                gst,
            } = req.body;

            // Validate required fields
            if (!businessName || !businessAddress || !pincode || !businessPhone || !businessEmail) {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(400).json({
                    message: "Missing required fields: businessName, businessAddress, pincode, businessPhone, businessEmail"
                });
            }

            // Fallback for lat/lng as stringified JSON
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

            // Save openHours as perDayOpenHours, like in @auto-shop.controller.js (879-1146)
            const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            let perDayOpenHoursClean;

            // Parse openHours - flexible format support, as in editBusinessProfile
            if (openHours !== undefined) {
                if (typeof openHours === "string") {
                    // Try parsing as JSON
                    try {
                        openHours = JSON.parse(openHours);
                    } catch (e) {
                        if (
                            openHours.trim().startsWith('[') &&
                            openHours.trim().indexOf("{") > -1
                        ) {
                            try {
                                openHours = JSON.parse(openHours);
                            } catch (e2) {
                                if (req.files) deleteUploadedFiles(req.files);
                                return res.status(400).json({ message: "Invalid openHours JSON format." });
                            }
                        } else {
                            if (req.files) deleteUploadedFiles(req.files);
                            return res.status(400).json({ message: "Invalid openHours format: Not JSON and not parsable." });
                        }
                    }
                }
                if (!Array.isArray(openHours)) {
                    if (req.files) deleteUploadedFiles(req.files);
                    return res.status(400).json({ message: "openHours must be an array, with each day as an object with timings." });
                }
                // Validate and clean perDayOpenHours
                perDayOpenHoursClean = [];
                for (const item of openHours) {
                    if (!item || typeof item !== "object" || typeof item.day !== "string") {
                        if (req.files) deleteUploadedFiles(req.files);
                        return res.status(400).json({ message: "Each entry in openHours must be an object with 'day', 'open', and 'close' properties." });
                    }
                    const { day, open, close } = item;
                    if (!WEEK_DAYS.includes(day)) {
                        if (req.files) deleteUploadedFiles(req.files);
                        return res.status(400).json({ message: `Invalid day in openHours: "${day}". Allowed: ${WEEK_DAYS.join(", ")}` });
                    }
                    if (
                        typeof open !== "string" ||
                        typeof close !== "string" ||
                        !open.match(/^\d{2}:\d{2}$/) ||
                        !close.match(/^\d{2}:\d{2}$/)
                    ) {
                        if (req.files) deleteUploadedFiles(req.files);
                        return res.status(400).json({
                            message: `Invalid open or close time for ${day}. Required "HH:MM" string format.`
                        });
                    }
                    perDayOpenHoursClean.push({ day, open, close });
                }
            }

            // Validate and parse serviceWeWorkWith
            if (typeof serviceWeWorkWith === "string") {
                try {
                    const tmp = JSON.parse(serviceWeWorkWith);
                    if (Array.isArray(tmp)) {
                        serviceWeWorkWith = tmp;
                    } else {
                        serviceWeWorkWith = serviceWeWorkWith.split(",").map(s => s.trim()).filter(Boolean);
                    }
                } catch {
                    serviceWeWorkWith = serviceWeWorkWith.split(",").map(s => s.trim()).filter(Boolean);
                }
            }
            if (serviceWeWorkWith === undefined) {
                serviceWeWorkWith = [];
            }
            if (!Array.isArray(serviceWeWorkWith)) {
                if (req.files) deleteUploadedFiles(req.files);
                return res.status(400).json({ message: "serviceWeWorkWith must be an array of service IDs." });
            }
            serviceWeWorkWith = serviceWeWorkWith.filter(id => !!id);

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
            }

            // Handle bannerImage (image upload via multer)
            let bannerImage = req.body.bannerImage;
            if (
                req.files &&
                req.files.bannerImage &&
                Array.isArray(req.files.bannerImage) &&
                req.files.bannerImage.length > 0
            ) {
                bannerImage = req.files.bannerImage[0].path;
                filesToDelete.push(req.files.bannerImage[0]);
            }

            // Prepare map location object using lat/lng
            let businessMapLocation = undefined;
            if ((lat !== undefined && lat !== null && lat !== "") || (lng !== undefined && lng !== null && lng !== "")) {
                businessMapLocation = {};
                if (lat !== undefined && lat !== null && lat !== "")
                    businessMapLocation.lat = lat;
                if (lng !== undefined && lng !== null && lng !== "")
                    businessMapLocation.lng = lng;
                if (Object.keys(businessMapLocation).length === 0)
                    businessMapLocation = undefined;
            }

            // Business profile document to persist - use perDayOpenHours!
            const businessProfileDoc = {
                businessName,
                businessAddress,
                city: city !== undefined ? city : null,
                pincode,
                businessMapLocation,
                businessPhone,
                businessEmail,
                businessHSTNumber,
                perDayOpenHours: perDayOpenHoursClean, // Note: this is where we now store daily hours!
                businessLogo,
                bannerImage,
                gst,
                serviceWeWorkWith,
            };

            // Start a MongoDB transaction
            session = await mongoose.startSession();
            session.startTransaction();

            let businessProfile;
            if (user.businessProfile) {
                businessProfile = await BusinessProfileModel.findByIdAndUpdate(
                    user.businessProfile,
                    { $set: businessProfileDoc },
                    { new: true, session }
                );
            } else {
                businessProfile = new BusinessProfileModel(businessProfileDoc);
                await businessProfile.save({ session });
                user.businessProfile = businessProfile._id;
            }

            user.isAutoShopBusinessProfileComplete = true;
            await user.save({ session });

            await session.commitTransaction();
            session.endSession();

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
            if (req.files) deleteUploadedFiles(req.files);

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    /**
     * Edit (update) business profile for autoshopowner.
     * Only allows editing of certain fields: (cannot edit name or HST number)
     * Each day in openHours array will have its own timings.
     /**
     * Edit (update) business profile for autoshopowner.
     * Only allows editing of certain fields: (cannot edit name or HST number)
     * Each day in perDayOpenHours array will have its own timings.
     */
    async editBusinessProfile(req, res) {
        let filesToDelete = [];
        let session = null;
        try {
            const userId = req.user?.id;
            // Validate user authentication
            if (!userId) {
                if (req.files) deleteUploadedFiles(req.files);
                console.log("[editBusinessProfile] Unauthorized: userId missing from auth context.");
                return res.status(401).json({ message: "Unauthorized. User ID missing from auth context." });
            }

            // Lookup user
            const user = await User.findById(userId);
            if (!user) {
                if (req.files) deleteUploadedFiles(req.files);
                console.log(`[editBusinessProfile] User not found for userId: ${userId}`);
                return res.status(404).json({ message: "User not found." });
            }

            if (user.role !== "autoshopowner") {
                if (req.files) deleteUploadedFiles(req.files);
                console.log(`[editBusinessProfile] Forbidden: User role is not 'autoshopowner', got: ${user.role}`);
                return res.status(403).json({ message: "Only users with role 'autoshopowner' can edit a business profile." });
            }

            // Must have an existing business profile
            if (!user.businessProfile) {
                if (req.files) deleteUploadedFiles(req.files);
                console.log(`[editBusinessProfile] Business profile not found for userId: ${userId}`);
                return res.status(404).json({ message: "Business profile not found." });
            }

            // Fetch existing business profile
            let businessProfile = await BusinessProfileModel.findById(user.businessProfile);
            if (!businessProfile) {
                if (req.files) deleteUploadedFiles(req.files);
                console.log(`[editBusinessProfile] Business profile document not found for id: ${user.businessProfile}`);
                return res.status(404).json({ message: "Business profile not found." });
            }

            // Only allow editing allowed fields (do not allow editing businessName or businessHSTNumber)
            let {
                businessAddress,
                city,
                pincode,
                businessPhone,
                businessEmail,
                openHours,
                serviceWeWorkWith,
                lat,
                lng,
                gst,
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
                console.log("[editBusinessProfile] Invalid GST: Not a number.", gst);
                return res.status(400).json({ message: "gst must be a number." });
            }

            // ------- openHours flexible validation (array or JSON string or week array string) ---------
            const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            let perDayOpenHoursClean;
            if (openHours !== undefined) {
                // Accept format: array or string (JSON or custom days array string)
                if (typeof openHours === "string") {
                    // Try parsing as JSON
                    try {
                        openHours = JSON.parse(openHours);
                    } catch (e) {
                        // Try: does it look like an array string with objects
                        if (
                            openHours.trim().startsWith('[') &&
                            openHours.trim().indexOf("{") > -1
                        ) {
                            try {
                                openHours = JSON.parse(openHours);
                            } catch (e2) {
                                if (req.files) deleteUploadedFiles(req.files);
                                console.log("[editBusinessProfile] Invalid openHours JSON format. Error:", e2);
                                return res.status(400).json({ message: "Invalid openHours JSON format." });
                            }
                        } else {
                            // Not parsable
                            if (req.files) deleteUploadedFiles(req.files);
                            console.log("[editBusinessProfile] Invalid openHours format: Not JSON and not parsable.");
                            return res.status(400).json({ message: "Invalid openHours format." });
                        }
                    }
                }
                // Now it should be an array
                if (!Array.isArray(openHours)) {
                    if (req.files) deleteUploadedFiles(req.files);
                    console.log("[editBusinessProfile] openHours is not an array after parse.", openHours);
                    return res.status(400).json({ message: "openHours must be an array of objects with keys: day, open, close" });
                }
                perDayOpenHoursClean = [];
                for (const item of openHours) {
                    if (!item || typeof item !== "object") continue;
                    const { day, open, close } = item;
                    // Validate day
                    if (!WEEK_DAYS.includes(day)) {
                        if (req.files) deleteUploadedFiles(req.files);
                        console.log(`[editBusinessProfile] Invalid day in openHours: "${day}"`);
                        return res.status(400).json({ message: `Invalid day in openHours: "${day}". Allowed: ${WEEK_DAYS.join(", ")}` });
                    }
                    // Validate open/close: must be "HH:MM" string
                    if (
                        typeof open !== "string" ||
                        typeof close !== "string" ||
                        !open.match(/^\d{2}:\d{2}$/) ||
                        !close.match(/^\d{2}:\d{2}$/)
                    ) {
                        if (req.files) deleteUploadedFiles(req.files);
                        console.log(`[editBusinessProfile] Invalid open/close time for day "${day}". open:`, open, "close:", close);
                        return res.status(400).json({
                            message: `Invalid open or close time for ${day}. Required "HH:MM" string format.`
                        });
                    }
                    perDayOpenHoursClean.push({ day, open, close });
                }

                // Print perDayOpenHours after cleaning/validation
                console.log("[editBusinessProfile] perDayOpenHours (parsed/validated):", JSON.stringify(perDayOpenHoursClean, null, 2));
            }

            // Parse and validate serviceWeWorkWith field if present
            if (serviceWeWorkWith !== undefined) {
                if (typeof serviceWeWorkWith === "string") {
                    try {
                        const parsed = JSON.parse(serviceWeWorkWith);
                        if (Array.isArray(parsed)) serviceWeWorkWith = parsed;
                        else serviceWeWorkWith = [parsed];
                    } catch {
                        serviceWeWorkWith = serviceWeWorkWith
                            .split(",")
                            .map(s => s.trim())
                            .filter(Boolean);
                    }
                }
                if (!Array.isArray(serviceWeWorkWith)) {
                    if (req.files) deleteUploadedFiles(req.files);
                    console.log("[editBusinessProfile] serviceWeWorkWith is not array after parse:", serviceWeWorkWith);
                    return res.status(400).json({ message: "serviceWeWorkWith must be an array of service IDs." });
                }
                if (serviceWeWorkWith.some(id => typeof id !== "string" || !id.match(/^[a-f\d]{24}$/i))) {
                    if (req.files) deleteUploadedFiles(req.files);
                    console.log("[editBusinessProfile] Invalid ObjectId in serviceWeWorkWith:", serviceWeWorkWith);
                    return res.status(400).json({ message: "Each entry in serviceWeWorkWith must be a valid ObjectId string." });
                }
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
                console.log("[editBusinessProfile] Uploaded/updated businessLogo:", businessLogo);
            }

            // Handle bannerImage (multer upload, allow replacement)
            let bannerImage = businessProfile.bannerImage;
            if (
                req.files &&
                req.files.bannerImage &&
                Array.isArray(req.files.bannerImage) &&
                req.files.bannerImage.length > 0
            ) {
                bannerImage = req.files.bannerImage[0].path;
                filesToDelete.push(req.files.bannerImage[0]);
                console.log("[editBusinessProfile] Uploaded/updated bannerImage:", bannerImage);
            } else if (typeof req.body.bannerImage === "string") {
                bannerImage = req.body.bannerImage;
                console.log("[editBusinessProfile] bannerImage string in body:", bannerImage);
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
                console.log("[editBusinessProfile] Updated businessMapLocation:", businessMapLocation);
            }

            // Prepare update object (only allowed fields)
            const updateData = {};

            if (businessAddress !== undefined) updateData.businessAddress = businessAddress;
            if (city !== undefined) updateData.city = city;
            if (pincode !== undefined) updateData.pincode = pincode;
            if (latDefined || lngDefined) updateData.businessMapLocation = businessMapLocation;
            if (businessPhone !== undefined) updateData.businessPhone = businessPhone;
            if (businessEmail !== undefined) updateData.businessEmail = businessEmail;
            // Use perDayOpenHours according to @file_context_0 schema
            if (openHours !== undefined) {
                updateData.perDayOpenHours = perDayOpenHoursClean;
            }
            if (businessLogo !== undefined) updateData.businessLogo = businessLogo;
            if (bannerImage !== undefined) updateData.bannerImage = bannerImage;
            if (gst !== undefined) updateData.gst = gst;
            if (serviceWeWorkWith !== undefined) updateData.serviceWeWorkWith = serviceWeWorkWith;

            // Start transaction
            session = await mongoose.startSession();
            session.startTransaction();

            // Update business profile doc
            Object.assign(businessProfile, updateData);
            await businessProfile.save({ session });

            await session.commitTransaction();
            session.endSession();

            console.log("[editBusinessProfile] Business profile updated for userId:", userId, "Updated fields:", Object.keys(updateData));

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

        // First, search for vehicles matching numberplate (exclude disabled vehicles)
        let vehicleIds = [];
        const vehicleDocs = await VehicleModel.find(
            {
                licensePlateNo: { $regex: search, $options: "i" },
                disabled: { $ne: true }
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

        // Fetch users, populate their vehicles, but only vehicles that are not disabled
        const users = await User.find(userQuery)
            .select("-password")
            .populate({
                path: "myVehicles",
                model: "Vehicle",
                match: { disabled: { $ne: true } }
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
        const { search, dateType, date, week, month, year } = req.query;

        if (!autoshopOwnerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        // Find autoshop owner and check role
        const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" }).lean();
        if (!autoshopOwner) {
            return res.status(404).json({ message: "Auto shop owner not found." });
        }

        // Prepare numberPlate search if provided via search param, only fetch enabled vehicles
        let vehicleIdsForSearch = [];
        if (search) {
            const vehicleDocs = await VehicleModel.find(
                { 
                    licensePlateNo: { $regex: search, $options: "i" },
                    disabled: { $ne: true }
                },
                { _id: 1 }
            );
            vehicleIdsForSearch = vehicleDocs.map(v => v._id.toString());
        }

        let filteredCustomerIds = [];

        // If no dateType is provided, send all customers from myCustomers
        if (!dateType) {
            filteredCustomerIds = Array.isArray(autoshopOwner.myCustomers)
                ? autoshopOwner.myCustomers.map(id => id && id.toString()).filter(Boolean)
                : [];
        } else {
            // Prepare date range filters for myCustomersMeta
            let startDate, endDate;
            let _dateType = dateType;
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
                    if (typeof month === "string" && isNaN(month)) {
                        const monthNames = [
                            "january", "february", "march", "april", "may", "june",
                            "july", "august", "september", "october", "november", "december"
                        ];
                        let monthLower = month.trim().toLowerCase();
                        _month = monthNames.findIndex(mn => mn.startsWith(monthLower));
                        if (_month === -1) _month = now.getMonth();
                    } else {
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
            filteredCustomerIds = relevantMyCustomersMeta.map(meta => meta.customer && meta.customer.toString()).filter(Boolean);
        }

        if (filteredCustomerIds.length === 0) {
            // No customers match filter, return empty array
            return res.status(200).json({ myCustomers: [] });
        }

        // Build DB query for User customers
        let customersQueryConditions = [
            { _id: { $in: filteredCustomerIds } }
        ];

        if (search) {
            let orConditions = [
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } }
            ];
            if (vehicleIdsForSearch.length > 0) {
                orConditions.push({ myVehicles: { $in: vehicleIdsForSearch } });
            }
            customersQueryConditions.push({ $or: orConditions });
        }

        // If user entered search as numberPlate and there is no match, return empty right away
        if (
            search &&
            search.trim() !== "" &&
            vehicleIdsForSearch.length === 0 && (
                false
            )
        ) {
            return res.status(200).json({ myCustomers: [] });
        }

        // Select all document fields related to vehicles per user
        let customersQuery = User.find({ $and: customersQueryConditions })
            .select("name email phone countryCode status isDisabled myVehicles address pincode profilePhoto documents") // <-- "documents" is important!
            .populate({
                path: "myVehicles",
                model: "Vehicle",
                select: "-carImages -licensePlateFrontImagePath -licensePlateBackImagePath",
                match: { disabled: { $ne: true } }
            });

        const myCustomers = await customersQuery.lean();

        // Helper to format date/time
        const formatDate = (d) => {
            if (!d) return { date: null, time: null };
            const dateObj = new Date(d);
            const yyyy = dateObj.getFullYear();
            const mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
            const dd = ('0' + dateObj.getDate()).slice(-2);
            const hh = ('0' + dateObj.getHours()).slice(-2);
            const mi = ('0' + dateObj.getMinutes()).slice(-2);
            return {
                date: `${yyyy}-${mm}-${dd}`,
                time: `${hh}:${mi}`
            };
        };

        // For all customers, fetch recent job card AND for each vehicle, map their document info
        const result = [];
        for (const cust of myCustomers) {
            // - Map vehicleId => vehicleDoc for fast lookup
            const vehicleMap = {};
            if (Array.isArray(cust.myVehicles)) {
                for (const veh of cust.myVehicles) {
                    vehicleMap[veh._id.toString()] = veh;
                }
            }

            // Group documents by vehicleId, enrich with vehicle info
            const vehicleDocumentsDetailed = [];
            if (Array.isArray(cust.documents)) {
                for (const doc of cust.documents) {
                    const vId = doc.vehicleId && doc.vehicleId.toString();
                    const vehicleData = vehicleMap[vId] || null;

                    vehicleDocumentsDetailed.push({
                        ...doc,
                        vehicleData: vehicleData
                    });
                }
            }

            // Fetch recent job card
            let recentJobCard = await JobCard.findOne({
                customerId: cust._id,
                business: autoshopOwner.businessProfile ? autoshopOwner.businessProfile : undefined
            })
                .sort({ createdAt: -1 })
                .lean();

            let jobCardSummary = null;
            if (recentJobCard) {
                // Only send subServices name list (flattened)
                let subServiceNames = [];
                if (Array.isArray(recentJobCard.services) && recentJobCard.services.length) {
                    for (const svc of recentJobCard.services) {
                        if (Array.isArray(svc.subServices)) {
                            for (const ss of svc.subServices) {
                                if (ss && ss.name) {
                                    subServiceNames.push(ss.name);
                                }
                            }
                        }
                    }
                }

                // Fetch vehicle number plate only for enabled vehicles
                let vehicleNumberPlate = null;
                if (recentJobCard.vehicleId) {
                    try {
                        const vehicleDoc = await VehicleModel.findOne({ _id: recentJobCard.vehicleId, disabled: { $ne: true } })
                            .select("licensePlateNo")
                            .lean();
                        vehicleNumberPlate = vehicleDoc ? vehicleDoc.licensePlateNo : null;
                    } catch (e) {}
                }

                const formatted = formatDate(recentJobCard.createdAt);

                jobCardSummary = {
                    subServices: subServiceNames,
                    date: formatted.date,
                    time: formatted.time,
                    vehicleNumberPlate
                };
            }

            result.push({
                ...cust,
                documents: vehicleDocumentsDetailed, // replaces the documents field: each with vehicleData
                recentJobCard: jobCardSummary
            });
        }

        return res.status(200).json({
            myCustomers: result,
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
 * Fetch all car companies, or filter by companyName if query provided.
 * GET /api/autoshop/car-companies?companyName=Honda
 */
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
  

onboardCarOwner = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    // Cleanup all uploaded files on failure
    const cleanupUploads = async () => {
      const profilePhoto = req.files?.["profilePhoto"]?.[0]?.path;
      if (profilePhoto) await deleteUploadedFile(profilePhoto);
  
      // Clean up all carImage_i files
      for (let i = 0; i < 5; i++) {
        const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
        if (imgPath) await deleteUploadedFile(imgPath);
      }
    };
  
    try {
      const { name, email, phone, countryCode, pincode, role, address, vehicles } = req.body;
  
      let vehiclesArray = vehicles;
      if (typeof vehicles === "string") {
        try { vehiclesArray = JSON.parse(vehicles); }
        catch (e) { vehiclesArray = undefined; }
      }
  
      // ── Validation ──────────────────────────────────────────────────────────
      if (!name || !email || !phone || !countryCode || !pincode || !role || !address) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "All owner fields (name, email, phone, countryCode, pincode, role, address) are required.",
        });
      }
  
      const allowedCountryCodes = ["+1", "+61", "+44", "+91"];
      if (!allowedCountryCodes.includes(countryCode)) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Invalid country code. Allowed: +1, +61, +44, +91.",
        });
      }
  
      if (role !== "carowner") {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Only role 'carowner' is allowed for onboarding via this endpoint.",
        });
      }
  
      if (email) {
        const existingEmailUser = await User.findOne({ email }).session(session);
        if (existingEmailUser) {
          await cleanupUploads();
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            message: "A user with this email already exists.",
            userId: existingEmailUser._id,
          });
        }
      }
  
      if (phone && countryCode) {
        const existingPhoneUser = await User.findOne({ phone, countryCode }).session(session);
        if (existingPhoneUser) {
          await cleanupUploads();
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            message: "A user with this phone and country code already exists.",
            userId: existingPhoneUser._id,
            phone: existingPhoneUser.phone,
            countryCode: existingPhoneUser.countryCode,
            name: existingPhoneUser.name,
            email: existingPhoneUser.email,
          });
        }
      }
  
      // ── Create User ──────────────────────────────────────────────────────────
      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 1000 * 600);
      const profilePhotoPath = req.files?.["profilePhoto"]?.[0]?.path || null;
      const onboardedBy = req.user?.id || null;
  
      const carOwnerPayload = {
        name, email, phone, countryCode, pincode, role, address,
        isProfileComplete: true,
        otp, otpExpiresAt, otpGeneratedAt: new Date(), otpAttempts: 0,
        onboardedBy,
        ...(profilePhotoPath ? { profilePhoto: profilePhotoPath } : {}),
      };
  
      let newCarOwner;
      try {
        [newCarOwner] = await User.create([carOwnerPayload], { session });
      } catch (err) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: "Failed to create car owner profile." });
      }
  
      // ── Process Vehicles ─────────────────────────────────────────────────────
      const newVehicles = [];
  
      async function isDuplicateNotDisabledPlate(licensePlateNo) {
        if (!licensePlateNo) return false;
        return !!(await VehicleModel.findOne({
          licensePlateNo,
          $or: [{ disabled: false }, { disabled: { $exists: false } }],
        }).session(session));
      }
  
      const inputVehiclesArray = Array.isArray(vehiclesArray)
        ? vehiclesArray
        : (req.body.licensePlateNo || req.body.vinNo || req.body.vehicleName
          ? [{
              licensePlateNo:  req.body.licensePlateNo,
              vinNo:           req.body.vinNo,
              vehicleName:     req.body.vehicleName,
              model:           req.body.model,
              year:            req.body.year,
              odometerReading: req.body.odometerReading,
              disabled:        req.body.disabled,
            }]
          : []);
  
      for (let i = 0; i < inputVehiclesArray.length; i++) {
        const veh = inputVehiclesArray[i] || {};
        const { licensePlateNo, vinNo, vehicleName, model, year, odometerReading, disabled } = veh;
  
        const vehiclePayload = {};
        if (licensePlateNo  !== undefined) vehiclePayload.licensePlateNo  = licensePlateNo;
        if (vinNo           !== undefined) vehiclePayload.vinNo           = vinNo;
        if (vehicleName     !== undefined) vehiclePayload.make            = { ...(vehiclePayload.make || {}), name: vehicleName };
        if (model           !== undefined) vehiclePayload.make            = { ...(vehiclePayload.make || {}), model };
        if (year            !== undefined) vehiclePayload.year            = year;
        if (odometerReading !== undefined) vehiclePayload.odometerReading = odometerReading;
        if (disabled        !== undefined) vehiclePayload.disabled        = disabled;
  
        // ✅ Pick carImage for THIS vehicle index: carImage_0, carImage_1, etc.
        const vehicleImagePath = req.files?.[`carImage_${i}`]?.[0]?.path || null;
        if (vehicleImagePath) {
          vehiclePayload.carImages = [vehicleImagePath];
        }
  
        const hasAllRequired =
          vehiclePayload.licensePlateNo &&
          vehiclePayload.vinNo &&
          vehiclePayload.make?.name &&
          vehiclePayload.make?.model &&
          vehiclePayload.year;
  
        if (!hasAllRequired) continue;
  
        if (!vehiclePayload.disabled) {
          const plateExists = await isDuplicateNotDisabledPlate(vehiclePayload.licensePlateNo);
          if (plateExists) {
            await cleanupUploads();
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({
              message: `A vehicle with license plate "${vehiclePayload.licensePlateNo}" already exists and is not disabled.`,
              licensePlateNo: vehiclePayload.licensePlateNo,
            });
          }
        }
  
        try {
          const [createdVehicle] = await VehicleModel.create([vehiclePayload], { session });
  
          newCarOwner.myVehicles.push(createdVehicle._id);
  
          // ✅ Save vehicleId + carImage into User.documents for this vehicle
          const vehicleDoc = { vehicleId: createdVehicle._id };
          if (vehicleImagePath) vehicleDoc.carImage = vehicleImagePath;
          newCarOwner.documents.push(vehicleDoc);
  
          newVehicles.push(createdVehicle);
        } catch (err) {
          await cleanupUploads();
          await session.abortTransaction();
          session.endSession();
          return res.status(500).json({ message: "Failed to create vehicle." });
        }
      }
  
      if (newVehicles.length > 0) {
        try {
          await newCarOwner.save({ session });
        } catch (saveErr) {
          await cleanupUploads();
          await session.abortTransaction();
          session.endSession();
          return res.status(500).json({ message: "Failed to update car owner with vehicles." });
        }
      }
  
      await session.commitTransaction();
      session.endSession();
  
      return res.status(201).json({
        message: "Car owner onboarded successfully.",
        otp,
        carOwner: {
          id:                newCarOwner._id,
          name:              newCarOwner.name,
          email:             newCarOwner.email,
          phone:             newCarOwner.phone,
          countryCode:       newCarOwner.countryCode,
          pincode:           newCarOwner.pincode,
          role:              newCarOwner.role,
          address:           newCarOwner.address,
          isProfileComplete: newCarOwner.isProfileComplete,
          status:            newCarOwner.status,
          onboardedBy:       newCarOwner.onboardedBy,
          profilePhoto:      newCarOwner.profilePhoto,
          documents:         newCarOwner.documents, // vehicleId + carImage per vehicle
          vehicles: newVehicles.map(v => ({
            id:              v._id,
            licensePlateNo:  v.licensePlateNo,
            vinNo:           v.vinNo,
            name:            v.make?.name,
            model:           v.make?.model,
            year:            v.year,
            odometerReading: v.odometerReading,
            carImages:       v.carImages,
          })),
        },
      });
  
    } catch (error) {
      await cleanupUploads();
      try { await session.abortTransaction(); } catch (_) {}
      session.endSession();
      console.error("[onboardCarOwner] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

editCustomer = async (req, res) => {
    try {
      const autoshopOwnerId = req.user?.id;
      const { carOwnerId } = req.body;
  
      // ── Cleanup helper ───────────────────────────────────────────────────────
      const cleanupUploads = async () => {
        if (req.files?.["profilePhoto"]?.[0]?.path) {
          await deleteUploadedFile(req.files["profilePhoto"][0].path);
        }
        for (let i = 0; i < 5; i++) {
          const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
          if (imgPath) await deleteUploadedFile(imgPath);
        }
      };
  
      // Parse vehicles JSON string if needed
      let vehiclesFromBody = req.body.vehicles;
      if (typeof vehiclesFromBody === "string") {
        try { vehiclesFromBody = JSON.parse(vehiclesFromBody); }
        catch (e) { vehiclesFromBody = undefined; }
      }
  
      // ── Auth / ownership checks ──────────────────────────────────────────────
      if (!autoshopOwnerId) {
        await cleanupUploads();
        return res.status(401).json({ message: "Unauthorized." });
      }
      if (!carOwnerId) {
        await cleanupUploads();
        return res.status(400).json({ message: "carOwnerId is required." });
      }
  
      const autoshopOwner = await User.findOne({ _id: autoshopOwnerId, role: "autoshopowner" }).lean();
      if (!autoshopOwner) {
        await cleanupUploads();
        return res.status(404).json({ message: "Auto shop owner not found." });
      }
      if (
        !Array.isArray(autoshopOwner.myCustomers) ||
        !autoshopOwner.myCustomers.map(id => id.toString()).includes(carOwnerId.toString())
      ) {
        await cleanupUploads();
        return res.status(403).json({ message: "This car owner is not your customer." });
      }
  
      // ── Fetch customer ───────────────────────────────────────────────────────
      // Use lean: false so we can mutate documents array below
      const customer = await User.findOne({ _id: carOwnerId, role: "carowner" });
      if (!customer) {
        await cleanupUploads();
        return res.status(404).json({ message: "Car owner not found." });
      }
  
      const existingVehicleIds = Array.isArray(customer.myVehicles)
        ? customer.myVehicles.map(id => id.toString())
        : [];
  
      // ── Build user update fields ─────────────────────────────────────────────
      const allowedUserFields = [
        "name", "email", "phone", "countryCode", "pincode", "address",
        "city", "isDisabled", "isProfileComplete", "favoriteAutoShops",
      ];
      let updateFields = {};
      for (const field of allowedUserFields) {
        if (field in req.body && req.body[field] !== undefined) {
          updateFields[field] = req.body[field];
        }
      }
  
      // Profile photo upload
      const newProfilePhoto = req.files?.["profilePhoto"]?.[0]?.path;
      if (newProfilePhoto) {
        updateFields.profilePhoto = newProfilePhoto;
      }
  
      // ── Process vehicles ─────────────────────────────────────────────────────
      let updatedVehicleObjectIds = [...existingVehicleIds]; // preserve existing
  
      if (Array.isArray(vehiclesFromBody)) {
        for (let i = 0; i < vehiclesFromBody.length; i++) {
          const v = vehiclesFromBody[i];
  
          // ✅ carImage for this specific vehicle via carImage_0, carImage_1, etc.
          const vehicleImagePath = req.files?.[`carImage_${i}`]?.[0]?.path || null;
  
          // ── EDIT EXISTING VEHICLE ────────────────────────────────────────────
          if (v.vId && mongoose.Types.ObjectId.isValid(v.vId)) {
            const vehId = v.vId.toString();
            if (!existingVehicleIds.includes(vehId)) {
              await cleanupUploads();
              return res.status(400).json({
                message: `Invalid vehicle id (${vehId}) for this customer.`,
              });
            }
  
            const allowedVehicleFields = [
              "licensePlateNo", "licensePlateFrontImagePath", "licensePlateBackImagePath",
              "carOwnershipCertificate", "insuranceCertificate", "vinNo", "year",
              "odometerReading", "disabled",
            ];
            let vehicleUpdateFields = {};
            for (const field of allowedVehicleFields) {
              if (v[field] !== undefined) vehicleUpdateFields[field] = v[field];
            }
            if (v.vehicleName !== undefined) vehicleUpdateFields["make.name"] = v.vehicleName;
            if (v.model !== undefined) vehicleUpdateFields["make.model"] = v.model;
  
            // Handle carImages (uploaded file takes priority, then body value)
            if (vehicleImagePath) {
              vehicleUpdateFields.carImages = [vehicleImagePath];
            } else if (typeof v.carImages === "string") {
              try {
                const imgs = JSON.parse(v.carImages);
                if (Array.isArray(imgs)) vehicleUpdateFields.carImages = imgs;
              } catch (e) {}
            } else if (Array.isArray(v.carImages)) {
              vehicleUpdateFields.carImages = v.carImages;
            }
  
            try {
              if (Object.keys(vehicleUpdateFields).length > 0) {
                await VehicleModel.findOneAndUpdate(
                  { _id: vehId },
                  { $set: vehicleUpdateFields },
                  { new: true }
                );
              }
            } catch (err) {
              await cleanupUploads();
              return res.status(500).json({ message: "Vehicle update failed." });
            }
  
            // ✅ Update User.documents entry for this vehicleId
            if (vehicleImagePath) {
              const docEntry = customer.documents.find(
                d => d.vehicleId?.toString() === vehId
              );
              if (docEntry) {
                docEntry.carImage = vehicleImagePath; // update existing
              } else {
                customer.documents.push({ vehicleId: vehId, carImage: vehicleImagePath });
              }
            }
  
          }
          // ── ADD NEW VEHICLE ──────────────────────────────────────────────────
          else if (!v.vId) {
            const requiredFields = ["licensePlateNo", "vehicleName", "model", "year", "vinNo", "odometerReading"];
            const hasAllRequired = requiredFields.every(
              field => v[field] !== undefined && v[field] !== null && v[field] !== ""
            );
  
            if (hasAllRequired) {
              let newCarImages = [];
              if (vehicleImagePath) {
                newCarImages = [vehicleImagePath];
              } else if (typeof v.carImages === "string") {
                try {
                  const imgs = JSON.parse(v.carImages);
                  if (Array.isArray(imgs)) newCarImages = imgs;
                } catch (e) {}
              } else if (Array.isArray(v.carImages)) {
                newCarImages = v.carImages;
              }
  
              const newVehicleData = {
                licensePlateNo:            v.licensePlateNo,
                year:                      v.year,
                "make.name":               v.vehicleName,
                "make.model":              v.model,
                vinNo:                     v.vinNo,
                odometerReading:           v.odometerReading,
                licensePlateFrontImagePath: v.licensePlateFrontImagePath,
                licensePlateBackImagePath:  v.licensePlateBackImagePath,
                carOwnershipCertificate:   v.carOwnershipCertificate,
                insuranceCertificate:      v.insuranceCertificate,
                carImages:                 newCarImages,
                disabled:                  v.disabled,
                owner:                     customer._id,
              };
              // Remove undefined keys
              Object.keys(newVehicleData).forEach(key => {
                if (newVehicleData[key] === undefined) delete newVehicleData[key];
              });
  
              try {
                const newVehicleDoc = await VehicleModel.create(newVehicleData);
                if (newVehicleDoc?._id) {
                  updatedVehicleObjectIds.push(newVehicleDoc._id.toString());
  
                  // ✅ Add new entry in User.documents for new vehicle
                  const docEntry = {
                    vehicleId: newVehicleDoc._id,
                    ...(vehicleImagePath ? { carImage: vehicleImagePath } : {}),
                  };
                  customer.documents.push(docEntry);
                }
              } catch (err) {
                await cleanupUploads();
                return res.status(500).json({ message: "Failed to create vehicle." });
              }
            }
            // skip if required fields missing
          }
        }
  
        updateFields.myVehicles = updatedVehicleObjectIds;
      }
  
      if (Object.keys(updateFields).length === 0 && !vehiclesFromBody) {
        await cleanupUploads();
        return res.status(400).json({ message: "No update fields provided." });
      }
  
      // ✅ Persist documents mutations + other fields
      updateFields.documents = customer.documents;
  
      let customerDoc;
      try {
        customerDoc = await User.findOneAndUpdate(
          { _id: carOwnerId, role: "carowner" },
          { $set: updateFields },
          { new: true }
        )
        .select("name email phone countryCode status isDisabled myVehicles address pincode city profilePhoto isProfileComplete documents favoriteAutoShops onboardedBy")
        .populate({
          path: "myVehicles",
          model: "Vehicle",
          select: "-licensePlateFrontImagePath -licensePlateBackImagePath",
        })
        .lean();
      } catch (err) {
        await cleanupUploads();
        return res.status(500).json({ message: "Customer update failed." });
      }
  
      if (!customerDoc) {
        await cleanupUploads();
        return res.status(404).json({ message: "Car owner not found." });
      }
  
      return res.status(200).json({
        message: "Customer updated successfully.",
        customer: customerDoc,
      });
  
    } catch (error) {
      // best-effort cleanup
      try {
        if (req.files?.["profilePhoto"]?.[0]?.path) {
          await deleteUploadedFile(req.files["profilePhoto"][0].path);
        }
        for (let i = 0; i < 5; i++) {
          const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
          if (imgPath) await deleteUploadedFile(imgPath);
        }
      } catch (_) {}
      console.error("[editCustomer] Error:", error);
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

        // Only consider these services for the response
        const allowedServiceIds = Array.isArray(businessProfile.serviceWeWorkWith)
            ? businessProfile.serviceWeWorkWith.map(id => id.toString())
            : [];

        if (allowedServiceIds.length === 0) {
            // If serviceWeWorkWith is empty, send empty array as user can't work with any services
            return res.status(200).json({
                success: true,
                services: []
            });
        }

        // Fetch only master services present in serviceWeWorkWith
        const allowedServices = await servicesSchema.find({ _id: { $in: allowedServiceIds } }).lean();

        // Map for quick lookup by _id.toString()
        const masterServicesMap = {};
        for (const svc of allowedServices) {
            masterServicesMap[svc._id.toString()] = svc;
        }

        // Map myServices to response format (with selected subservices) for only allowed services
        const result = [];
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

        // Add allowed services NOT present in myServices, with empty subservices
        allowedServices.forEach(masterSvc => {
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
      // Use CarCompany as the single source for all vehicle data
      const [carCompanies, services] = await Promise.all([
        CarCompany.find({}).sort({ createdAt: -1 }).lean(),
        Services.find({}).sort({ createdAt: -1 }).lean(),
      ]);

      // vehicleTypes = array of { companyName, id, brandLogo }
    //   const vehicleTypes = carCompanies.map(company => ({
    //     companyName: company.companyName,
    //     id: company._id?.toString?.() ?? undefined,
    //     brandLogo: company.brandLogo ?? null
    //   }));

      // carCompanyData: all info from carCompany, including models/years
      // Each company item: { id, companyName, brandLogo, models: [ { modelName, years: [...] }, ... ] }
      const carCompanyData = carCompanies.map(company => ({
        id: company._id?.toString?.() ?? undefined,
        companyName: company.companyName,
        brandLogo: company.brandLogo ?? null,
        models: Array.isArray(company.models)
          ? company.models.map(model => ({
              modelName: model.modelName,
              years: Array.isArray(model.years) ? model.years : []
            }))
          : []
      }));

      return res.status(200).json({
        success: true,
        services,
        carDetails: carCompanyData
      });
    } catch (error) {
      console.error("[getAllVehicleTypesAndServices] Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch vehicle types, services, and car companies"
      });
    }
  }

/**
 * Create a new deal (Service, Parts, or Salvages) and link it to the creator's business profile.
 * Handles dealImage upload (single image, field "dealImage").
 * Saves dealImage path in db (DealModel.dealImage). Deletes uploaded image if creation fails.
 * Console.log checks at every step for debugging.
 * 
 * Now also supports originalPrice (required, like discountedPrice).
 * Now supports dealType = "Salvages".
 */
async createDeal(req, res) {
    let uploadedDealImage;
    try {
        console.log("Starting createDeal... Step 1: Fetching user.");
        const userId = req.user.id;
        const user = await User.findById(userId).lean();
        if (!user) {
            console.log("User not found for id:", userId);
            if (req.file?.path) await deleteUploadedFile(req.file.path);
            return res.status(404).json({ success: false, message: "User not found" });
        }
        console.log("User found:", user._id);

        console.log("Step 2: Fetching business profile.");
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            console.log("Business profile not found for:", user.businessProfile);
            if (req.file?.path) await deleteUploadedFile(req.file.path);
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        console.log("Business profile found:", businessProfile._id);

        // Save image path for DB (not URL!), remove on error below if need be
        if (req.file?.path) {
            uploadedDealImage = req.file.path;
            console.log("Deal image uploaded at path:", uploadedDealImage);
        }

        let {
            dealType,
            serviceId,
            partName,
            description,
            discountedPrice,
            originalPrice,
            offerEndsOnDate,
            vehicleId,
            vehicleName,
            vehicleModel,
            vehicleYear
        } = req.body;
        console.log("Step 3: Raw body values:", req.body);

        dealType = typeof dealType === "string" ? dealType.trim() : undefined;
        partName = typeof partName === "string" ? partName.trim() : undefined;
        description = typeof description === "string" ? description.trim() : undefined;
        discountedPrice = typeof discountedPrice === "string" ? Number(discountedPrice) : discountedPrice;
        originalPrice = typeof originalPrice === "string" ? Number(originalPrice) : originalPrice;
        serviceId = typeof serviceId === "string" ? serviceId.trim() : undefined;
        vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : undefined;
        vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : undefined;
        vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : undefined;
        vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : vehicleYear;
        console.log("Step 4: Normalized and prepared fields:",
            { dealType, serviceId, partName, description, discountedPrice, originalPrice, offerEndsOnDate, vehicleId, vehicleName, vehicleModel, vehicleYear }
        );

        // Validate dealType
        const allowedDealTypes = ["Service", "Parts", "Salvages"];
        if (!dealType || !allowedDealTypes.includes(dealType)) {
            console.log("Invalid dealType:", dealType);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({ success: false, message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'." });
        }
        console.log("dealType validated:", dealType);

        // Validate dealType fields
        if (dealType === "Service") {
            console.log("Step 5: Validating Service dealType...");
            if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
                console.log("Invalid or missing servicesId:", serviceId);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: "servicesId is required and must be a valid MongoDB ObjectId for 'Service' deals."
                });
            }
            const serviceExists = await Services.exists({ _id: serviceId });
            console.log("Service exists check:", serviceExists);
            if (!serviceExists) {
                console.log("servicesId does not correspond to a valid service.", serviceId);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(404).json({
                    success: false,
                    message: "The specified servicesId does not correspond to a valid service."
                });
            }
        } else if (dealType === "Parts" || dealType === "Salvages") {
            // Salvages and Parts must have partName, vehicleId, vehicleName, vehicleModel, vehicleYear
            console.log(`Step 5: Validating ${dealType} dealType...`);
            if (!partName) {
                console.log(`Missing partName for ${dealType} deal.`);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
            }
            if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
                console.log(`Invalid or missing vehicleId:`, vehicleId);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({ success: false, message: `vehicleId is required and must be a valid MongoDB ObjectId for '${dealType}' deals.` });
            }
            if (!vehicleName || !vehicleModel || !vehicleYear) {
                console.log("One or more required vehicle fields missing.",
                    { vehicleName, vehicleModel, vehicleYear }
                );
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals."
                });
            }
        }

        if (!description || typeof description !== "string" || !description.trim()) {
            console.log("Missing or empty description.");
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
        }
        console.log("description validated.");

        // Validate originalPrice
        if (
            originalPrice === undefined ||
            originalPrice === null ||
            typeof originalPrice !== "number" ||
            isNaN(originalPrice) ||
            originalPrice < 0
        ) {
            console.log("Invalid originalPrice:", originalPrice);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({
                success: false,
                message: "originalPrice is required and must be a number greater than or equal to zero."
            });
        }
        console.log("originalPrice validated:", originalPrice);

        // Validate discountedPrice
        if (
            discountedPrice === undefined ||
            discountedPrice === null ||
            typeof discountedPrice !== "number" ||
            isNaN(discountedPrice) ||
            discountedPrice < 0
        ) {
            console.log("Invalid discountedPrice:", discountedPrice);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({
                success: false,
                message: "discountedPrice is required and must be a number greater than or equal to zero."
            });
        }
        console.log("discountedPrice validated:", discountedPrice);

        // discountedPrice should not be more than originalPrice
        if (discountedPrice > originalPrice) {
            console.log(`discountedPrice (${discountedPrice}) is greater than originalPrice (${originalPrice})`);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({
                success: false,
                message: "discountedPrice cannot be greater than originalPrice."
            });
        }

        if (!offerEndsOnDate || typeof offerEndsOnDate !== "string") {
            console.log("Missing or invalid offerEndsOnDate.");
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({ success: false, message: "offerEndsOnDate is required and must be a string in ISO format." });
        }
        const offerEndsDate = new Date(offerEndsOnDate);
        if (isNaN(offerEndsDate.getTime()) || offerEndsDate <= new Date()) {
            console.log("offerEndsOnDate is invalid or in the past:", offerEndsOnDate);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({
                success: false,
                message: "offerEndsOnDate must be a valid ISO date string and must be in the future."
            });
        }
        console.log("offerEndsOnDate validated:", offerEndsDate);

        // Ensure uniqueness for (dealType, createdBy, deal-differentiator)
        let uniqueQuery = {
            dealType,
            createdBy: businessProfile._id
        };
        if (dealType === "Service") {
            uniqueQuery.serviceId = serviceId;
        } else {
            uniqueQuery.partName = partName;
            uniqueQuery.vehicle = vehicleId;
        }
        console.log("Checking for deal uniqueness with:", uniqueQuery);

        const duplicate = await DealModel.findOne(uniqueQuery).lean();
        if (duplicate) {
            console.log("Duplicate deal detected:", duplicate._id);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({
                success: false,
                message: "A deal with these values already exists for your business profile."
            });
        }
        console.log("No duplicate found. Proceeding...");

        // Prepare deal doc, always include dealImage path if present
        let dealDoc = {
            dealType,
            description,
            originalPrice,
            discountedPrice,
            offerEndsOnDate: offerEndsDate,
            createdBy: businessProfile._id,
            ...(uploadedDealImage && { dealImage: uploadedDealImage })
        };

        if (dealType === "Service") {
            dealDoc.serviceId = serviceId;
        } else { // Parts or Salvages
            dealDoc.partName = partName;
            dealDoc.vehicle = vehicleId;
            dealDoc.selectedVehicle = {
                id: vehicleId,
                name: vehicleName,
                model: vehicleModel,
                year: vehicleYear
            };
        }
        console.log("Deal doc prepared:", dealDoc);

        const newDeal = await DealModel.create(dealDoc);
        console.log("Deal created in DB:", newDeal._id);

        if (!Array.isArray(businessProfile.myDeals)) businessProfile.myDeals = [];
        businessProfile.myDeals.push(newDeal._id);
        await businessProfile.save();
        console.log("Deal ID pushed to businessProfile.myDeals and saved.");

        return res.status(201).json({
            success: true,
            message: "Deal created successfully",
            data: newDeal
        });
    } catch (error) {
        console.log("Error caught in createDeal:", error);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
        return res.status(500).json({
            success: false,
            message: error?.name === "ValidationError" ? "Validation error creating deal" : "Error creating deal",
            error: error.message
        });
    }
}

/**
 * Edit an existing deal (only if current business profile created it).
 * Allows changing all fields except createdBy.
 * Updates or replaces dealImage path in db (DealModel.dealImage).
 * Deletes the old image file on replacement. On validation/DB error with a new upload, deletes the new image file.
 * Console.log checks at every step for debugging.
 *
 * Now also supports originalPrice and dealType = "Salvages".
 */
async editDeal(req, res) {
    let uploadedDealImage, oldDealImage;
    try {
        console.log("Starting editDeal... Step 1: Fetching user.");
        const userId = req.user.id;
        const user = await User.findById(userId).lean();
        if (!user) {
            console.log("User not found for id:", userId);
            if (req.file?.path) await deleteUploadedFile(req.file.path);
            return res.status(404).json({ success: false, message: "User not found" });
        }
        console.log("User found:", user._id);

        console.log("Step 2: Fetching business profile.");
        const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
        if (!businessProfile) {
            console.log("Business profile not found for:", user.businessProfile);
            if (req.file?.path) await deleteUploadedFile(req.file.path);
            return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        const businessProfileId = businessProfile._id;
        console.log("Business profile found:", businessProfileId);

        const { id } = req.params;
        console.log("Editing deal with id:", id);

        // Get deal (must be owned)
        let deal = await DealModel.findOne({ _id: id, createdBy: businessProfileId });
        if (!deal) {
            console.log("No deal found for this business profile and id:", id);
            if (req.file?.path) await deleteUploadedFile(req.file.path);
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }
        let updates = {};
        oldDealImage = deal.dealImage;
        console.log("Current deal fetched. Old dealImage:", oldDealImage);

        // Handle new image: save path in DB and delete old if needed later
        if (req.file?.path) {
            uploadedDealImage = req.file.path;
            updates.dealImage = uploadedDealImage;
            console.log("New deal image uploaded at path:", uploadedDealImage);
        }

        // Parse/validate fields
        let {
            dealType,
            servicesId,
            partName,
            description,
            discountedPrice,
            originalPrice,
            offerEndsOnDate,
            vehicleId,
            vehicleName,
            vehicleModel,
            vehicleYear
        } = req.body;
        console.log("Step 3: Raw body values:", req.body);

        // Only allow dealType update to allowed set
        const allowedDealTypes = ["Service", "Parts", "Salvages"];
        dealType = typeof dealType === "string" ? dealType.trim() : deal.dealType;
        updates.dealType = dealType;
        if (!allowedDealTypes.includes(dealType)) {
            console.log("Invalid dealType in edit:", dealType);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({ success: false, message: "dealType is required and must be 'Service', 'Parts', or 'Salvages'." });
        }
        console.log("Prepared dealType for update:", dealType);

        if (dealType === "Service") {
            console.log("Step 4: Processing Service type update...");
            if (typeof servicesId === "undefined" || servicesId === null) {
                servicesId = deal.servicesId;
            }
            if (!servicesId || !mongoose.Types.ObjectId.isValid(servicesId)) {
                console.log("Invalid or missing servicesId in edit:", servicesId);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: "servicesId is required and must be a valid ObjectId for 'Service' deals."
                });
            }
            const serviceExists = await Services.exists({ _id: servicesId });
            console.log("Service exists check:", serviceExists);
            if (!serviceExists) {
                console.log("servicesId does not correspond to a valid service:", servicesId);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(404).json({
                    success: false,
                    message: "The specified servicesId does not correspond to a valid service."
                });
            }
            updates.servicesId = servicesId;
            updates.partName = undefined;
            updates.vehicle = undefined;
            updates.selectedVehicle = undefined;
        }

        if (dealType === "Parts" || dealType === "Salvages") {
            console.log(`Step 4: Processing ${dealType} type update...`);
            partName = typeof partName === "string" ? partName.trim() : deal.partName;
            vehicleId = typeof vehicleId === "string" ? vehicleId.trim() : deal.vehicle;
            vehicleName = typeof vehicleName === "string" ? vehicleName.trim() : deal.selectedVehicle?.name;
            vehicleModel = typeof vehicleModel === "string" ? vehicleModel.trim() : deal.selectedVehicle?.model;
            vehicleYear = typeof vehicleYear === "string" ? vehicleYear.trim() : deal.selectedVehicle?.year;

            if (!partName) {
                console.log(`Missing partName for ${dealType} edit.`);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({ success: false, message: `partName is required for dealType '${dealType}'.` });
            }
            if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
                console.log(`Invalid or missing vehicleId for ${dealType} edit:`, vehicleId);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: `vehicleId is required and must be a valid ObjectId for '${dealType}' deals.`
                });
            }
            if (!vehicleName || !vehicleModel || !vehicleYear) {
                console.log("Missing vehicular detail(s) in edit:",
                    { vehicleName, vehicleModel, vehicleYear }
                );
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: "vehicleName, vehicleModel, and vehicleYear are required for '" + dealType + "' deals."
                });
            }
            updates.partName = partName;
            updates.vehicle = vehicleId;
            updates.selectedVehicle = {
                id: vehicleId,
                name: vehicleName,
                model: vehicleModel,
                year: vehicleYear
            };
            updates.servicesId = undefined;
        }

        // Common updates
        if (typeof description !== "undefined") {
            if (typeof description !== "string" || !description.trim()) {
                console.log("Description missing/invalid in edit.");
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({ success: false, message: "description is required and cannot be empty." });
            }
            updates.description = description.trim();
        }

        // Handle originalPrice (can be updated only if provided)
        if (typeof originalPrice !== "undefined") {
            originalPrice = typeof originalPrice === "string" ? Number(originalPrice) : originalPrice;
            if (
                originalPrice === undefined ||
                originalPrice === null ||
                typeof originalPrice !== "number" ||
                isNaN(originalPrice) ||
                originalPrice < 0
            ) {
                console.log("originalPrice is missing or invalid in edit:", originalPrice);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: "originalPrice is required and must be a number greater than or equal to zero."
                });
            }
            updates.originalPrice = originalPrice;
            console.log("originalPrice processed for update:", originalPrice);
        } else if (typeof updates.originalPrice === "undefined" && typeof deal.originalPrice !== "undefined") {
            updates.originalPrice = deal.originalPrice;
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
                console.log("discountedPrice is missing or invalid in edit:", discountedPrice);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: "discountedPrice is required and must be a number greater than or equal to zero."
                });
            }
            updates.discountedPrice = discountedPrice;
            console.log("discountedPrice processed for update:", discountedPrice);
        } else if (typeof updates.discountedPrice === "undefined" && typeof deal.discountedPrice !== "undefined") {
            updates.discountedPrice = deal.discountedPrice;
        }

        // discountedPrice should not be more than originalPrice
        let tempOriginalPrice = (typeof updates.originalPrice === "number" ? updates.originalPrice : deal.originalPrice);
        let tempDiscountedPrice = (typeof updates.discountedPrice === "number" ? updates.discountedPrice : deal.discountedPrice);
        if (typeof tempOriginalPrice === "number" && typeof tempDiscountedPrice === "number" && tempDiscountedPrice > tempOriginalPrice) {
            console.log(`discountedPrice (${tempDiscountedPrice}) is greater than originalPrice (${tempOriginalPrice})`);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({
                success: false,
                message: "discountedPrice cannot be greater than originalPrice."
            });
        }

        if (typeof offerEndsOnDate !== "undefined") {
            const offerDate = typeof offerEndsOnDate === "string" ? new Date(offerEndsOnDate) : offerEndsOnDate;
            if (!offerDate || isNaN(offerDate.getTime()) || offerDate <= new Date()) {
                console.log("offerEndsOnDate invalid in edit:", offerEndsOnDate);
                if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
                return res.status(400).json({
                    success: false,
                    message: "offerEndsOnDate must be a valid ISO date string and must be in the future."
                });
            }
            updates.offerEndsOnDate = offerDate;
            console.log("offerEndsOnDate processed for update:", offerDate);
        }

        // Check for duplicate except self
        let duplicateQuery = { dealType, createdBy: businessProfileId, _id: { $ne: id } };
        if (dealType === "Service") {
            duplicateQuery.servicesId = updates.servicesId;
        }
        if (dealType === "Parts" || dealType === "Salvages") {
            duplicateQuery.partName = updates.partName;
            duplicateQuery.vehicle = updates.vehicle;
        }
        console.log("Checking for duplicate deal in editDeal. Query:", duplicateQuery);

        const duplicateDeal = await DealModel.findOne(duplicateQuery).lean();
        if (duplicateDeal) {
            console.log("Duplicate deal found in editDeal:", duplicateDeal._id);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(400).json({
                success: false,
                message: "A deal with these values already exists for your business profile."
            });
        }
        console.log("No duplicate found. Proceeding to update...");

        // Remove fields not needed in update
        if (dealType === "Service") {
            delete updates.partName;
            delete updates.vehicle;
            delete updates.selectedVehicle;
        } else if (dealType === "Parts" || dealType === "Salvages") {
            delete updates.servicesId;
        }
        delete updates.createdBy;
        console.log("Final update fields:", updates);

        const updatedDeal = await DealModel.findOneAndUpdate(
            { _id: id, createdBy: businessProfileId },
            updates,
            { new: true }
        );
        if (!updatedDeal) {
            console.log("Failed to update the deal - not found or not permitted:", id);
            if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
            return res.status(404).json({ success: false, message: "Deal not found or not permitted" });
        }
        console.log("Deal updated successfully. ID:", updatedDeal._id);

        // Remove old deal image if replaced (detect by comparing path)
        if (uploadedDealImage && oldDealImage && uploadedDealImage !== oldDealImage) {
            console.log("Deleting old deal image:", oldDealImage);
            await deleteUploadedFile(oldDealImage);
        }

        return res.status(200).json({ success: true, message: "Deal updated", data: updatedDeal });
    } catch (error) {
        console.log("Error caught in editDeal:", error);
        if (uploadedDealImage) await deleteUploadedFile(uploadedDealImage);
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

        // Fetch all deals for this business
        const deals = await DealModel.find({
            _id: { $in: dealIds },
            createdBy: businessProfile._id
        })
            .populate({ path: "serviceId", select: "name desc", strictPopulate: false })
            .populate({ path: "createdBy", select: "name _id", strictPopulate: false })
            .lean();

        let serviceDeals = [];
        let partsDeals = [];

        for (const deal of deals) {
            if (deal.dealType === "Service") {
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
                    dealImage: deal.dealImage ?? null, // pass dealImage
                    _id: deal._id
                });
            }

            if (deal.dealType === "Parts") {
                // According to deals.schema.js:
                // selectedVehicle is an embedded document with id, name, model, year as strings/ids,
                // partName is required (string), description, discountedPrice, offerEndsOnDate.
                // We do NOT need to fetch and merge vehicle from VehicleModel, just return deal.selectedVehicle as per the schema.

                // selectedVehicle may be undefined/null for some entries; only send if valid object.
                let selectedVehicle = null;
                if (
                    deal.selectedVehicle &&
                    typeof deal.selectedVehicle === "object" &&
                    deal.selectedVehicle.id &&
                    deal.selectedVehicle.name &&
                    deal.selectedVehicle.model &&
                    deal.selectedVehicle.year
                ) {
                    // Build selectedVehicle to match @deals.schema.js (id, name, model, year)
                    selectedVehicle = {
                        id: deal.selectedVehicle.id,
                        name: deal.selectedVehicle.name,
                        model: deal.selectedVehicle.model,
                        year: deal.selectedVehicle.year
                    };
                }

                partsDeals.push({
                    dealType: deal.dealType,
                    partName: deal.partName,
                    selectedVehicle, // This matches the actual schema, no filtering for enable/disable
                    description: deal.description,
                    discountedPrice: deal.discountedPrice,
                    offerEndsOnDate: deal.offerEndsOnDate,
                    createdBy: deal.createdBy && deal.createdBy._id ? deal.createdBy._id : deal.createdBy,
                    dealImage: deal.dealImage ?? null, // pass dealImage
                    _id: deal._id
                });
            }
        }

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
 * 
 * NOTE: Each subService can (and should) contain its own labourCharge and labourDuration (time).
 *       Overall `labourCharge` and `labourDuration` on JobCard must also be present.
 */

async createJobCard(req, res) {
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
            labourCharge,    // <--- Overall Number, must stay
            labourDuration   // <--- Overall String, must stay
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
        // Check for presence of overall labourCharge/labourDuration as required per new context
        if (labourCharge === undefined) missingFields.push("labourCharge");
        if (!labourDuration) missingFields.push("labourDuration");

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
        // Validate that vehicle belongs to customer and that it is not disabled
        let myVehiclesList = [];
        let vehicleObj = null;
        if (Array.isArray(customerUser.myVehicles)) {
            for (const v of customerUser.myVehicles) {
                const vehicleIdResolved =
                    v.vehicle?._id?.toString() || v._id?.toString() || v.toString();
                if (vehicleIdResolved === vehicleId.toString()) {
                    myVehiclesList.push(vehicleIdResolved);
                    vehicleObj = (v.vehicle && typeof v.vehicle === "object" && v.vehicle._id)
                        ? v.vehicle
                        : null;
                }
            }
        }
        if (!myVehiclesList.length) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Vehicle does not belong to customer" });
        }
        let isVehicleDisabled = false;
        if (vehicleObj && typeof vehicleObj === "object" && vehicleObj.hasOwnProperty("disabled")) {
            isVehicleDisabled = !!vehicleObj.disabled;
        } else {
            const vehicleRecord = await VehicleModel.findById(vehicleId).lean();
            if (!vehicleRecord) {
                if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
                return res.status(400).json({ success: false, message: "Vehicle record not found" });
            }
            isVehicleDisabled = !!vehicleRecord.disabled;
        }
        if (isVehicleDisabled) {
            if (uploadedPhotos.length) await deleteUploadedFiles(uploadedPhotos);
            return res.status(400).json({ success: false, message: "Vehicle is disabled and cannot be used" });
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

        // Calculate total amount (sum of all subServices' price and per-subService labour charges, plus overall labourCharge)
        let totalAmount = 0;
        const servicesPayload = (services || []).map(serviceItem => {
            let subTotal = 0;
            const mappedSubServices = Array.isArray(serviceItem.subServices)
                ? serviceItem.subServices.map(ss => {
                    const price = parseFloat(ss.price ?? 0);
                    let subLabourCharge =
                        ss.labourCharge !== undefined && !isNaN(parseFloat(ss.labourCharge))
                            ? parseFloat(ss.labourCharge)
                            : 0;
                    if (!isNaN(price)) subTotal += price;
                    if (!isNaN(subLabourCharge)) subTotal += subLabourCharge;
                    return {
                        name: ss.name,
                        desc: ss.desc,
                        price: isNaN(price) ? 0 : price,
                        labourCharge: isNaN(subLabourCharge) ? 0 : subLabourCharge,
                        labourDuration: typeof ss.labourDuration === "string" ? ss.labourDuration : undefined
                    };
                })
                : [];
            totalAmount += subTotal;

            return {
                service: serviceItem.service?.toString() || serviceItem.id?.toString(),
                subServices: mappedSubServices
            };
        });

        // Add overall labourCharge on top if provided
        let parsedLabourCharge = 0;
        if (labourCharge !== undefined && !isNaN(parseFloat(labourCharge))) {
            parsedLabourCharge = parseFloat(labourCharge);
            totalAmount += parsedLabourCharge;
        }

        // ====== Generate jobNo using Counter collection ======
        let jobNo;
        try {
            const counter = await counterSchema.findOneAndUpdate(
                { name: "jobNo" },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );

            if (counter && typeof counter.seq === "number") {
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
            totalPayableAmount: Number(totalAmount.toFixed(2)),
            // ---- Must retain overall labour fields on JobCard ----
            labourCharge: parsedLabourCharge,
            labourDuration: typeof labourDuration === "string" ? labourDuration : undefined,
            status: "Pending",
            jobNo
        });

        await jobCardDoc.save();

        return res.status(201).json({
            success: true,
            message: "JobCard created successfully",
            data: {
                ...jobCardDoc.toObject(),
                totalPayableAmount: Number(totalAmount.toFixed(2)),
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
 * 
 * NOTE: Each subService can (and should) contain its own labourCharge and labourDuration (time).
 *       Overall `labourCharge` and `labourDuration` on JobCard must also be present.
 */
async editJobCard(req, res) {
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

            // Calculate amounts (sum per subService including subService.labourCharge)
            servicesPayload = (services || []).map(serviceItem => {
                let subTotal = 0;
                const mappedSubServices = Array.isArray(serviceItem.subServices)
                    ? serviceItem.subServices.map(ss => {
                        const price = parseFloat(ss.price ?? 0);
                        let subLabourCharge =
                            ss.labourCharge !== undefined && !isNaN(parseFloat(ss.labourCharge))
                                ? parseFloat(ss.labourCharge)
                                : 0;
                        if (!isNaN(price)) subTotal += price;
                        if (!isNaN(subLabourCharge)) subTotal += subLabourCharge;
                        return {
                            name: ss.name,
                            desc: ss.desc,
                            price: isNaN(price) ? 0 : price,
                            labourCharge: isNaN(subLabourCharge) ? 0 : subLabourCharge,
                            labourDuration: typeof ss.labourDuration === "string" ? ss.labourDuration : undefined
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
                    sum += Number(sub.labourCharge || 0);
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

        // Parse/override labourCharge/labourDuration if provided
        let parsedLabourCharge = req.body.labourCharge !== undefined
            ? parseFloat(req.body.labourCharge)
            : (typeof jobCard.labourCharge === "number" ? jobCard.labourCharge : 0);
        if (isNaN(parsedLabourCharge)) parsedLabourCharge = 0;
        let labourDurationValue = req.body.labourDuration !== undefined
            ? (typeof req.body.labourDuration === "string" ? req.body.labourDuration : undefined)
            : (typeof jobCard.labourDuration === "string" ? jobCard.labourDuration : undefined);

        // If present, add overall labourCharge to total
        if (req.body.labourCharge !== undefined) {
            totalAmount += parsedLabourCharge;
        } else if (typeof jobCard.labourCharge === "number" && !isNaN(jobCard.labourCharge)) {
            totalAmount += Number(jobCard.labourCharge);
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
            totalPayableAmount: Number(totalAmount.toFixed(2)),
            labourCharge: parsedLabourCharge,
            labourDuration: labourDurationValue
        };

        for (const key in fieldsToUpdate) {
            jobCard[key] = fieldsToUpdate[key];
        }

        await jobCard.save();

        return res.status(200).json({
            success: true,
            message: "JobCard updated successfully",
            data: {
                ...jobCard.toObject(),
                totalPayableAmount: Number(totalAmount.toFixed(2)),
                services: servicesPayload,
                labourCharge: parsedLabourCharge,
                labourDuration: labourDurationValue
            }
        });
    } catch (err) {
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
 * Resend JobCard: Notifies the customer by push notification about a JobCard.
 * Finds the job card, loads user and business profile, sends notification via FCM and saves in DB.
 * Params:
 *   - req.params.jobCardId: JobCard ID to notify about
 */
async resendJobCard(req, res) {
    try {
        const { jobCardId } = req.params;
        if (!jobCardId) {
            return res.status(400).json({
                success: false,
                message: "Missing jobCardId in params."
            });
        }

        // Lazy imports to avoid cyclic dependencies if needed
        let JobCard, BusinessProfileModel, firebaseAdmin, UserModel;
        try {
            JobCard = (await import("../../Schema/jobCard.schema.js")).default;
            BusinessProfileModel = (await import("../../Schema/bussiness-profile.js")).default;
            firebaseAdmin = (await import("../../config/firebase.js")).default;
            UserModel = (await import("../../Schema/user.schema.js")).User;

        } catch (e) {
            console.error("[resendJobCard] Error loading dependencies:", e);
            return res.status(500).json({
                success: false,
                message: "Server error loading dependencies."
            });
        }

        // Fetch the job card with both business and customer details
        const jobCard = await JobCard.findById(jobCardId).lean();
        if (!jobCard) {
            return res.status(404).json({
                success: false,
                message: "JobCard not found for the given ID."
            });
        }

        // Only send notification if status is 'Pending'
        if (jobCard.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: "JobCard can only be resent when its status is 'Pending'."
            });
        }

        const customerId = jobCard.customerId;
        const businessId = jobCard.business;
        const vehicleId = jobCard.vehicleId;

        // Fetch user
        const customerUser = await UserModel.findById(customerId).lean();
        if (!customerUser) {
            return res.status(404).json({
                success: false,
                message: "User associated with JobCard not found."
            });
        }

        // Fetch vehicle to enrich notification (regNo, etc)
        let vehicle = null;
        if (vehicleId) {
            try {
                vehicle = await VehicleModel.findById(vehicleId).lean();
            } catch (err) {
                // ignore vehicle error
                vehicle = null;
            }
        }

        // Prepare notification message text
        const jobNo = jobCard.jobNo ? `Job No: ${jobCard.jobNo}` : `JobCard ID: ${jobCardId}`;
        const regNo = vehicle && vehicle.regNo ? vehicle.regNo : '';
        const jobServiceType = jobCard.serviceType || '';
        const issueDescription = jobCard.issueDescription || '';
        let notificationBody = `Your job card is ready: ${jobNo}`;
        if (regNo) notificationBody += ` | Vehicle: ${regNo}`;
        if (jobServiceType) notificationBody += ` | Type: ${jobServiceType}`;
        if (issueDescription) notificationBody += ` | Issue: ${issueDescription}`;

        // Save notification in business profile's notifications (target user)
        let notificationError = null;
        let notified = false;

        try {
            // Save notification in notifications array too (in business if needed)
            // But mainly for user - add logic here if desired

            // Prepare and send push notification via FCM if customer has fcmToken
            if (customerUser.fcmToken) {
                const fcmMessage = {
                    notification: {
                        title: "Job Card Notification",
                        body: notificationBody
                    },
                    token: customerUser.fcmToken
                };
                try {
                    await firebaseAdmin.messaging().send(fcmMessage);
                    notified = true;
                    console.log(`[resendJobCard] FCM notification sent to customer (${customerUser._id}) token: ${customerUser.fcmToken}`);
                } catch (notifyErr) {
                    // notificationError assigned for API output
                    notificationError = notifyErr;
                    console.error("[resendJobCard] Failed to send FCM notification:", notifyErr);
                }
            } else {
                notificationError = new Error("User has no fcmToken");
                console.warn("[resendJobCard] User does not have an FCM token for push notification.");
            }
        } catch (err) {
            notificationError = err;
            console.error("[resendJobCard] Unexpected notification error:", err);
        }

        // Save in-app notification to user's notification array if desired (if you have notifications on user model)
        // Or if your notification infra is only business-level, can skip (check your architecture)

        return res.status(200).json({
            success: true,
            message: "JobCard notification sent to user"
                + (notified ? "" : " (notification failed: " + (notificationError?.message || notificationError) + ")"),
            notified,
            notificationError: notificationError ? (notificationError.message || notificationError.toString()) : null,
            jobCardId,
        });
    } catch (err) {
        console.error("[resendJobCard] Unexpected error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
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

        const {
            dateType,
            date,
            week,
            month,
            year
        } = req.query;

        let createdAtMatch = {};

        if (typeof dateType !== "undefined" && dateType !== null && dateType !== "") {
            let _dateType = dateType;
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
                        if (typeof month === "string" && month.match(/^\d{1,2}$/)) {
                            let monthNum = Number(month);
                            if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                                _month = monthNum - 1;
                            } else {
                                _month = now.getMonth();
                            }
                        } else {
                            let monthNum = Number(month);
                            if (!isNaN(monthNum)) {
                                if (monthNum >= 1 && monthNum <= 12) {
                                    _month = monthNum - 1;
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
        }

        const baseQuery = {
            business: user.businessProfile,
            ...createdAtMatch,
        };

        // Step 1: Find expired "Pending" job cards and update them to "AutoRejected"
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        // Only update status if still Pending and older than 2 hours
        await JobCard.updateMany(
            {
                ...baseQuery,
                status: "Pending",
                createdAt: { $lt: twoHoursAgo }
            },
            { $set: { status: "AutoRejected" } }
        );

        // Step 2: Now fetch the updated job cards
        const [pendingJobCards, approvedJobCards, rejectedJobCards, autoRejectedJobCards] = await Promise.all([
            JobCard.find({ ...baseQuery, status: "Pending" })
                .populate([
                    { path: 'customerId', model: 'User', select: 'name phone email' },
                    { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' },
                ])
                .sort({ createdAt: -1 })
                .lean(),
            JobCard.find({ ...baseQuery, status: "Approved" })
                .populate([
                    { path: 'customerId', model: 'User', select: 'name phone email' },
                    { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' },
                ])
                .sort({ createdAt: -1 })
                .lean(),
            JobCard.find({ ...baseQuery, status: "Rejected" })
                .populate([
                    { path: 'customerId', model: 'User', select: 'name phone email' },
                    { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' },
                ])
                .sort({ createdAt: -1 })
                .lean(),
            JobCard.find({ ...baseQuery, status: "AutoRejected" })
                .populate([
                    { path: 'customerId', model: 'User', select: 'name phone email' },
                    { path: 'vehicleId', model: 'Vehicle', select: 'make model licensePlateNo' },
                ])
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        return res.status(200).json({
            success: true,
            pending: pendingJobCards,
            approved: approvedJobCards,
            rejected: rejectedJobCards,
            autoRejected: autoRejectedJobCards
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
   * Fetch website templates and check if the business has a purchased template.
   * GET /api/autoshop/website-templates
   * If business has a purchased template, send only that template as selected.
   * If not, send all templates to select from.
   * For now, use sample data for purchased template status.
   */
  async fetchWebsiteTemplates(req, res) {
    try {
      // Fetch all templates
      const templates = await WebsiteTemplateSchema.find({}).lean();

      // Simulate fetching user's business profile and template purchase info
      // In real use, replace the following lines with actual logic to get the business and its template
      // e.g. const businessId = req.user.businessProfile;
      // const business = await BusinessProfileModel.findById(businessId).lean();
      // let purchasedTemplateId = business?.purchasedTemplateId || null;

      // --- Begin Sample Data ---
      // For now, simulate: hasPurchasedTemplate = true/false
      // When true, set a sample template as "purchased"
      const hasPurchasedTemplate = false; // set to true to simulate purchased

      let purchasedTemplateId = null;
      if (hasPurchasedTemplate && templates.length > 0) {
        // Just for demo: select first template as purchased
        purchasedTemplateId = templates[0]._id;
      }
      // --- End Sample Data ---

      if (purchasedTemplateId) {
        // If user purchased a template, send only the selected template
        const selectedTemplate = templates.find(t => t._id.toString() === purchasedTemplateId.toString());
        return res.status(200).json({ 
          success: true, 
          hasPurchasedTemplate: true,
          selectedTemplate 
        });
      } else {
        // Else, send all templates for selection
        return res.status(200).json({ 
          success: true, 
          hasPurchasedTemplate: false,
          data: templates 
        });
      }
    } catch (err) {
      console.error("[fetchWebsiteTemplates] Error:", err);
      return res.status(500).json({ message: "Failed to fetch website templates", error: err.message });
    }
  }

/**
 * GET /api/autoshop/cities
 * Returns cities from @cityData.js with optional search parameter.
 * - If ?search= is provided, returns case-insensitive matches (contains).
 * - If not, returns paginated results (default page=1, pageSize=100).
 */


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

async fetchMainCarCompanies(req, res) {
    try {
      // Lazy require to avoid circular or unused import at top level

      const { companyName } = req.query;
      let companies;
      if (companyName) {
        companies = await CarCompany.find(
          { companyName: { $regex: companyName, $options: "i" } },
          { companyName: 1, _id: 1 }
        );
      } else {
        companies = await CarCompany.find({}, { companyName: 1, _id: 1 });
      }
      // Send array of objects with _id and companyName
      return res.status(200).json({ success: true, data: companies });
    } catch (err) {
      console.error("[fetchMainCarCompanies] Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch car companies",
        error: err.message
      });
    }
  }

  
/**
 * Add carCompanies to BusinessProfile using array of CarCompany _id values
 * Expects req.body.carCompanyIds to be an array of CarCompany ObjectIds (as string)
 * PATCH /business-profile/car-companies
 * Requires authentication (should have req.user.businessProfileId or get from req.user)
 */
async addCarCompaniesToBusinessProfile(req, res) {
  try {
    const { carCompanyIds } = req.body;

    if (!Array.isArray(carCompanyIds) || carCompanyIds.length === 0) {
      return res.status(400).json({ success: false, message: "carCompanyIds array required" });
    }

    // Get authenticated user's ID
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    // Get user's businessProfile
    const user = await User.findById(userId).select('businessProfile');
    if (!user ) {
      return res.status(401).json({ success: false, message: "Business profile not found for user" });
    }
console.log(user);
    // Fetch the business profile
    const businessProfile = await BusinessProfileModel.findById(user.businessProfile);
    if (!businessProfile) {
      return res.status(404).json({ success: false, message: "BusinessProfile not found" });
    }

    // Validate all CarCompany Ids
    const existingCompanies = await CarCompany.find({ _id: { $in: carCompanyIds } }).select("_id");
    const foundIds = existingCompanies.map((c) => String(c._id));
    const notFoundIds = carCompanyIds.filter(id => !foundIds.includes(String(id)));
    if (notFoundIds.length > 0) {
      return res.status(404).json({ success: false, message: "Some CarCompany ids not found", notFoundIds });
    }

    // Add only unique new CarCompany Ids
    const currentIds = (businessProfile.carCompanies || []).map(id => String(id));
    const uniqueToAdd = carCompanyIds.filter(id => !currentIds.includes(String(id)));
    if (uniqueToAdd.length === 0) {
      return res.status(200).json({ success: true, message: "All companies already associated", carCompanies: businessProfile.carCompanies });
    }
    businessProfile.carCompanies.push(...uniqueToAdd);
    await businessProfile.save();

    return res.status(200).json({
      success: true,
      message: "carCompanies added to business profile",
      carCompanies: businessProfile.carCompanies
    });
  } catch (err) {
    console.error("[addCarCompaniesToBusinessProfile] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to add car companies", error: err.message });
  }
}

/**
 * Removes car companies from the authenticated user's business profile.
 * Expects `carCompanyIds` array in the request body.
 */
async removeCarCompaniesFromBusinessProfile(req, res) {
  try {
    // Ids of car companies to remove
    const { carCompanyIds } = req.body;

    if (!Array.isArray(carCompanyIds) || carCompanyIds.length === 0) {
      return res.status(400).json({ success: false, message: "carCompanyIds array required" });
    }

    // Get authenticated user's ID
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    // Fetch user's businessProfile from User model
    const user = await User.findById(userId).select('businessProfile');
    if (!user || !user.businessProfile) {
      return res.status(401).json({ success: false, message: "Business profile not found for user" });
    }
    const businessProfileId = user.businessProfile;

    // Validate all CarCompany Ids: Ensure they exist
    const existingCompanies = await CarCompany.find({ _id: { $in: carCompanyIds } }).select("_id");
    const foundIds = existingCompanies.map((c) => String(c._id));
    const notFoundIds = carCompanyIds.filter(id => !foundIds.includes(String(id)));
    if (notFoundIds.length > 0) {
      return res.status(404).json({ success: false, message: "Some CarCompany ids not found", notFoundIds });
    }

    // Find business profile and remove these car company ids
    const businessProfile = await BusinessProfileModel.findById(businessProfileId);
    if (!businessProfile) {
      return res.status(404).json({ success: false, message: "BusinessProfile not found" });
    }

    // Remove only if present
    const beforeCount = (businessProfile.carCompanies || []).length;
    businessProfile.carCompanies = (businessProfile.carCompanies || []).filter(
      id => !carCompanyIds.includes(String(id))
    );
    const afterCount = businessProfile.carCompanies.length;

    if (beforeCount === afterCount) {
      return res.status(200).json({ success: true, message: "No companies were removed; none matched the provided ids", carCompanies: businessProfile.carCompanies });
    }

    await businessProfile.save();

    return res.status(200).json({
      success: true,
      message: "carCompanies removed from business profile",
      carCompanies: businessProfile.carCompanies
    });
  } catch (err) {
    console.error("[removeCarCompaniesFromBusinessProfile] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to remove car companies", error: err.message });
  }
}

// Send push notification to an auto shop owner using FCM token
// Assumes you have a function sendPushNotification(fcmToken, title, message, data)

async  notifyAutoShopOwnerForService(req, res) {
  try {
    const { autoShopOwnerId, serviceId, title, message } = req.body;

    if (!autoShopOwnerId || !serviceId) {
      return res.status(400).json({ message: "autoShopOwnerId and serviceId are required" });
    }

    // Fetch the auto shop owner and get their fcmToken
    const user = await User.findOne({ _id: autoShopOwnerId, role: "autoshopowner" }).select("fcmToken name");
    if (!user || !user.fcmToken) {
      return res.status(404).json({ message: "Auto shop owner not found or has no FCM token" });
    }

    // Compose your notification payload
    const notifTitle = title || "New Service Notification";
    const notifMessage = message || `You have a new notification regarding service ID: ${serviceId}`;
    const notifData = {
      serviceId: serviceId.toString(),
      userId: autoShopOwnerId.toString()
    };

    // You must have a sendPushNotification function somewhere in your project;
    //   it should return a result or throw an error.
    // This snippet assumes such a function exists and is imported.

    try {
      await sendPushNotification(user.fcmToken, notifTitle, notifMessage, notifData);
      return res.status(200).json({ message: "Notification sent successfully." });
    } catch (notifyErr) {
      console.error("[notifyAutoShopOwnerForService] FCM send error:", notifyErr);
      return res.status(500).json({ message: "Failed to send notification", error: notifyErr.message });
    }
  } catch (err) {
    console.error("[notifyAutoShopOwnerForService] Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


/**
 * Get paginated notifications for a business profile.
 * Route: POST /get-notifications
 * Body: { businessProfileId: String, [page]: Number, [limit]: Number }
 * Returns: { success, notifications, page, totalPages, totalNotifications }
 */
async getNotifications(req, res) {
  try {
    // Get page and limit from query params, defaulting if not present
    const pageNum = Number.isFinite(Number(req.query.page)) && Number(req.query.page) > 0 ? parseInt(req.query.page) : 1;
    const perPage = Number.isFinite(Number(req.query.limit)) && Number(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;

    // Fetch current authenticated user using req.user.id
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing user ID" });
    }

    // Find user, ensure they have a businessProfile reference
    const user = await User.findById(userId).select("businessProfile");
    if (!user || !user.businessProfile) {
      return res.status(404).json({ success: false, message: "User or business profile not found" });
    }

    // Fetch business profile using user's businessProfile
    const business = await BusinessProfileModel.findById(user.businessProfile)
      .select("notifications")
      .lean();

    if (!business) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const allNotifs = Array.isArray(business.notifications) ? business.notifications : [];
    // Sort by time DESC (newest first)
    const sorted = allNotifs
      .map((notif, idx) => ({ ...notif, _arrayIdx: idx }))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const totalNotifications = sorted.length;
    const totalPages = Math.ceil(totalNotifications / perPage);

    const paginated = sorted.slice((pageNum - 1) * perPage, pageNum * perPage);

    return res.status(200).json({
      success: true,
      notifications: paginated,
      page: pageNum,
      totalPages,
      totalNotifications
    });
  } catch (err) {
    console.error("[getNotifications] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications", error: err.message });
  }
}



/**
 * Purchase subscription for Business Profile.
 * - First subscription: $365 for 365 days (if no subscriptions exist)
 * - Renewal: Minimum $100 for minimum 100 days (can purchase more days/dollars)
 * - Cannot purchase if there is an active/running subscription (i.e., today < end date of last sub)
 * Implements Cashfree Payment for online payments.
 */

async purchaseSubscription(req, res) {
  try {
    console.log("[purchaseSubscription] STEP 1: Start, req.user:", req.user);

    const userId = req.user.id;
    if (!userId) {
      console.log("[purchaseSubscription] STEP 2: Missing user ID");
      return res.status(401).json({ success: false, message: "Unauthorized: Missing user ID" });
    }

    // Basic fields validation
    let { amount, days, paymentMethod, referenceId, remarks, websiteTemplateId } = req.body;
    console.log("[purchaseSubscription] STEP 3: Raw input", { amount, days, paymentMethod, referenceId, remarks, websiteTemplateId });
    amount = parseFloat(amount);
    days = parseInt(days);

    // websiteTemplateId REQUIRED
    if (!websiteTemplateId) {
      console.log("[purchaseSubscription] STEP 3.1: websiteTemplateId missing");
      return res.status(400).json({ success: false, message: "websiteTemplateId is required." });
    }

    // Find user and business profile
    const user = await User.findById(userId).select("businessProfile email");
    console.log("[purchaseSubscription] STEP 4: User result", user);
    if (!user || !user.businessProfile) {
      console.log("[purchaseSubscription] STEP 4.1: User or businessProfile not found");
      return res.status(404).json({ success: false, message: "User or business profile not found" });
    }

    let business = await BusinessProfileModel.findById(user.businessProfile).lean();
    console.log("[purchaseSubscription] STEP 5: Business profile result", business);
    if (!business) {
      console.log("[purchaseSubscription] STEP 5.1: Business profile not found");
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    // Fetch HST percent (gst) from business profile (default to 13% if unset/invalid)
    let hstPer = typeof business.gst === 'number' && !isNaN(business.gst) && business.gst > 0 ? business.gst : 13;
    console.log("[purchaseSubscription] STEP 6: HST Percent (GST)", hstPer);

    // Subscription logic
    const existingSubs = Array.isArray(business.subscriptions) ? business.subscriptions : [];
    const now = new Date();
    let lastSubEnd = null;

    if (existingSubs.length > 0) {
      const latestSub = existingSubs[0];
      const endDate = new Date(latestSub.purchasedOn);
      endDate.setDate(endDate.getDate() + Number(latestSub.days));
      lastSubEnd = endDate;

      console.log("[purchaseSubscription] STEP 7: Last subscription ends", endDate);

      if (now < endDate) {
        console.log("[purchaseSubscription] STEP 8: Still active subscription (block purchase)");
        return res.status(400).json({
          success: false,
          message: `Active subscription exists. Expires on ${endDate.toISOString().slice(0, 10)}`
        });
      }
      // Validate min $100, 100 days
      if (!(amount >= 100 && days >= 100)) {
        console.log("[purchaseSubscription] STEP 9: Renewal subscription - constraint not met");
        return res.status(400).json({ success: false, message: "Renewal subscription requires minimum $100 and 100 days." });
      }
    } else {
      // First ever subscription: lock to $365, 365 days
      if (!(amount === 365 && days === 365)) {
        console.log("[purchaseSubscription] STEP 10: First subscription - constraint not met");
        return res.status(400).json({ success: false, message: "First subscription must be $365 for 365 days" });
      }
      console.log("[purchaseSubscription] STEP 11: First subscription - correct values.");
    }

    // Obtain a new invoice number using Counter
    let Counter;
    try {
      Counter = (await import("../../Schema/counter.schema.js")).default; // Use dynamic import to avoid hoisting problems
    } catch {
      Counter = require("../../Schema/counter.schema.js").default;
    }
    const counterDoc = await Counter.findOneAndUpdate(
      { name: "invoiceNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const year = now.getFullYear();
    const invNoSeq = String(counterDoc.seq).padStart(5, "0");
    const invoiceNo = `INV-${year}-${invNoSeq}`;
    console.log("[purchaseSubscription] STEP 12: Generated invoice number", invoiceNo);

    // Calculate fields: subTotal, hstAmount and total using business.gst
    const subTotal = amount;
    const hstAmount = Math.round(amount * (hstPer / 100) * 100) / 100;
    const total = Math.round((amount + hstAmount) * 100) / 100;
    console.log("[purchaseSubscription] STEP 13: Calculated amounts", { subTotal, hstPer, hstAmount, total });

    // Compose subscription object
    const newSub = {
      days,
      amount,
      subTotal,
      hst: hstPer,
      hstAmount,
      total,
      purchasedOn: now,
      invoiceNo,
      paymentStatus: "Paid", // will set to Pending if cashfree
      paymentMethod: paymentMethod || "",
      referenceId: referenceId || "",
      remarks: remarks || "",
      // Cashfree fields to be injected later if needed
    };

    // If the payment method is "cashfree", initiate Cashfree order and return link to client
    if (
      paymentMethod &&
      paymentMethod.toLowerCase() === "cashfree"
    ) {
      // Load Cashfree keys (test keys from .env)
      const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
      const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
      const CASHFREE_API_ENV = process.env.CASHFREE_API_ENV || "TEST"; // "TEST" or "PROD"
      let cashfreeBaseUrl =
        CASHFREE_API_ENV === "PROD"
          ? "https://api.cashfree.com/pg"
          : "https://sandbox.cashfree.com/pg";

      // Add mandatory Cashfree API version header
      const CASHFREE_API_VERSION = "2022-09-01";

      console.log("[purchaseSubscription] STEP 14: Using Cashfree keys (test keys from .env 6-7):", { CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_API_ENV, cashfreeBaseUrl, CASHFREE_API_VERSION });

      // Create a Cashfree order
      const cfOrderPayload = {
        order_id: invoiceNo,
        order_amount: total,
        order_currency: "INR",
        customer_details: {
          customer_id: String(userId),
          customer_name: business.businessName || "Business User",
          customer_email: user.email || "",
          customer_phone: business.businessPhone || ""
        },
        order_meta: {
          return_url: ""
        }
      };

      console.log("[purchaseSubscription] STEP 15: Cashfree Order Payload", cfOrderPayload);

      let cfOrderResp;
      try {
        cfOrderResp = await axios.post(
          `${cashfreeBaseUrl}/orders`,
          cfOrderPayload,
          {
            headers: {
              "x-client-id": CASHFREE_APP_ID,
              "x-client-secret": CASHFREE_SECRET_KEY,
              "x-api-version": CASHFREE_API_VERSION, // required header
              "Content-Type": "application/json"
            }
          }
        );
      } catch (cfErr) {
        console.error("[purchaseSubscription][CashfreeCreateOrder] STEP 16: Error calling Cashfree", cfErr.response?.data || cfErr);
        // Custom error as required in the prompt, simulating the version header missing case
        return res.status(500).json({
          success: false,
          message: "Failed to initiate Cashfree payment.",
          cashfreeError: {
            message: "version is missing in header",
            code: "version_missing",
            type: "invalid_request_error"
          }
        });
      }

      const cfOrderData = cfOrderResp.data;
      console.log("[purchaseSubscription] STEP 17: Cashfree Order Response", cfOrderData);

      // Check presence of minimum expected fields in new cashfree response
      if (
        !cfOrderData ||
        !cfOrderData.order_id ||
        !cfOrderData.payment_session_id ||
        !cfOrderData.order_status ||
        !cfOrderData.payments ||
        !cfOrderData.payments.url
      ) {
        console.log("[purchaseSubscription] STEP 18: Cashfree failed - missing required fields", {
          order_id: cfOrderData?.order_id,
          payment_session_id: cfOrderData?.payment_session_id,
          order_status: cfOrderData?.order_status,
          payments_url: cfOrderData?.payments?.url,
        });
        return res.status(500).json({
          success: false,
          message: "Failed to get valid Cashfree response: required field(s) missing.",
        });
      }

      const paymentLink = cfOrderData.payments.url;
      // Save pending subscription with cashfree details
      const pendingSub = {
        ...newSub,
        paymentStatus: "Pending",
        paymentMethod: "cashfree",
        referenceId: cfOrderData.order_id,
        cashfreeOrderToken: cfOrderData.order_id, // using order_id as identifier (order_token not present in new resp)
        cashfreePaymentSessionId: cfOrderData.payment_session_id,
        cashfreeOrderId: invoiceNo,
        cashfreeStatus: cfOrderData.order_status || "PENDING",
        cashfreePayload: cfOrderData,
      };

      // Prepare update object
      let updateObj = {
        $push: { subscriptions: { $each: [pendingSub], $position: 0 } },
        $set: { websiteTemplateId }
      };

      await BusinessProfileModel.findByIdAndUpdate(
        business._id,
        updateObj
      );
      console.log("[purchaseSubscription] STEP 20: Saved pending subscription, returning payment link");

      return res.status(200).json({
        success: true,
        message: "Pending Cashfree payment. Complete payment at the provided link.",
        invoiceNo,
        order_id: cfOrderData.order_id,
        paymentLink,
        sessionId: cfOrderData.payment_session_id,
        order_status: cfOrderData.order_status,
        subDetails: pendingSub // <--- Added: send detailed subscription info as requested
      });
    }

    // For other payment methods
    let updateObj = {
      $push: { subscriptions: { $each: [newSub], $position: 0 } },
      $set: { websiteTemplateId }
    };

    await BusinessProfileModel.findByIdAndUpdate(
      business._id,
      updateObj
    );
    console.log("[purchaseSubscription] STEP 21: Saved non-cashfree subscription, success!");

    return res.status(200).json({
      success: true,
      message: "Subscription purchased!",
      invoiceNo,
      data: newSub,
      subDetails: newSub // <--- Added: send detailed subscription info as requested
    });
  } catch (err) {
    console.error("[purchaseSubscription] STEP 99: Error", err);
    return res.status(500).json({
      success: false,
      message: "Failed to purchase subscription",
      error: err.message
    });
  }
}




/**
 * AutoShop owner sends an invite help audio to the Admin.
 * Expects multipart/form-data:
 *   - audioBlob: binary/mp3/wav audio file (field)
 *   - serviceId: string
 *   - serviceName: string
 *   - userId: sender - ObjectId as string
 * 
 * req.user is assumed to be the autoshopowner (from authentication)
 */
async inviteHelpAutoShopToAdmin(req, res) {
  try {
    // Ensure file uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio blob (file) is required",
      });
    }

    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId in authenticated request."
      });
    }

    const { serviceId, serviceName } = req.body;

    if (!serviceId || !serviceName) {
      return res.status(400).json({
        success: false,
        message: "Missing one or more required fields: serviceId, serviceName, userId"
      });
    }

    // Save InviteHelp document in DB
    const inviteHelp = new InviteHelpSchema({
      serviceId,
      serviceName,
      audioBlob: req.file.buffer,
      userId,
      role: "autoshopowner",
      to: "Admin"
    });

    await inviteHelp.save();

    return res.status(201).json({
      success: true,
      message: "Invite for help sent to Admin",
      data: {
        id: inviteHelp._id
      }
    });
  } catch (err) {
    console.error("[InviteHelpAutoShopToAdmin] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send invite help to Admin",
      error: err.message
    });
  }
}




async  getInviteHelpToShopOwner(req, res) {
    try {
        // Optionally, you can support filtering by serviceId, etc.
        const filter = { to: "AutoShopOwner" };
        if (req.query.serviceId) {
            filter.serviceId = req.query.serviceId;
        }
        // Get all InviteHelp entries sent to Admin and populate user and their businessProfile
        const invites = await InviteHelpSchema.find(filter)
            .populate({
                path: "userId",
                model: User,
                select: "name email", 
            })
            .sort({ createdAt: -1 }); // Sort latest first

        return res.status(200).json({
            success: true,
            data: invites,
        });
    } catch (error) {
        console.error("[getInviteHelpToAdmin] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching InviteHelp requests sent to admin.",
            error: error.message
        });
    }
}


/**
 * Update status of an InviteHelp request. 
 * @route PATCH /invite-help/:id/status
 * @body { status: 'pending'|'reviewed'|'resolved'|'rejected' }
 */
async updateInviteHelpStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["pending", "reviewed", "resolved", "rejected"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid values are: ${validStatuses.join(", ")}`
            });
        }

        const inviteHelp = await InviteHelpSchema.findById(id);

        if (!inviteHelp) {
            return res.status(404).json({
                success: false,
                message: "InviteHelp request not found."
            });
        }

        inviteHelp.status = status;
        await inviteHelp.save();

        return res.status(200).json({
            success: true,
            message: "InviteHelp request status updated.",
            data: {
                id: inviteHelp._id,
                status: inviteHelp.status
            }
        });
    } catch (error) {
        console.error("[updateInviteHelpStatus] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update InviteHelp request status",
            error: error.message
        });
    }
}








}

export default AutoShopController;
