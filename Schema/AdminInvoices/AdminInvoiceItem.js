import mongoose from 'mongoose';

const AdminInvoiceItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    description: { type: String, required: false, default: "" },
    unitCost: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitType: { 
      type: String, 
      required: false, 
      enum: ["Unit", "Days"], 
      default: "Unit" 
    }, // Only "Unit" or "Days" allowed
    gstPercent: { type: Number, required: false, default: 0 },

    // Stock tracking
    // initialStock is set once at creation and never changed automatically —
    // it's the "as first entered" baseline for reference/reporting.
    initialStock: { type: Number, required: false, default: 0 },

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
