import mongoose from 'mongoose';

const AdminInvoiceItemRefSchema = new mongoose.Schema({
  ItemRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminInvoiceItem', required: true },
  Item: { type: String, required: true }, // denormalized item name for quick display
  Description: { type: String, default: "" },
  UnitPrice: { type: Number, required: true },
  Units: { type: Number, required: true }, // quantity multiplier (was "days" on the frontend, renamed to Units)
  GSTPercent: { type: Number, required: true },
  Amount: { type: Number, required: true }, // UnitPrice * Units (pre-GST)
  Image: { type: String, default: "" }, // added image field (url or path)
}, { _id: false });

const AdminInvoiceSchema = new mongoose.Schema({
  // clientRefId points at the autoshopowner User picked from the dropdown
  // (populated from GET /api/admin/autoshopowners). client is kept as a
  // denormalized name snapshot for fast list/print rendering even if the
  // User's name changes later.
  clientRefId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  client: { type: String, required: true },
  clientRemark: { type: String, default: "" },
  invoiceNumber: { type: String, required: true, unique: true },
  dateOfIssue: { type: Date, required: true },
  poNumber: { type: String, default: "" },
  items: { type: [AdminInvoiceItemRefSchema], required: true },
  subtotal: { type: Number, required: true },
  gst: { type: Number, required: true },
  roundOff: { type: Number, required: false, default: 0 },
  invoiceTotal: { type: Number, required: true },
  bankRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: false },
  bankName: { type: String, default: "" },
  terms: { type: String, default: "" },
  status: {
    type: String,
    // NOTE: fixed the typo "FcPaid" -> "Paid" so this lines up with the frontend.
    enum: ['Draft', 'Sent', 'Paid', 'Overdue'],
    default: 'Draft',
  },
  view: {
    type: String,
    enum: ["active", "archived", "deleted"],
    default: "active",
  },
}, { timestamps: true });

export default mongoose.models.AdminInvoice ||
  mongoose.model("AdminInvoice", AdminInvoiceSchema);
