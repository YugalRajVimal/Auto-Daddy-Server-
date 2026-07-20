import AdminInvoiceSettings from "../../../Schema/AdminInvoices/AdminInvoiceSettings.schema.js";

// GET /api/admin/invoices/settings
// Returns the current prefix/next-number config PLUS the formatted
// "next invoice number" preview the UI shows before an invoice is saved.
export const getInvoiceSettings = async (req, res) => {
  try {
    const settings = await AdminInvoiceSettings.getOrCreate();
    res.json({
      success: true,
      settings: {
        invoicePrefix: settings.invoicePrefix,
        nextNumber: settings.nextNumber,
        padLength: settings.padLength,
        nextInvoiceNumberPreview: settings.formatInvoiceNumber(settings.nextNumber),
      },
    });
  } catch (err) {
    console.error("[INVOICE SETTINGS] getInvoiceSettings error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch invoice settings" });
  }
};

// PUT /api/admin/invoices/settings   Body: { invoicePrefix?, nextNumber?, padLength? }
// This is what the "Manage Invoice" modal calls on save.
export const updateInvoiceSettings = async (req, res) => {
  try {
    const { invoicePrefix, nextNumber, padLength } = req.body;

    if (nextNumber !== undefined && (Number.isNaN(Number(nextNumber)) || Number(nextNumber) < 1)) {
      return res.status(400).json({ success: false, message: "nextNumber must be a positive number." });
    }
    if (padLength !== undefined && (Number.isNaN(Number(padLength)) || Number(padLength) < 1 || Number(padLength) > 10)) {
      return res.status(400).json({ success: false, message: "padLength must be between 1 and 10." });
    }

    const settings = await AdminInvoiceSettings.getOrCreate();
    if (invoicePrefix !== undefined) settings.invoicePrefix = String(invoicePrefix).trim();
    if (nextNumber !== undefined) settings.nextNumber = Number(nextNumber);
    if (padLength !== undefined) settings.padLength = Number(padLength);
    settings.updatedBy = req.user?.id || null;
    await settings.save();

    res.json({
      success: true,
      settings: {
        invoicePrefix: settings.invoicePrefix,
        nextNumber: settings.nextNumber,
        padLength: settings.padLength,
        nextInvoiceNumberPreview: settings.formatInvoiceNumber(settings.nextNumber),
      },
    });
  } catch (err) {
    console.error("[INVOICE SETTINGS] updateInvoiceSettings error:", err);
    res.status(500).json({ success: false, message: "Failed to update invoice settings" });
  }
};

/**
 * Atomically claims the next sequence number and bumps the counter in one
 * DB round trip, so two admins creating invoices at the same moment can
 * never collide on the same number. Returns the formatted invoice number
 * (e.g. "INV00007"). Call this from adminInvoiceController#createInvoice
 * if you want the backend — not just the UI prefill — to own numbering.
 */
export async function getAndIncrementNextInvoiceNumber() {
  const settings = await AdminInvoiceSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { invoicePrefix: "", padLength: 5 }, $inc: { nextNumber: 1 } },
    { new: false, upsert: true } // new:false returns the PRE-increment doc, i.e. the number we just claimed
  );
  const claimedSeq = settings ? settings.nextNumber : 1;
  const prefix = settings ? settings.invoicePrefix : "";
  const padLength = settings ? settings.padLength : 5;
  return `${prefix}${String(claimedSeq).padStart(padLength, "0")}`;
}

export default { getInvoiceSettings, updateInvoiceSettings, getAndIncrementNextInvoiceNumber };