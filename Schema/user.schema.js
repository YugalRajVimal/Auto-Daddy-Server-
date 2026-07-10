// /* ================================
//    1. USERS COLLECTION (AUTH SOURCE)
//    ================================ */

// // models/User.js
// import mongoose from "mongoose";

// const NullableFile = { type: mongoose.Schema.Types.Mixed, default: null };

// const VehicleDocumentSchema = new mongoose.Schema(
//   {
//     vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true }, // Link to Vehicle
//     carOwnershipCertificate: { type: String },
//     insuranceCertificate: { type: String },   
//     carImage: { type: String },               
//     drivingLicenseFront: { type: String },    
//     drivingLicenseBack: { type: String },     
//   }
// );

// const UserSchema = new mongoose.Schema(
//   {
//     //Role
//     role: {
//       type: String,
//       enum: ["carowner", "autoshopowner"],
//     },

//     //Profile
//     name: { type: String},
//     email: { type: String, sparse: true },
//     countryCode: { type: String },
//     phone: { type: String, default: "" },
//     pincode: { type: String, default: null },
//     address: { type: String, default: null },
//     city: { type: String, default: null },
//     profilePhoto: { type: String, default: null },
//     isDisabled: { type: Boolean, default: false },
//     isProfileComplete: { type: Boolean, default: false },

//     //Car Owner
//     favoriteAutoShops: [{ type: mongoose.Schema.Types.ObjectId, ref: "AutoShop", default: [] }],
//     myVehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: [] }],
//     onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

//     //Auto Shop Owner
//     // shopType: {
//     //   type: String,
//     //   enum: ["autoShop", "tyreShop", "carWash", "towTruck"],
//     //   default: "autoShop"
//     // },
//     shopType: {
//       type: [String],
//       enum: ["autoShop", "tyreShop", "carWash", "towTruck"],
//       default: []
//     },
//     isAutoShopBusinessProfileComplete: { type: Boolean, default: false },
//     businessProfile: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessProfile", default: null },
//     myCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
//     // Track when a customer was added by the autoshopowner
//     myCustomersMeta: [
//       {
//         customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//         addedAt: { type: Date, default: Date.now }
//       }
//     ],

//     // documents - Array. Each entry = Vehicle's 5 images as base64 fields + vehicleId
//     documents: {
//       type: [VehicleDocumentSchema],
//       default: [],
//       validate: [arr => arr.length <= 5, '{PATH} exceeds the limit of 5 vehicles documents']
//     },

//     discardedDeals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Deal", default: [] }],

//     // OTP fields are available for all users.
//     otp: { type: String }, // Last sent OTP
//     otpExpiresAt: { type: Date }, // Expiry time for current OTP
//     otpGeneratedAt: { type: Date }, // When was the OTP generated
//     otpAttempts: { type: Number, default: 0 }, // Attempts for the current OTP

//     deviceId: { type: String, default: null },
//     fcmToken: { type: String, default: null },

//     thoughtOfTheDayLiked: { type: Boolean, default: false },

//     phoneVerified: { type: Boolean, default: false },
//     emailVerified: { type: Boolean, default: false },
//     status: {
//       type: String,
//       enum: ["active", "suspended", "deleted"],
//       default: "active",
//     },

//   },
//   { timestamps: true }
// );

// export const User = mongoose.model("User", UserSchema);

// models/User.js
//
// ONLY CHANGE from your original: added `notifications` array so job-card
// send-for-approval requests (and any future push-style notices) can be
// stored on the customer's own profile, per your instruction to "save it
// in user schema".

import mongoose from "mongoose";

const NullableFile = { type: mongoose.Schema.Types.Mixed, default: null };

const VehicleDocumentSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    carOwnershipCertificate: { type: String },
    insuranceCertificate: { type: String },
    carImage: { type: String },
    drivingLicenseFront: { type: String },
    drivingLicenseBack: { type: String },
  }
);

// NEW: notifications a user (customer) receives, e.g. job card approval requests
const UserNotificationSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessProfile" },
    jobCard: { type: mongoose.Schema.Types.ObjectId, ref: "JobCard" },
    type: {
      type: String,
      enum: ["jobCardApproval", "general"],
      default: "general",
    },
    title: { type: String },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const UserSchema = new mongoose.Schema(
  {
    //Role
    role: {
      type: String,
      enum: ["carowner", "autoshopowner"],
    },

    //Profile
    name: { type: String },
    email: { type: String, sparse: true },
    countryCode: { type: String },
    phone: { type: String, default: "" },
    pincode: { type: String, default: null },
    address: { type: String, default: null },
    city: { type: String, default: null },
    profilePhoto: { type: String, default: null },
    isDisabled: { type: Boolean, default: false },
    isProfileComplete: { type: Boolean, default: false },

    //Car Owner
    favoriteAutoShops: [{ type: mongoose.Schema.Types.ObjectId, ref: "AutoShop", default: [] }],
    myVehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: [] }],
    onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    //Auto Shop Owner
    shopType: {
      type: [String],
      enum: ["autoShop", "tyreShop", "carWash", "towTruck"],
      default: [],
    },
    isAutoShopBusinessProfileComplete: { type: Boolean, default: false },
    businessProfile: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessProfile", default: null },
    myCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    myCustomersMeta: [
      {
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    documents: {
      type: [VehicleDocumentSchema],
      default: [],
      validate: [(arr) => arr.length <= 5, "{PATH} exceeds the limit of 5 vehicles documents"],
    },

    discardedDeals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Deal", default: [] }],

    // NEW
    notifications: { type: [UserNotificationSchema], default: [] },

    otp: { type: String },
    otpExpiresAt: { type: Date },
    otpGeneratedAt: { type: Date },
    otpAttempts: { type: Number, default: 0 },

    deviceId: { type: String, default: null },
    fcmToken: { type: String, default: null },

    thoughtOfTheDayLiked: { type: Boolean, default: false },

    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);