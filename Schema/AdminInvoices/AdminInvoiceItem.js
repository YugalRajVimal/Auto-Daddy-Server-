import mongoose from 'mongoose';

const AdminInvoiceItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    hsnCode: { type: String, required: false, default: "" },
    itemType: { type: String, required: false, default: "" }, // "Goods" | "Service"
    description: { type: String, required: false, default: "" },
    unitCost: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitType: { type: String, required: false, default: "" }, // Nos, Box, Kg, Litre, Hrs, Days
    gstPercent: { type: Number, required: false, default: 0 },

    // Stock tracking
    // initialStock is set once at creation and never changed automatically —
    // it's the "as first entered" baseline for reference/reporting.
    initialStock: { type: Number, required: false, default: 0 },
    // openingStock is the LIVE stock count. It is decremented when an invoice
    // using this item is created, and incremented back when that invoice is
    // edited (quantity reduced/removed) or deleted.
    openingStock: { type: Number, required: false, default: 0 },

    image: { type: String, required: false, default: "" }, // filename only, served from /Uploads/Items

    view: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
    },
  },
  { timestamps: true }
);

AdminInvoiceItemSchema.index({ itemName: "text", description: "text" });

export default mongoose.models.AdminInvoiceItem ||
  mongoose.model("AdminInvoiceItem", AdminInvoiceItemSchema);
