import Lead from "../../Schema/leads.schema.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only these fields may ever be written by a client
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

/**
 * Create a new lead
 * @route POST /admin/leads
 */
export const createLead = async (req, res) => {
  try {
    const { date, name, phone, city, email, website, notes, sentTo, status } =
      pickAllowedFields(req.body);

    // Validate required fields
    if (!date || !name || !phone || !city || !email) {
      return res.status(400).json({
        success: false,
        message: "date, name, phone, city and email are required.",
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }

    const leadData = {
      date: new Date(date),
      name: name.trim(),
      phone: phone.trim(),
      city: city.trim(),
      email: email.trim().toLowerCase(),
    };

    if (website) leadData.website = website.trim();
    if (notes) leadData.notes = notes.trim();
    if (sentTo) leadData.sentTo = sentTo.trim();
    if (status) leadData.status = status.trim();

    const newLead = new Lead(leadData);
    await newLead.save();

    return res.status(201).json({ success: true, data: newLead });
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

    if (status) filter.status = status;
    if (city) filter.city = { $regex: city, $options: "i" };
    if (email) filter.email = { $regex: email, $options: "i" };
    if (sentTo) filter.sentTo = { $regex: sentTo, $options: "i" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 });
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
    const lead = await Lead.findById(req.params.id);
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

    if (Object.keys(updateData).length === 0) {
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
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email address." });
      }
      updateData.email = trimmedEmail;
    }

    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.phone) updateData.phone = updateData.phone.trim();
    if (updateData.city) updateData.city = updateData.city.trim();
    if (updateData.website) updateData.website = updateData.website.trim();
    if (updateData.notes) updateData.notes = updateData.notes.trim();
    if (updateData.sentTo) updateData.sentTo = updateData.sentTo.trim();
    if (updateData.status) updateData.status = updateData.status.trim();

    const lead = await Lead.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
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
    return res.status(200).json({ success: true, message: "Lead deleted successfully." });
  } catch (err) {
    console.error("[deleteLead] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete lead", error: err.message });
  }
};