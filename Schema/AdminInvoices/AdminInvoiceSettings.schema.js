import mongoose from "mongoose";

// Singleton document (one per deployment) holding the invoice numbering
// config. "Manage Invoice" on the Invoices page reads/writes this via
// GET/PUT /api/admin/invoices/settings. nextNumber is the sequence value
// that will be used for the NEXT invoice created — it's incremented
// atomically each time an invoice is actually created (see
// getAndIncrementNextInvoiceNumber below), not just when the modal saves.
const AdminInvoiceSettingsSchema = new mongoose.Schema(
  {
    // A fixed key so there's only ever one settings document.
    key: { type: String, default: "default", unique: true },

    // e.g. "INV" — shown before the zero-padded sequence: INV00001
    invoicePrefix: { type: String, default: "", trim: true },

    // The sequence number that will be assigned to the NEXT invoice.
    nextNumber: { type: Number, default: 1, min: 1 },

    // How many digits the sequence is padded to: 1 -> "00001"
    padLength: { type: Number, default: 5, min: 1, max: 10 },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser", default: null },
  },
  { timestamps: true }
);

/** Formats a sequence number using this settings doc's prefix/padding. */
AdminInvoiceSettingsSchema.methods.formatInvoiceNumber = function (seq) {
  return `${this.invoicePrefix}${String(seq).padStart(this.padLength, "0")}`;
};

/** Fetches the singleton, creating it with defaults on first use. */
AdminInvoiceSettingsSchema.statics.getOrCreate = async function () {
  let doc = await this.findOne({ key: "default" });
  if (!doc) doc = await this.create({ key: "default" });
  return doc;
};

export default mongoose.models.AdminInvoiceSettings ||
  mongoose.model("AdminInvoiceSettings", AdminInvoiceSettingsSchema);