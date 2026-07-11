import JobCard from "../../Schema/jobCard.schema.js";
import { User } from "../../Schema/user.schema.js";

/**
 * JobCardController
 * Handles: fetching, approving, rejecting job cards for the car owner (customer)
 */
class JobCardController {

    // Fetch all job cards for this car owner (customer)
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
            const businessPopulate = {
                path: 'business',
                select: 'businessName businessType address businessPhone businessEmail city'
            };
            const servicesPopulate = {
                path: 'services.service',
                select: 'name desc category'
            };

            // 7. Map status keys (new schema: 'pending', 'rejected', 'autoRejected', 'convertedToInvoice', 'CashPaid')
            // Presentation (to user) can upper/lowercase, but fetches must use correct case
            // We'll output 'pending', 'approved', 'rejected', 'autoRejected' for the frontend grouping,
            // where 'approved' means status 'convertedToInvoice' or 'CashPaid'
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

            // 9. Return grouped cards
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

export default JobCardController;
