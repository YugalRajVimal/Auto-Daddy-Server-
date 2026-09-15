import ContactMessage from "../../Schema/ContactMessage.schema.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/public/contact  (no auth — called from autodaddy.ca's
 * contact-us.html form)
 * Body: { firstName, lastName, email, subject, message }
 */
export const submitContactMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;

    if (!firstName || !String(firstName).trim()) {
      return res.status(400).json({ success: false, message: "First name is required." });
    }
    if (!email || !EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: "A valid email address is required." });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    const created = await ContactMessage.create({
      firstName: String(firstName).trim(),
      lastName: lastName ? String(lastName).trim() : "",
      email: String(email).trim().toLowerCase(),
      subject: subject ? String(subject).trim() : "",
      message: String(message).trim(),
      sourceIp: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
    });

    return res.status(201).json({
      success: true,
      message: "Thanks for reaching out — our team will get back to you within 24 hours.",
      data: { _id: created._id },
    });
  } catch (error) {
    console.error("[submitContactMessage] error:", error);
    return res.status(500).json({ success: false, message: "Failed to submit your message. Please try again." });
  }
};

/**
 * GET /api/admin/contact-messages  (auth required — Admin dashboard)
 * Query: page, limit, status, search
 */
export const getContactMessages = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const re = new RegExp(String(req.query.search).trim(), "i");
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { subject: re }, { message: re }];
    }

    const [items, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ContactMessage.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("[getContactMessages] error:", error);
    return res.status(500).json({ success: false, message: "Failed to load contact messages" });
  }
};

/**
 * PATCH /api/admin/contact-messages/:id  (auth required)
 * Body: { status }  — one of "New" | "Read" | "Replied" | "Archived"
 * Marking a message "Read" happens automatically the first time an admin
 * opens it (see getContactMessageById), this endpoint is for explicit
 * status changes (Replied/Archived) from the list/detail view.
 */
export const updateContactMessageStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["New", "Read", "Replied", "Archived"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(", ")}` });
    }
    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Message not found" });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[updateContactMessageStatus] error:", error);
    return res.status(500).json({ success: false, message: "Failed to update message" });
  }
};

// GET /api/admin/contact-messages/:id (auth required) — also flips New -> Read.
export const getContactMessageById = async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    if (message.status === "New") {
      message.status = "Read";
      await message.save();
    }
    return res.json({ success: true, data: message });
  } catch (error) {
    console.error("[getContactMessageById] error:", error);
    return res.status(500).json({ success: false, message: "Failed to load message" });
  }
};

// DELETE /api/admin/contact-messages/:id (auth required)
export const deleteContactMessage = async (req, res) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Message not found" });
    return res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    console.error("[deleteContactMessage] error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete message" });
  }
};