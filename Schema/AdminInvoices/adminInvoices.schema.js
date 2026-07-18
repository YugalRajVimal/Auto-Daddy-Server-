import mongoose from 'mongoose';

const AdminInvoiceItemRefSchema = new mongoose.Schema({
  ItemRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminInvoiceItem', required: true },
  Item: { type: String, required: true }, // Redundant with ItemRefId, but retained for denormalization/lookups
  Description: { type: String, default: "" },
  UnitPrice: { type: Number, required: true },
  Units: { type: Number, required: true }, // counts
  GSTPercent: { type: Number, required: true }, // GST (%)
  Amount: { type: Number, required: true },
}, { _id: false });

const AdminInvoiceSchema = new mongoose.Schema({
  client: { type: String, required: true }, // Client
  clientRemark: { type: String, default: "" }, // Client Remark
  invoiceNumber: { type: String, required: true, unique: true }, // Invoice Number
  dateOfIssue: { type: Date, required: true }, // Date of Issue
  poNumber: { type: String, default: "" }, // PO Number
  items: { type: [AdminInvoiceItemRefSchema], required: true }, // Items array
  subtotal: { type: Number, required: true }, // Subtotal
  gst: { type: Number, required: true }, // GST
  roundOff: { type: Number, required: false, default: 0 }, // Round Off
  invoiceTotal: { type: Number, required: true }, // Invoice Total
  bankRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: false }, // Bank Ref Id
  bankName: { type: String, default: "" }, // Bank Name
  terms: { type: String, default: "" }, // Terms
  status: { 
    type: String, 
    enum: ['draft', 'sent', 'FcPaid', 'overdue'], 
    default: 'draft' 
  }, // Status
}, { timestamps: true });

export default mongoose.model('AdminInvoice', AdminInvoiceSchema);