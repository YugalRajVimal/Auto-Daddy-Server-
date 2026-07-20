
import Lead from "../../Schema/leads.schema.js";
import fs from "fs";
import { StaffUser } from "../../Schema/RolesAndPermissions/Staffuser.schema.js";
import mongoose from "mongoose"; // For ObjectId conversion/validation

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_FIELDS = [
  "date",
  "name",
  "phone",
  "city",
  "email",
  "website",
  "notes",
  "sentTo",
  "status",
];

function pickAllowedFields(body) {
  const result = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
}

function isValidDate(value) {
  return !isNaN(new Date(value).getTime());
}

// Normalize a disk path (e.g. "Uploads/Leads/123-file.jpg") into a URL
// path the frontend can hit directly, e.g. "/Uploads/Leads/123-file.jpg".
function toPublicPath(filePath) {
  if (!filePath) return null;
  return "/" + filePath.replace(/^\.?\/?/, "");
}

function safeUnlink(publicPath) {
  if (!publicPath) return;
  const diskPath = "." + publicPath; // reverse of toPublicPath
  fs.unlink(diskPath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("[leads] Failed to remove old image:", err.message);
    }
  });
}

/**
 * Fetch all staff users with the "associates" role.
 * Returns a list of associates for assignment/autocomplete, etc.
 * @route GET /admin/leads/associates
 */
export const getAssociatesStaffUser = async (req, res) => {
  try {
    // Find all active staff with role "associates"
    const associates = await StaffUser.find(
      { role: "associates", isActive: true },
      { _id: 1, name: 1, email: 1, phone: 1 }
    ).lean();

    return res.status(200).json({ success: true, data: associates });
  } catch (err) {
    console.error("[getAssociatesStaffUser] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch associate staff users",
      error: err.message,
    });
  }
};

/**
 * Create a new lead
 * @route POST /admin/leads
 */
export const createLead = async (req, res) => {
  try {
    const { date, name, phone, city, email, website, notes, sentTo, status } =
      pickAllowedFields(req.body);

    if (!date || !name || !phone || !city) {
      return res.status(400).json({
        success: false,
        message: "date, name, phone, and city are required.",
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    let validEmail = null;
    if (email && email.trim()) {
      if (!EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ success: false, message: "Invalid email address." });
      }
      validEmail = email.trim().toLowerCase();
    }

    let associateObjectId = null;
    if (sentTo !== undefined && sentTo !== null && sentTo !== "") {
      // Validate sentTo as ObjectId and check existence in StaffUser (associates)
      if (!mongoose.Types.ObjectId.isValid(sentTo)) {
        return res.status(400).json({ success: false, message: "Invalid associate staff user id for 'sentTo'." });
      }
      const associate = await StaffUser.findOne({ _id: sentTo, role: "associates", isActive: true });
      if (!associate) {
        return res.status(400).json({ success: false, message: "Associate staff user for 'sentTo' not found." });
      }
      associateObjectId = new mongoose.Types.ObjectId(sentTo);
    }

    const leadData = {
      date: new Date(date),
      name: name.trim(),
      phone: phone.trim(),
      city: city.trim(),
    };

    if (validEmail) leadData.email = validEmail;
    if (website) leadData.website = website.trim();
    if (notes) leadData.notes = notes.trim();
    if (associateObjectId) leadData.sentTo = associateObjectId;
    if (status) leadData.status = status.trim();
    if (req.file) leadData.image = toPublicPath(req.file.path);

    const newLead = new Lead(leadData);
    await newLead.save();

    // Populate sentTo with name on response if present
    let responseLead = newLead;
    if (responseLead.sentTo) {
      responseLead = await responseLead.populate({ path: "sentTo", select: "name" });
    }

    return res.status(201).json({ success: true, data: responseLead });
  } catch (err) {
    console.error("[createLead] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to create lead", error: err.message });
  }
};

/**
 * Get all leads, with optional filters
 * @route GET /admin/leads?status=Pending&city=Delhi&email=john&search=John
 */
export const getLeads = async (req, res) => {
  try {
    const { status, city, email, sentTo, search } = req.query;
    const filter = {};

    // Determine the role and user id from req.user
    const user = req.user; // Assume this is set by auth middleware
    const role = user?.role;
    const userId = user?.id;

    // Build filters as per query params
    if (status) filter.status = status;
    if (city) filter.city = { $regex: city, $options: "i" };
    if (email) filter.email = { $regex: email, $options: "i" };

    // Admin: see all, StaffUser: only assigned
    if (role !== "admin") {
      // Only show leads where sentTo is this staff user
      filter.sentTo = userId;
    } else if (sentTo && mongoose.Types.ObjectId.isValid(sentTo)) {
      // Admin can filter by sentTo param
      filter.sentTo = new mongoose.Types.ObjectId(sentTo);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Populate sentTo with associate's name field
    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: "sentTo", select: "name" });

    return res.status(200).json({ success: true, data: leads });
  } catch (err) {
    console.error("[getLeads] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch leads", error: err.message });
  }
};

/**
 * Get single lead by ID
 * @route GET /admin/leads/:id
 */
export const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate({ path: "sentTo", select: "name" });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }
    return res.status(200).json({ success: true, data: lead });
  } catch (err) {
    console.error("[getLeadById] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch lead", error: err.message });
  }
};

/**
 * Edit a lead
 * @route PATCH /admin/leads/:id
 */
export const editLead = async (req, res) => {
  try {
    const updateData = pickAllowedFields(req.body);

    // "removeImage" is a plain form field (not in ALLOWED_FIELDS on purpose,
    // since it's an action flag, not a persisted field name)
    const shouldRemoveImage = req.body.removeImage === "true" || req.body.removeImage === true;

    if (Object.keys(updateData).length === 0 && !req.file && !shouldRemoveImage) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    if (updateData.date) {
      if (!isValidDate(updateData.date)) {
        return res.status(400).json({ success: false, message: "Invalid date." });
      }
      updateData.date = new Date(updateData.date);
    }

    if (updateData.email) {
      const trimmedEmail = updateData.email.trim().toLowerCase();
      if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email address." });
      }
      updateData.email = trimmedEmail;
    }

    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.phone) updateData.phone = updateData.phone.trim();
    if (updateData.city) updateData.city = updateData.city.trim();
    if (updateData.website) updateData.website = updateData.website.trim();
    if (updateData.notes) updateData.notes = updateData.notes.trim();

    // Check sentTo validity and existence if provided
    if (updateData.sentTo !== undefined && updateData.sentTo !== null && updateData.sentTo !== "") {
      if (!mongoose.Types.ObjectId.isValid(updateData.sentTo)) {
        return res.status(400).json({ success: false, message: "Invalid associate staff user id for 'sentTo'." });
      }
      const associate = await StaffUser.findOne({ _id: updateData.sentTo, role: "associates", isActive: true });
      if (!associate) {
        return res.status(400).json({ success: false, message: "Associate staff user for 'sentTo' not found." });
      }
      updateData.sentTo = new mongoose.Types.ObjectId(updateData.sentTo);
    }

    if (updateData.status) updateData.status = updateData.status.trim();

    const existingLead = await Lead.findById(req.params.id);
    if (!existingLead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    if (req.file) {
      // New image uploaded — remove the old one from disk, if any.
      safeUnlink(existingLead.image);
      updateData.image = toPublicPath(req.file.path);
    } else if (shouldRemoveImage) {
      safeUnlink(existingLead.image);
      updateData.image = null;
    }

    let lead = await Lead.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    // Populate sentTo with associate's name on the response
    if (lead && lead.sentTo) {
      lead = await lead.populate({ path: "sentTo", select: "name" });
    }

    return res.status(200).json({ success: true, data: lead });
  } catch (err) {
    console.error("[editLead] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to edit lead", error: err.message });
  }
};

/**
 * Delete a lead
 * @route DELETE /admin/leads/:id
 */
export const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }
    safeUnlink(lead.image);
    return res.status(200).json({ success: true, message: "Lead deleted successfully." });
  } catch (err) {
    console.error("[deleteLead] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete lead", error: err.message });
  }
};