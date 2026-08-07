import JobCard from "../../Schema/jobCard.schema.js";
import { getJobCardPrefixForYear } from "../../Schema/Jobcardprefix.schema.js";
import { User } from "../../Schema/user.schema.js";

/**
 * JobCardController
 * Handles: fetching, approving, rejecting job cards for the car owner (customer)
 */
class JobCardController {

    // Fetch all job cards for this car owner (customer)
    // import { getJobCardPrefixForYear } from "../../Schema/Jobcardprefix.schema.js";

    getAllJobCards = async (req, res) => {
        try {
            // 1. Authenticate user
            const userId = req.user && req.user.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            // 2. Confirm that the user exists
            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            // 3. Optional vehicle filter
            const { vehicleId } = req.query;

            // 4. Build baseFilter according to new schema
            // Only fetch job cards where *this user* is the customer (registered users only)
            let baseFilter = { customerType: 'registered', customerId: userId };
            if (vehicleId && typeof vehicleId === "string" && vehicleId.trim().length > 0) {
                baseFilter.vehicleId = vehicleId.trim();
            }

            // 5. Auto-reject old 'pending' job cards (per new schema: status is 'pending', not 'Pending')
            const now = Date.now();
            const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
            await JobCard.updateMany(
                {
                    ...baseFilter,
                    status: "pending",
                    createdAt: { $lt: twoHoursAgo }
                },
                { $set: { status: "autoRejected" } }
            );

            // 6. Prepare population as per jobCard.schema.js (184-262)
            const vehiclePopulate = {
                path: 'vehicleId',
                select: 'make model licensePlateNo carImages carOwnershipCertificate insuranceCertificate'
            };
            // Updated to include businessHSTNumber and gst in the select
            const businessPopulate = {
                path: 'business',
                select: 'businessName businessType address businessPhone businessEmail city businessHSTNumber gst'
            };
            const servicesPopulate = {
                path: 'services.service',
                select: 'name desc category'
            };

            // 7. Map status keys (new schema: 'pending', 'rejected', 'autoRejected', 'convertedToInvoice', 'CashPaid')
            const rawStatusGroups = {
                pending: ['pending'],
                approved: ['convertedToInvoice', 'CashPaid'],
                rejected: ['rejected'],
                autoRejected: ['autoRejected']
            };

            // 8. Query all status groups
            const groupJobCardPromises = Object.entries(rawStatusGroups).map(async ([group, statuses]) => {
                const cards = await JobCard.find({
                        ...baseFilter,
                        status: { $in: statuses }
                    })
                    .populate(businessPopulate)
                    .populate(vehiclePopulate)
                    .populate(servicesPopulate)
                    .sort({ createdAt: -1 })
                    .lean();

                // Post-process cards to make sure 'services' subdocs have service info collapsed as needed
                for (const card of cards) {
                    // Send job card prefix and number:
                    // Try to extract business and createdAt's year
                    let jobCardPrefix = null;
                    if (card.business && card.createdAt) {
                        try {
                            // card.business can be object or ObjectId - handle both
                            const businessId = card.business._id ? card.business._id : card.business;
                            const year = new Date(card.createdAt).getFullYear();
                            const prefixDoc = await getJobCardPrefixForYear(businessId, year);
                            jobCardPrefix = prefixDoc && prefixDoc.prefix ? prefixDoc.prefix : null;
                        } catch (err) {
                            jobCardPrefix = null;
                        }
                    }
                    card.jobCardPrefix = jobCardPrefix;
                    // Always send jobCardNumber (this field assumed to exist as per your schema, adjust if named differently)
                    card.jobCardNumber = card.jobCardNumber || card.jobCardNo || card.number || null;



                    if (Array.isArray(card.services)) {
                        card.services = card.services.map(serviceObj => ({
                            ...serviceObj,
                            // .service may be null (custom line, no link), or be the populated doc
                            service: serviceObj.service && typeof serviceObj.service === 'object'
                                ? {
                                    _id: serviceObj.service._id,
                                    name: serviceObj.service.name,
                                    desc: serviceObj.service.desc,
                                    category: serviceObj.service.category
                                }
                                : null
                        }));
                    }
                }
                return [group, cards];
            });

            const groupJobCardsEntries = await Promise.all(groupJobCardPromises);
            const grouped = Object.fromEntries(groupJobCardsEntries);

            // 9. Return grouped cards (including businessHSTNumber and gst in business object)
            return res.status(200).json({
                success: true,
                data: {
                    pending: grouped.pending || [],
                    approved: grouped.approved || [],
                    rejected: grouped.rejected || [],
                    autoRejected: grouped.autoRejected || []
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

            // Send FCM notification to the shop/business
            try {
                // Fetch the business profile
                const businessProfile = jobCard.businessId
                    ? await BusinessProfileModel.findById(jobCard.businessId).populate("user")
                    : null;

                if (businessProfile && businessProfile.user && businessProfile.user.fcmToken) {
                    // You can format a more detailed notification if needed
                    const { sendPushNotification } = await import("../../config/pushNotification.js");
                    await sendPushNotification(
                        [businessProfile.user.fcmToken],
                        {
                            title: "Job Card Approved",
                            body: `Customer approved Job Card #${jobCard.jobCardNumber || jobCard._id}`,
                            data: {
                                jobCardId: jobCard._id.toString(),
                                status: "Approved"
                            }
                        }
                    );
                }
            } catch (notifyErr) {
                console.error("[approveJobCard] Notification send error:", notifyErr);
                // Optionally, do not fail the main request because of a notification failure
            }

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

            // Send FCM notification to the shop/business
            try {
                // Fetch the business profile
                const businessProfile = jobCard.businessId
                    ? await BusinessProfileModel.findById(jobCard.businessId).populate("user")
                    : null;

                if (businessProfile && businessProfile.user && businessProfile.user.fcmToken) {
                    const { sendPushNotification } = await import("../../config/pushNotification.js");
                    await sendPushNotification(
                        [businessProfile.user.fcmToken],
                        {
                            title: "Job Card Rejected",
                            body: `Customer rejected Job Card #${jobCard.jobCardNumber || jobCard._id}`,
                            data: {
                                jobCardId: jobCard._id.toString(),
                                status: "Rejected"
                            }
                        }
                    );
                }
            } catch (notifyErr) {
                console.error("[rejectJobCard] Notification send error:", notifyErr);
            }

            return res.status(200).json({ success: true, message: "JobCard rejected successfully.", data: jobCard });
        } catch (error) {
            console.error("[rejectJobCard] Error:", error);
            return res.status(500).json({ success: false, message: "Failed to reject JobCard", error: error.message });
        }
    }
}

export default JobCardController;
