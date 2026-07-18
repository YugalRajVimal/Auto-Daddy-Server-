import mongoose from 'mongoose';

const AdminInvoiceItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    hsnCode: { type: String, required: false, default: "" },
    itemType: { type: String, required: false, default: "" },
    description: { type: String, required: false, default: "" },
    unitCost: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitType: { type: String, required: false, default: "" },
    gstPercent: { type: Number, required: false, default: 0 },
    openingStock: { type: Number, required: false, default: 0 },
    image: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model('AdminInvoiceItem', AdminInvoiceItemSchema);
