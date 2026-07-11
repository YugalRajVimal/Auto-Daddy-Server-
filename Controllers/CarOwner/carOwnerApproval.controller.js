import mongoose from "mongoose";
import { User } from "../../Schema/user.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import JobCard from "../../Schema/jobCard.schema.js";

function requireCarowner(req, res) {
  if (req.user.role !== "carowner") {
    res.status(403).json({ success: false, message: "Only carowners can access this" });
    return false;
  }
  return true;
}

/* =========================================================
   CUSTOMER ADD-REQUEST APPROVALS
   (shop owner's "AddToMyCustomers" -> customer approves/rejects here)
   ========================================================= */

/**
 * List all shops that have requested to add this carowner as a customer,
 * still pending. Uses positional $ projection so only the matching
 * myCustomers subdoc comes back, not the whole array.
 */
export const getPendingCustomerAddRequests = async (req, res) => {
  try {
    // Fetch the real User document using req.user.id
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!requireCarowner(req, res)) return;

    // Use currentUser._id (the ObjectId from User collection) to fetch business profiles
    const businesses = await BusinessProfileModel.find(
      { myCustomers: { $elemMatch: { _id: currentUser._id, status: "pending" } } },
      { businessName: true, businessLogo: true, city: true, "myCustomers.$": true }
    );

    const data = businesses.map((b) => ({
      businessId: b._id,
      businessName: b.businessName,
      businessLogo: b.businessLogo,
      city: b.city,
      addedAt: b.myCustomers[0].addedAt,
      pendingEdit: b.myCustomers[0].pendingEdit,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending customer add requests",
      error: error.message,
    });
  }
};

// /**
//  * Approve a shop's add request.
//  * 1. status -> "approved"
//  * 2. if pendingEdit is set, those fields are written to the real User doc,
//  *    then pendingEdit is cleared.
//  */
// export const approveCustomerAddRequest = async (req, res) => {
//   try {
//     // Fetch the real User document using req.user.id
//     const currentUser = await User.findById(req.user.id);
//     if (!currentUser) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     if (!requireCarowner(req, res)) return;

//     const { businessId } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(businessId)) {
//       return res.status(400).json({ success: false, message: "Invalid businessId" });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     // Use currentUser._id (the ObjectId from User collection) to find customer entry
//     const entry = business.myCustomers.id(currentUser._id);
//     if (!entry) {
//       return res.status(404).json({ success: false, message: "No add request from this shop" });
//     }
//     if (entry.status !== "pending") {
//       return res.status(409).json({
//         success: false,
//         message: `This request is already ${entry.status}`,
//       });
//     }

//     if (entry.pendingEdit && (entry.pendingEdit.name || entry.pendingEdit.email || entry.pendingEdit.city)) {
//       const update = {};
//       if (entry.pendingEdit.name !== undefined) update.name = entry.pendingEdit.name;
//       if (entry.pendingEdit.email !== undefined) update.email = entry.pendingEdit.email;
//       if (entry.pendingEdit.city !== undefined) update.city = entry.pendingEdit.city;

//       await User.findByIdAndUpdate(currentUser._id, { $set: update });

//       // keep the snapshot on the business side in sync too
//       if (update.name !== undefined) entry.name = update.name;
//       if (update.email !== undefined) entry.email = update.email;
//       if (update.city !== undefined) entry.city = update.city;
//     }

//     entry.status = "approved";
//     entry.pendingEdit = undefined;

//     await business.save();

//     return res.status(200).json({
//       success: true,
//       message: "Customer add request approved",
//       data: entry,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to approve customer add request",
//       error: error.message,
//     });
//   }
// };

// /**
//  * Reject a shop's add request — the entry is removed entirely rather than
//  * kept around in a "rejected" state, since the shop can simply re-send
//  * the add request later if needed.
//  */
// export const rejectCustomerAddRequest = async (req, res) => {
//   try {
//     // Fetch the real User document using req.user.id
//     const currentUser = await User.findById(req.user.id);
//     if (!currentUser) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     if (!requireCarowner(req, res)) return;

//     const { businessId } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(businessId)) {
//       return res.status(400).json({ success: false, message: "Invalid businessId" });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     // Use currentUser._id (the ObjectId from User collection) to find customer entry
//     const entry = business.myCustomers.id(currentUser._id);
//     if (!entry) {
//       return res.status(404).json({ success: false, message: "No add request from this shop" });
//     }
//     if (entry.status !== "pending") {
//       return res.status(409).json({
//         success: false,
//         message: `This request is already ${entry.status}`,
//       });
//     }

//     entry.deleteOne();
//     await business.save();

//     return res.status(200).json({ success: true, message: "Customer add request rejected" });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to reject customer add request",
//       error: error.message,
//     });
//   }
// };

/**
 * Public — fetch details of a pending customer add request, so the
 * landing page (sent via SMS) can show shop info before the customer
 * taps Approve/Reject. No auth — businessId + customerId come from the link.
 */
export const getCustomerAddRequestDetails = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { customerId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ success: false, message: "Invalid businessId" });
    }
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing customerId" });
    }

    const business = await BusinessProfileModel.findById(businessId).select(
      "businessName businessAddress city businessPhone businessLogo myCustomers"
    );
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const entry = business.myCustomers.id(customerId);
    if (!entry) {
      return res.status(404).json({ success: false, message: "No add request found for this customer" });
    }

    return res.status(200).json({
      success: true,
      data: {
        business: {
          _id: business._id,
          businessName: business.businessName,
          businessAddress: business.businessAddress,
          city: business.city,
          businessPhone: business.businessPhone,
          businessLogo: business.businessLogo,
        },
        request: {
          status: entry.status,
          name: entry.name,
          email: entry.email,
          city: entry.city,
          pendingEdit: entry.pendingEdit || null,
          addedAt: entry.addedAt,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer add request details",
      error: error.message,
    });
  }
};

/**
 * Approve a shop's add request via a public SMS link.
 * No auth — customerId comes from the link itself.
 * 1. status -> "approved"
 * 2. if pendingEdit is set, those fields are written to the real User doc,
 *    then pendingEdit is cleared.
 */
export const approveCustomerAddRequest = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { customerId } = req.query; // comes from the SMS link

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ success: false, message: "Invalid businessId" });
    }
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing customerId" });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const entry = business.myCustomers.id(customerId);
    if (!entry) {
      return res.status(404).json({ success: false, message: "No add request found for this customer" });
    }
    if (entry.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `This request is already ${entry.status}`,
      });
    }

    if (entry.pendingEdit && (entry.pendingEdit.name || entry.pendingEdit.email || entry.pendingEdit.city)) {
      const update = {};
      if (entry.pendingEdit.name !== undefined) update.name = entry.pendingEdit.name;
      if (entry.pendingEdit.email !== undefined) update.email = entry.pendingEdit.email;
      if (entry.pendingEdit.city !== undefined) update.city = entry.pendingEdit.city;

      await User.findByIdAndUpdate(customerId, { $set: update });

      // keep the snapshot on the business side in sync too
      if (update.name !== undefined) entry.name = update.name;
      if (update.email !== undefined) entry.email = update.email;
      if (update.city !== undefined) entry.city = update.city;
    }

    entry.status = "approved";
    entry.pendingEdit = undefined;

    await business.save();

    return res.status(200).json({
      success: true,
      message: "Customer add request approved",
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve customer add request",
      error: error.message,
    });
  }
};

/**
 * Reject a shop's add request via a public SMS link.
 * No auth — customerId comes from the link itself. Entry is removed
 * entirely rather than kept around in a "rejected" state, since the
 * shop can simply re-send the add request later if needed.
 */
export const rejectCustomerAddRequest = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { customerId } = req.query; // comes from the SMS link

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ success: false, message: "Invalid businessId" });
    }
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing customerId" });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const entry = business.myCustomers.id(customerId);
    if (!entry) {
      return res.status(404).json({ success: false, message: "No add request found for this customer" });
    }
    if (entry.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `This request is already ${entry.status}`,
      });
    }

    entry.deleteOne();
    await business.save();

    return res.status(200).json({ success: true, message: "Customer add request rejected" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject customer add request",
      error: error.message,
    });
  }
};

/* =========================================================
   JOB CARD APPROVALS
   Note: routes use the job card's real _id, NOT jobCardNo —
   jobCardNo is only unique per shop, not globally.
   ========================================================= */

export const getPendingJobCardApprovals = async (req, res) => {
  try {
    // Fetch the real User document using req.user.id (optional for jobcard, keeping logic similar)
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!requireCarowner(req, res)) return;

    const jobCards = await JobCard.find({
      customerId: currentUser._id,
      status: "pending",
      sendForApproval: true,
    })
      .sort({ sendForApprovalAt: -1 })
      .populate("business", "businessName businessLogo businessPhone");

    return res.status(200).json({ success: true, data: jobCards });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending job card approvals",
      error: error.message,
    });
  }
};

export const approveJobCard = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!requireCarowner(req, res)) return;

    const { jobCardId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobCardId)) {
      return res.status(400).json({ success: false, message: "Invalid jobCardId" });
    }

    const jobCard = await JobCard.findOne({ _id: jobCardId, customerId: currentUser._id });
    if (!jobCard) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }
    if (jobCard.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Job card is already ${jobCard.status}`,
      });
    }

    jobCard.approvedByCustomer = true;
    jobCard.approvalTime = new Date();
    // status intentionally stays "pending" — it only moves to
    // convertedToInvoice/CashPaid via the shop's own markStatus action
    await jobCard.save();

    return res.status(200).json({ success: true, message: "Job card approved", data: jobCard });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve job card",
      error: error.message,
    });
  }
};

export const rejectJobCard = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!requireCarowner(req, res)) return;

    const { jobCardId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobCardId)) {
      return res.status(400).json({ success: false, message: "Invalid jobCardId" });
    }

    const jobCard = await JobCard.findOne({ _id: jobCardId, customerId: currentUser._id });
    if (!jobCard) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }
    if (jobCard.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Job card is already ${jobCard.status}`,
      });
    }

    jobCard.approvedByCustomer = false;
    jobCard.rejectedAt = new Date();
    jobCard.status = "rejected";
    await jobCard.save();

    return res.status(200).json({ success: true, message: "Job card rejected", data: jobCard });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject job card",
      error: error.message,
    });
  }
};