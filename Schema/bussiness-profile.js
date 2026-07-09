// import mongoose from 'mongoose';

// const { Schema, Types } = mongoose;

// // Team Member Schema
// const teamMemberSchema = new Schema({
//   name: { type: String, required: true },
//   email: { type: String },
//   phone: { type: String },
//   designation: { type: String },
//   photo: { type: String }, // URL or file path to the photo
//   isActive: { type: Boolean, default: true } // Active status of the team member
// });

// // SubService Selection Schema
// const selectedSubServiceSchema = new Schema({
//   name: { type: String, required: true },
//   desc: { type: String },
//   price: { type: Number },
//   quantity: { type: Number, default: 1 }, // Added quantity field
//   tax: { type: Number, default: 0 }       // Added tax field
// }, { _id: false });

// // MyService Schema
// const myServiceSchema = new Schema({
//   service: { type: Types.ObjectId, ref: 'Services', required: true }, // Reference to Services collection
//   subServices: [selectedSubServiceSchema], // List of subService fields for this service
//   status: { type: String, enum: ["Active", "Inactive"], default: "Active" }, // Status of this myService entry
//   date: { type: Date, default: Date.now } // Date when the service was added
// }, { _id: false });

// // Rating Schema
// const ratingSchema = new Schema({
//   userId: { type: Types.ObjectId, ref: 'User', required: true },
//   rating: { type: Number, required: true, min: 1, max: 5 },
// }, { timestamps: true, _id: false });

// // Notification Schema
// const notificationSchema = new Schema({
//   user: { 
//     type: Types.ObjectId, 
//     ref: 'User',
//     required: true 
//   },
//   message: { 
//     type: String, 
//     required: true 
//   },
//   time: { 
//     type: Date, 
//     default: Date.now 
//   }
// }, { _id: false });

// // --- Subscription Schema ---
// /**
//  * Subscription details schema:
//  * - days: number of days for the subscription
//  * - amount: base amount (without tax)
//  * - subTotal: calculated as amount * qty (if any), or same as amount
//  * - hst: HST tax amount
//  * - total: grand total after taxes
//  * - purchasedOn: date when subscription was purchased
//  * - invoiceNo: string, resolved from Counter (see counter.schema.js: name="invoiceNo")
//  * - [other fields as needed, easily extendable]
//  */
// const subscriptionSchema = new Schema({
//   days: { type: Number, required: true },
//   amount: { type: Number, required: true },
//   subTotal: { type: Number, required: true },
//   hst: { type: Number, required: true },
//   hstAmount: { type: Number, required: true },
//   total: { type: Number, required: true },
//   purchasedOn: { type: Date, default: Date.now },
//   invoiceNo: { type: String, required: true }, // Example: "INV-2024-00001"
//   paymentStatus: { type: String, enum: ["Paid", "Pending", "Failed"], default: "Paid" },
//   paymentMethod: { type: String }, // e.g., "Credit Card", "Cash", "cashfree", etc.
//   referenceId: { type: String }, // e.g., payment reference/transaction id, also cashfree order_token if used
//   remarks: { type: String },

//   // Cashfree-specific fields (only filled if paymentMethod is "cashfree")
//   cashfreeOrderToken: { type: String }, // Cashfree's order_token
//   cashfreePaymentSessionId: { type: String }, // Cashfree's payment_session_id
//   cashfreeOrderId: { type: String }, // Cashfree's order_id (should match invoiceNo, but kept for clarity)
//   cashfreeStatus: { type: String }, // Last seen status (e.g. "PENDING", "ACTIVE", "PAID", etc.)
//   cashfreePayload: { type: Schema.Types.Mixed }, // For storing any response blob from Cashfree if needed
// }, { _id: false, timestamps: false });

// // --- PerDayHours Schema ---
// /**
//  * For each day, specify open/close time and optionally if it's closed.
//  */
// const perDayTimingSchema = new Schema({
//   day: { type: String, required: true }, // e.g., "Monday"
//   open: { type: String }, // e.g., "09:00"
//   close: { type: String }, // e.g., "18:00"
//   isClosed: { type: Boolean, default: false } // true if business is closed this day
// }, { _id: false });

// // --- Business Profile Schema ---
// const businessProfileSchema = new Schema({
//   businessName: { type: String, required: true },
//   businessAddress: { type: String, required: true },
//   city: { type: String, default: null },
//   pincode: { type: String, required: true },
//   businessMapLocation: {
//     type: {
//       lat: { type: Number },
//       lng: { type: Number }
//     },
//     required: false
//   },
//   businessPhone: { type: String, required: true },
//   businessEmail: { type: String, required: true },
//   businessHSTNumber: { type: String },
//   gst: { type: Number },

//   // Remove old openHours, openDays, closedDays; use perDayOpenHours instead
//   perDayOpenHours: { type: [perDayTimingSchema], default: [] },

//   teamMembers: [teamMemberSchema],
//   businessLogo: { type: String },
//   bannerImage: { type: String }, // URL or file path to the banner image
//   carCompanies: [{ type: Types.ObjectId, ref: 'CarCompany' }],
//   isBusinessActive: { type: Boolean, default: true },

//   myServices: [myServiceSchema],
//   serviceWeWorkWith: [{ type: Types.ObjectId, ref: 'Services' }],
//   ratings: [ratingSchema],
//   myDeals: [{ type: Types.ObjectId, ref: "Deal" }],
//   notifications: [notificationSchema],

//   websiteTemplateId: { type: Types.ObjectId, ref: 'WebsiteTemplate', default: null },
//   domainName: { type: String, default: null }, // Business custom domain name (if connected)

//   // Subscription details (most recent/current subscription at index 0, or push new on renewal)
//   subscriptions: [subscriptionSchema],
//   /**
//    * Array of onboarded customers for the business profile.
//    * Each entry refers to a User that has been onboarded as a customer.
//    * This is distinct from general myCustomers (which includes status etc).
//    */
//   onboardedCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
//   myCustomers: [{
//     _id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     phone: { type: String },
//     email: { type: String },
//     city: { type: String },
//     status: {
//       type: String,
//       enum: ["pending", "approved"],
//       default: "pending",
//     },
//     addedAt: { type: Date, default: Date.now }
//   }],
//   /**
//    * Reference to ads associated with this business profile.
//    * Stores array of Ads document ObjectIds.
//    */
//   ads: [{ type: Types.ObjectId, ref: "Ads" }],

//   createdAt: { type: Date, default: Date.now }
// }, { timestamps: true });

// const BusinessProfileModel = mongoose.model("BusinessProfile", businessProfileSchema);

// export default BusinessProfileModel;


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
  price: { type: Number },
  quantity: { type: Number, default: 1 },
  tax: { type: Number, default: 0 }
}, { _id: false });

// MyService Schema
const myServiceSchema = new Schema({
  service: { type: Types.ObjectId, ref: 'Services', required: true },
  subServices: [selectedSubServiceSchema],
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  date: { type: Date, default: Date.now }
}, { _id: false });

// Rating Schema
const ratingSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true, _id: false });

// Notification Schema
const notificationSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  time: { type: Date, default: Date.now }
}, { _id: false });

// --- Subscription Schema ---
const subscriptionSchema = new Schema({
  days: { type: Number, required: true },
  amount: { type: Number, required: true },
  subTotal: { type: Number, required: true },
  hst: { type: Number, required: true },
  hstAmount: { type: Number, required: true },
  total: { type: Number, required: true },
  purchasedOn: { type: Date, default: Date.now },
  invoiceNo: { type: String, required: true },
  paymentStatus: { type: String, enum: ["Paid", "Pending", "Failed"], default: "Paid" },
  paymentMethod: { type: String },
  referenceId: { type: String },
  remarks: { type: String },
  cashfreeOrderToken: { type: String },
  cashfreePaymentSessionId: { type: String },
  cashfreeOrderId: { type: String },
  cashfreeStatus: { type: String },
  cashfreePayload: { type: Schema.Types.Mixed },
}, { _id: false, timestamps: false });

// --- PerDayHours Schema ---
const perDayTimingSchema = new Schema({
  day: { type: String, required: true },
  open: { type: String },
  close: { type: String },
  isClosed: { type: Boolean, default: false }
}, { _id: false });

/* =========================================================
   ONBOARDED CUSTOMERS
   Customers the shop owner creates directly — they do NOT
   have a User account. Kept fully inside BusinessProfile.
   `vehicles` references real Vehicle documents (same pattern
   as User.myVehicles) — VehicleSchema itself needs no owner
   field since the only pointer to a vehicle lives here.
   ========================================================= */
const myOnboardedCustomerSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  city: { type: String },
  vehicles: [{ type: Types.ObjectId, ref: "Vehicle" }],
  addedAt: { type: Date, default: Date.now }
}); // _id kept (default) — used as customerId in edit/add-vehicle routes

/* =========================================================
   MY CUSTOMERS (existing real Users added to this shop)
   `_id` here IS the customer's real User `_id` (no separate id).
   `status` starts "pending"; approving is done from the
   carowner side (not built yet — fields are ready for it).
   If the shop owner edits name/email/city while adding, the
   edits sit in `pendingEdit` and are NOT applied anywhere
   until the customer approves. On approval (future endpoint):
     1. status -> "approved"
     2. if pendingEdit is set, those fields get written to the
        customer's real User document, then pendingEdit is cleared
   ========================================================= */
const myCustomerSchema = new Schema({
  _id: { type: Types.ObjectId, ref: "User", required: true },
  name: { type: String },
  phone: { type: String },
  email: { type: String },
  city: { type: String },
  status: { type: String, enum: ["pending", "approved"], default: "pending" },
  pendingEdit: {
    name: { type: String },
    email: { type: String },
    city: { type: String }
  },
  addedAt: { type: Date, default: Date.now }
});

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

  perDayOpenHours: { type: [perDayTimingSchema], default: [] },

  teamMembers: [teamMemberSchema],
  businessLogo: { type: String },
  bannerImage: { type: String },
  carCompanies: [{ type: Types.ObjectId, ref: 'CarCompany' }],
  isBusinessActive: { type: Boolean, default: true },

  myServices: [myServiceSchema],
  serviceWeWorkWith: [{ type: Types.ObjectId, ref: 'Services' }],
  ratings: [ratingSchema],
  myDeals: [{ type: Types.ObjectId, ref: "Deal" }],
  notifications: [notificationSchema],

  websiteTemplateId: { type: Types.ObjectId, ref: 'WebsiteTemplate', default: null },
  domainName: { type: String, default: null },

  subscriptions: [subscriptionSchema],

  // NOTE: pre-existing field, superseded in intent by myOnboardedCustomers
  // below for the "onboard a customer with no account" flow. Left as-is
  // since other code may still reference it — not used by customer.controller.js.
  onboardedCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

  myOnboardedCustomers: [myOnboardedCustomerSchema],
  myCustomers: [myCustomerSchema],

  ads: [{ type: Types.ObjectId, ref: "Ads" }],

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const BusinessProfileModel = mongoose.model("BusinessProfile", businessProfileSchema);

export default BusinessProfileModel;