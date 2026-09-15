import mongoose from "mongoose";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One row per submission of the public "Contact Us" form on autodaddy.ca
 * (contact-us.html). Posted with no auth via /api/public/contact, read by
 * Admin under Leads -> Website Messages
 * (Controllers/Admin/contactMessages.controller.js).
 */
const contactMessageSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Please provide a valid email address."],
    },
    subject: { type: String, trim: true, default: "" },
    message: { type: String, required: true, trim: true },

    // Lightweight abuse/debug context — never shown as a "field" to fill in,
    // just captured from the request for the admin's reference.
    sourceIp: { type: String, default: null },
    userAgent: { type: String, default: null },

    status: {
      type: String,
      enum: ["New", "Read", "Replied", "Archived"],
      default: "New",
    },
  },
  { timestamps: true }
);

const ContactMessage =
  mongoose.models.ContactMessage || mongoose.model("ContactMessage", contactMessageSchema);

export default ContactMessage;