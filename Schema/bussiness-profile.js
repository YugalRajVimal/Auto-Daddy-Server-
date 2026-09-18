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
//   quantity: { type: Number, default: 1 },
//   quantityType: { type: String, enum: ["Unit", "Days"], default: "Unit" }, // Added quantityType
//   tax: { type: Number, default: 0 },
//   labourCost: { type: Number, default: 0 }, // Added labourCost
//   // ADDED FIELDS for model and make
//   model: { type: String }, // model of the subservice, e.g. car model
//   make: { type: String }   // make of the subservice, e.g. car manufacturer/brand
// }, { _id: false });

// // MyService Schema
// const myServiceSchema = new Schema({
//   service: { type: Types.ObjectId, ref: 'Services', required: true },
//   subServices: [selectedSubServiceSchema],
//   status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
//   date: { type: Date, default: Date.now }
// }, { _id: false });

// // Rating Schema
// const ratingSchema = new Schema({
//   userId: { type: Types.ObjectId, ref: 'User', required: true },
//   rating: { type: Number, required: true, min: 1, max: 5 },
// }, { timestamps: true, _id: false });

// // Notification Schema
// const notificationSchema = new Schema({
//   user: { type: Types.ObjectId, ref: 'User', required: true },
//   message: { type: String, required: true },
//   time: { type: Date, default: Date.now }
// }, { _id: false });

// // --- Subscription Schema ---
// const subscriptionSchema = new Schema({
//   days: { type: Number, required: true },
//   amount: { type: Number, required: true },
//   subTotal: { type: Number, required: true },
//   hst: { type: Number, required: true },
//   hstAmount: { type: Number, required: true },
//   total: { type: Number, required: true },
//   purchasedOn: { type: Date, default: Date.now },
//   invoiceNo: { type: String, required: true },
//   paymentStatus: { type: String, enum: ["Paid", "Pending", "Failed"], default: "Paid" },
//   paymentMethod: { type: String },
//   referenceId: { type: String },
//   remarks: { type: String },

//   // Cashfree-specific fields (unchanged, kept for any existing/legacy records)
//   cashfreeOrderToken: { type: String },
//   cashfreePaymentSessionId: { type: String },
//   cashfreeOrderId: { type: String },
//   cashfreeStatus: { type: String },
//   cashfreePayload: { type: Schema.Types.Mixed },

//   // NEW — Stripe-specific fields (only filled if paymentMethod is "stripe")
//   stripeCheckoutSessionId: { type: String },
//   stripePaymentIntentId: { type: String },
//   stripeCustomerId: { type: String },
//   stripeStatus: { type: String }, // last seen Stripe status: "open" | "complete" | "expired" | "paid" etc.
//   stripePayload: { type: Schema.Types.Mixed },
// }, { _id: false, timestamps: false });

// // --- Wallet Transaction Schema (Software wallet — NOT the website subscription) ---
// const walletTransactionSchema = new Schema({
//   type: { type: String, enum: ["recharge", "debit", "refund", "adjustment"], required: true },
//   amount: { type: Number, required: true }, // always positive; `type` tells direction
//   balanceAfter: { type: Number, required: true },
//   reason: { type: String }, // e.g. "Job Card #1042", "Wallet recharge"
//   jobCardNo: { type: Number },
//   paymentMethod: { type: String }, // for recharges: "Cash", "e-Transfer", "Manual", etc.
//   referenceId: { type: String },
//   createdAt: { type: Date, default: Date.now },
// }, { _id: true });


// // --- PerDayHours Schema ---
// const perDayTimingSchema = new Schema({
//   day: { type: String, required: true },
//   open: { type: String },
//   close: { type: String },
//   isClosed: { type: Boolean, default: false }
// }, { _id: false });

// // --- Special/Override Day Timing Schema ---
// const specialDayTimingSchema = new Schema({
//   date: { type: Date, required: true }, // stored normalized to midnight UTC — see normalizeToMidnight() in the controller
//   open: { type: String },   // ignored if isClosed: true
//   close: { type: String },  // ignored if isClosed: true
//   isClosed: { type: Boolean, default: false },
//   reason: { type: String }, // optional, e.g. "Public Holiday", "Owner unavailable"
// }, { timestamps: true });

// /* =========================================================
//    ONBOARDED CUSTOMERS
//    The shop creates a REAL User account for these customers
//    (role: "carowner", onboardedBy: this shop's owner userId)
//    so they can log in (via phone OTP) and approve job cards
//    themselves. This list just tracks which Users this shop
//    onboarded — all profile data and vehicles live on the User
//    doc itself (User.myVehicles), not duplicated here.
//    Kept separate from `myCustomers` (existing-user add-request
//    flow) per your instruction.
//    ========================================================= */
// const myOnboardedCustomerSchema = new Schema({
//   user: { type: Types.ObjectId, ref: "User", required: true },
//   addedAt: { type: Date, default: Date.now }
// }); // _id kept (default) — used as customerId in edit/add-vehicle routes

// /* =========================================================
//    MY CUSTOMERS (existing real Users added to this shop)
//    `_id` here IS the customer's real User `_id` (no separate id).
//    `status` starts "pending"; approving is done from the
//    carowner side (not built yet — fields are ready for it).
//    If the shop owner edits name/email/city while adding, the
//    edits sit in `pendingEdit` and are NOT applied anywhere
//    until the customer approves. On approval (future endpoint):
//      1. status -> "approved"
//      2. if pendingEdit is set, those fields get written to the
//         customer's real User document, then pendingEdit is cleared
//    ========================================================= */
// const myCustomerSchema = new Schema({
//   _id: { type: Types.ObjectId, ref: "User", required: true },
//   name: { type: String },
//   phone: { type: String },
//   email: { type: String },
//   city: { type: String },
//   status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
//   pendingEdit: {
//     name: { type: String },
//     email: { type: String },
//     city: { type: String }
//   },
//   addedAt: { type: Date, default: Date.now },
//   // ── SMS approval link (parallel to the future in-app approval) ──────────
//   // Set when the shop owner onboards this customer; cleared once they
//   // respond via the public link. Single-use + time-limited, same pattern
//   // as the Shop Owner onboarding-approval flow.
//   approvalToken: { type: String, default: null },
//   approvalTokenExpiresAt: { type: Date, default: null },
//   respondedAt: { type: Date, default: null },
// });

// // --- Domain Details Schema ---
// const domainDetailsSchema = new Schema({
//   domainName: { type: String, required: true },
//   expiryDate: { type: Date, required: true },
//   provider: { type: String, required: true },
//   status: { type: String, enum: ["New", "Existing"], default: "New" }
// }, { _id: false });

// // --- Business Profile Schema ---
// const businessProfileSchema = new Schema({
//   businessName: { type: String},
//   businessAddress: { type: String},
//   city: { type: String, default: null },
//   pincode: { type: String},
//   businessMapLocation: {
//     type: {
//       lat: { type: Number },
//       lng: { type: Number }
//     },
//     required: false
//   },
//   businessPhone: { type: String, required: true },
//   businessEmail: { type: String},
//   businessHSTNumber: { type: String },
//   gst: { type: Number },

//   perDayOpenHours: { type: [perDayTimingSchema], default: [] },
//   specialDayOpenHours: { type: [specialDayTimingSchema], default: [] }, // NEW

//   teamMembers: [teamMemberSchema],
//   businessLogo: { type: String },
//   bannerImage: { type: String },
//   carCompanies: [{ type: Types.ObjectId, ref: 'CarCompany' }],
//   isBusinessActive: { type: Boolean, default: false },

//   myServices: [myServiceSchema],
//   serviceWeWorkWith: [{ type: Types.ObjectId, ref: 'Services' }],
//   ratings: [ratingSchema],
//   myDeals: [{ type: Types.ObjectId, ref: "Deal" }],
//   notifications: [notificationSchema],

//   websiteTemplateId: { type: Types.ObjectId, ref: 'WebsiteTemplate', default: null },
//   domainName: { type: String, default: null },
//   domainDetails: [domainDetailsSchema],

//   subscriptions: [subscriptionSchema],

//   softwareTrialStartedAt: { type: Date, default: Date.now },
//   wallet: {
//     balance: { type: Number, default: 0, min: 0 },
//     transactions: [walletTransactionSchema],
//   },

//   // NOTE: pre-existing field, superseded in intent by myOnboardedCustomers
//   // below for the "onboard a customer with no account" flow. Left as-is
//   // since other code may still reference it — not used by customer.controller.js.
//   onboardedCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

//   myOnboardedCustomers: [myOnboardedCustomerSchema],
//   myCustomers: [myCustomerSchema],

//   invoiceTemplateSlug: { type: String, default: null },
//   jobCardTemplateSlug: { type: String, default: null },

//   ads: [{ type: Types.ObjectId, ref: "Ads" }],

//   createdAt: { type: Date, default: Date.now }
// }, { timestamps: true });

// /* =========================================================
//    VIRTUAL: computedSubscriptionExpiresAt
//    Derives subscription expiry purely from the subscriptions array
//    instead of a separately-stored/mutated field. Stacks every "Paid"
//    record in purchasedOn order, each one extending from whichever is
//    later — the running expiry so far, or that record's own purchasedOn
//    date. This is a getter, so it recomputes fresh on every access —
//    no write path, no drift.
//    ========================================================= */
// businessProfileSchema.virtual("computedSubscriptionExpiresAt").get(function () {
//   const paidSorted = (this.subscriptions || [])
//     .filter((s) => s.paymentStatus === "Paid")
//     .sort((a, b) => new Date(a.purchasedOn) - new Date(b.purchasedOn));

//   let runningExpiry = null;

//   for (const sub of paidSorted) {
//     const purchasedOn = new Date(sub.purchasedOn);
//     const baseDate =
//       runningExpiry && runningExpiry.getTime() > purchasedOn.getTime()
//         ? runningExpiry
//         : purchasedOn;

//     const newExpiry = new Date(baseDate);
//     newExpiry.setDate(newExpiry.getDate() + sub.days);
//     runningExpiry = newExpiry;
//   }

//   return runningExpiry;
// });

// // Include virtuals when a business doc is serialized directly (res.json(businessDoc), etc.)
// businessProfileSchema.set("toJSON", { virtuals: true });
// businessProfileSchema.set("toObject", { virtuals: true });

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
  quantityType: { type: String, enum: ["Unit", "Days"], default: "Unit" }, // Added quantityType
  tax: { type: Number, default: 0 },
  labourCost: { type: Number, default: 0 }, // Added labourCost
  // ADDED FIELDS for model and make
  model: { type: String }, // model of the subservice, e.g. car model
  make: { type: String }   // make of the subservice, e.g. car manufacturer/brand
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

  // Cashfree-specific fields (unchanged, kept for any existing/legacy records)
  cashfreeOrderToken: { type: String },
  cashfreePaymentSessionId: { type: String },
  cashfreeOrderId: { type: String },
  cashfreeStatus: { type: String },
  cashfreePayload: { type: Schema.Types.Mixed },

  // NEW — Stripe-specific fields (only filled if paymentMethod is "stripe")
  stripeCheckoutSessionId: { type: String },
  stripePaymentIntentId: { type: String },
  stripeCustomerId: { type: String },
  stripeStatus: { type: String }, // last seen Stripe status: "open" | "complete" | "expired" | "paid" etc.
  stripePayload: { type: Schema.Types.Mixed },
}, { _id: false, timestamps: false });

// --- Wallet Transaction Schema (Software wallet — NOT the website subscription) ---
const walletTransactionSchema = new Schema({
  type: { type: String, enum: ["recharge", "debit", "refund", "adjustment"], required: true },
  amount: { type: Number, required: true }, // always positive; `type` tells direction
  balanceAfter: { type: Number, required: true },
  reason: { type: String }, // e.g. "Job Card #1042", "Wallet recharge"
  jobCardNo: { type: Number },
  paymentMethod: { type: String }, // for recharges: "Cash", "e-Transfer", "Manual", "stripe", etc.
  referenceId: { type: String },
  createdAt: { type: Date, default: Date.now },

  // Recharge lifecycle status. Only "recharge" rows created via Stripe Checkout
  // go through "Pending" — every other type (debit/refund/adjustment, and the
  // legacy manual recharge path) is written directly as "Paid" and never
  // transitions. balance/balanceAfter are NOT touched for a "Pending" row;
  // they're only applied once the row flips to "Paid" (see
  // wallet.controller.js: createWalletCheckoutSession / handleWalletCheckoutCompleted).
  paymentStatus: { type: String, enum: ["Paid", "Pending", "Failed"], default: "Paid" },

  // Stripe-specific fields (only filled when paymentMethod is "stripe")
  stripeCheckoutSessionId: { type: String },
  stripePaymentIntentId: { type: String },
  stripeCustomerId: { type: String },
  stripeStatus: { type: String }, // last seen Stripe status: "open" | "complete" | "expired" | "paid" etc.
  stripePayload: { type: Schema.Types.Mixed },

  // Manual-adjustment audit trail (POST /wallet/adjust, admin-only)
  adjustedByUserId: { type: Types.ObjectId, ref: "User" },
  adjustedByRole: { type: String },
}, { _id: true });


// --- PerDayHours Schema ---
const perDayTimingSchema = new Schema({
  day: { type: String, required: true },
  open: { type: String },
  close: { type: String },
  isClosed: { type: Boolean, default: false }
}, { _id: false });

// --- Special/Override Day Timing Schema ---
const specialDayTimingSchema = new Schema({
  date: { type: Date, required: true }, // stored normalized to midnight UTC — see normalizeToMidnight() in the controller
  open: { type: String },   // ignored if isClosed: true
  close: { type: String },  // ignored if isClosed: true
  isClosed: { type: Boolean, default: false },
  reason: { type: String }, // optional, e.g. "Public Holiday", "Owner unavailable"
}, { timestamps: true });

/* =========================================================
   ONBOARDED CUSTOMERS
   The shop creates a REAL User account for these customers
   (role: "carowner", onboardedBy: this shop's owner userId)
   so they can log in (via phone OTP) and approve job cards
   themselves. This list just tracks which Users this shop
   onboarded — all profile data and vehicles live on the User
   doc itself (User.myVehicles), not duplicated here.
   Kept separate from `myCustomers` (existing-user add-request
   flow) per your instruction.
   ========================================================= */
const myOnboardedCustomerSchema = new Schema({
  user: { type: Types.ObjectId, ref: "User", required: true },
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
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  pendingEdit: {
    name: { type: String },
    email: { type: String },
    city: { type: String }
  },
  addedAt: { type: Date, default: Date.now },
  // ── SMS approval link (parallel to the future in-app approval) ──────────
  // Set when the shop owner onboards this customer; cleared once they
  // respond via the public link. Single-use + time-limited, same pattern
  // as the Shop Owner onboarding-approval flow.
  approvalToken: { type: String, default: null },
  approvalTokenExpiresAt: { type: Date, default: null },
  respondedAt: { type: Date, default: null },
});

// --- Domain Details Schema ---
const domainDetailsSchema = new Schema({
  domainName: { type: String, required: true },
  expiryDate: { type: Date, required: true },
  provider: { type: String, required: true },
  status: { type: String, enum: ["New", "Existing"], default: "New" }
}, { _id: false });

// --- Business Profile Schema ---
const businessProfileSchema = new Schema({
  slug: { type: String, unique: true, sparse: true, index: true },
  businessName: { type: String},
  businessAddress: { type: String},
  city: { type: String, default: null },
  pincode: { type: String},
  businessMapLocation: {
    type: {
      lat: { type: Number },
      lng: { type: Number }
    },
    required: false
  },
  businessPhone: { type: String, required: true },
  businessEmail: { type: String},
  businessHSTNumber: { type: String },
  gst: { type: Number },

  perDayOpenHours: { type: [perDayTimingSchema], default: [] },
  specialDayOpenHours: { type: [specialDayTimingSchema], default: [] }, // NEW

  teamMembers: [teamMemberSchema],
  businessLogo: { type: String },
  bannerImage: { type: String },
  carCompanies: [{ type: Types.ObjectId, ref: 'CarCompany' }],
  isBusinessActive: { type: Boolean, default: false },

  myServices: [myServiceSchema],
  serviceWeWorkWith: [{ type: Types.ObjectId, ref: 'Services' }],
  ratings: [ratingSchema],
  myDeals: [{ type: Types.ObjectId, ref: "Deal" }],
  notifications: [notificationSchema],

  websiteTemplateId: { type: Types.ObjectId, ref: 'WebsiteTemplate', default: null },
  domainName: { type: String, default: null },
  domainDetails: [domainDetailsSchema],

  subscriptions: [subscriptionSchema],

  softwareTrialStartedAt: { type: Date, default: Date.now },
  wallet: {
    balance: { type: Number, default: 0, min: 0 },
    transactions: [walletTransactionSchema],
  },

  // NOTE: pre-existing field, superseded in intent by myOnboardedCustomers
  // below for the "onboard a customer with no account" flow. Left as-is
  // since other code may still reference it — not used by customer.controller.js.
  onboardedCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

  myOnboardedCustomers: [myOnboardedCustomerSchema],
  myCustomers: [myCustomerSchema],

  invoiceTemplateSlug: { type: String, default: null },
  jobCardTemplateSlug: { type: String, default: null },

  

  ads: [{ type: Types.ObjectId, ref: "Ads" }],

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

/* =========================================================
   VIRTUAL: computedSubscriptionExpiresAt
   Derives subscription expiry purely from the subscriptions array
   instead of a separately-stored/mutated field. Stacks every "Paid"
   record in purchasedOn order, each one extending from whichever is
   later — the running expiry so far, or that record's own purchasedOn
   date. This is a getter, so it recomputes fresh on every access —
   no write path, no drift.
   ========================================================= */
businessProfileSchema.virtual("computedSubscriptionExpiresAt").get(function () {
  const paidSorted = (this.subscriptions || [])
    .filter((s) => s.paymentStatus === "Paid")
    .sort((a, b) => new Date(a.purchasedOn) - new Date(b.purchasedOn));

  let runningExpiry = null;

  for (const sub of paidSorted) {
    const purchasedOn = new Date(sub.purchasedOn);
    const baseDate =
      runningExpiry && runningExpiry.getTime() > purchasedOn.getTime()
        ? runningExpiry
        : purchasedOn;

    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + sub.days);
    runningExpiry = newExpiry;
  }

  return runningExpiry;
});

// Include virtuals when a business doc is serialized directly (res.json(businessDoc), etc.)
businessProfileSchema.set("toJSON", { virtuals: true });
businessProfileSchema.set("toObject", { virtuals: true });

/* =========================================================
   SLUG GENERATION (for the public shop profile page / QR code)
   Turns "Joe's Auto Shop" into "joes-auto-shop", appending -2, -3...
   on collision. Runs on first save, and again if businessName changed
   but a slug hasn't been explicitly set — existing shops backfill the
   next time they're saved (e.g. via the admin profile update route).
   ========================================================= */
   function slugifyBusinessName(name) {
    return (name || "shop")
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "shop";
  }
  
  businessProfileSchema.pre("save", async function (next) {
    try {
      if (this.slug && !this.isModified("businessName")) return next();
      if (this.slug && this.isModified("businessName")) return next(); // keep an existing slug stable even if the name changes
  
      const base = slugifyBusinessName(this.businessName);
      let candidate = base;
      let suffix = 1;
  
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const existing = await mongoose
          .model("BusinessProfile")
          .findOne({ slug: candidate, _id: { $ne: this._id } })
          .select("_id")
          .lean();
        if (!existing) break;
        suffix += 1;
        candidate = `${base}-${suffix}`;
      }
  
      this.slug = candidate;
      next();
    } catch (err) {
      next(err);
    }
  });

const BusinessProfileModel = mongoose.model("BusinessProfile", businessProfileSchema);

export default BusinessProfileModel;