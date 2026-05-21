import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

// Team Member Schema
const teamMemberSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  designation: { type: String },
  photo: { type: String }, // URL or file path to the photo
  isActive: { type: Boolean, default: true } // Active status of the team member
});

// SubService Selection Schema
const selectedSubServiceSchema = new Schema({
  name: { type: String, required: true },
  desc: { type: String },
  price: { type: Number }
}, { _id: false });

// MyService Schema
const myServiceSchema = new Schema({
  service: { type: Types.ObjectId, ref: 'Services', required: true }, // Reference to Services collection
  subServices: [selectedSubServiceSchema] // List of subService fields for this service
}, { _id: false });

// Rating Schema
const ratingSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true, _id: false });

// Notification Schema
const notificationSchema = new Schema({
  user: { 
    type: Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  time: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

// --- Subscription Schema ---
/**
 * Subscription details schema:
 * - days: number of days for the subscription
 * - amount: base amount (without tax)
 * - subTotal: calculated as amount * qty (if any), or same as amount
 * - hst: HST tax amount
 * - total: grand total after taxes
 * - purchasedOn: date when subscription was purchased
 * - invoiceNo: string, resolved from Counter (see counter.schema.js: name="invoiceNo")
 * - [other fields as needed, easily extendable]
 */
const subscriptionSchema = new Schema({
  days: { type: Number, required: true },
  amount: { type: Number, required: true },
  subTotal: { type: Number, required: true },
  hst: { type: Number, required: true },
  hstAmount: { type: Number, required: true },
  total: { type: Number, required: true },
  purchasedOn: { type: Date, default: Date.now },
  invoiceNo: { type: String, required: true }, // Example: "INV-2024-00001"
  paymentStatus: { type: String, enum: ["Paid", "Pending", "Failed"], default: "Paid" },
  paymentMethod: { type: String }, // e.g., "Credit Card", "Cash", "cashfree", etc.
  referenceId: { type: String }, // e.g., payment reference/transaction id, also cashfree order_token if used
  remarks: { type: String },

  // Cashfree-specific fields (only filled if paymentMethod is "cashfree")
  cashfreeOrderToken: { type: String }, // Cashfree's order_token
  cashfreePaymentSessionId: { type: String }, // Cashfree's payment_session_id
  cashfreeOrderId: { type: String }, // Cashfree's order_id (should match invoiceNo, but kept for clarity)
  cashfreeStatus: { type: String }, // Last seen status (e.g. "PENDING", "ACTIVE", "PAID", etc.)
  cashfreePayload: { type: Schema.Types.Mixed }, // For storing any response blob from Cashfree if needed
}, { _id: false, timestamps: false });

// --- Business Profile Schema ---
const businessProfileSchema = new Schema({
  businessName: { type: String, required: true },
  businessAddress: { type: String, required: true },
  city: { type: String, default: null },
  pincode: { type: String, required: true },
  businessMapLocation: {
    type: {
      lat: { type: Number },
      lng: { type: Number }
    },
    required: false
  },
  businessPhone: { type: String, required: true },
  businessEmail: { type: String, required: true },
  businessHSTNumber: { type: String },
  gst: { type: Number },

  openHours: { type: String },
  openDays: { type: [String] },
  closedDays: { type: [String] },
  teamMembers: [teamMemberSchema],
  businessLogo: { type: String },
  carCompanies: [{ type: Types.ObjectId, ref: 'CarCompany' }],
  isBusinessActive: { type: Boolean, default: true },

  myServices: [myServiceSchema],
  serviceWeWorkWith: [{ type: Types.ObjectId, ref: 'Services' }],
  ratings: [ratingSchema],
  myDeals: [{ type: Types.ObjectId, ref: "Deal" }],
  notifications: [notificationSchema],

  // Subscription details (most recent/current subscription at index 0, or push new on renewal)
  subscriptions: [subscriptionSchema],

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const BusinessProfileModel = mongoose.model("BusinessProfile", businessProfileSchema);
export default BusinessProfileModel;
