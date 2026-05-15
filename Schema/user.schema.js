/* ================================
   1. USERS COLLECTION (AUTH SOURCE)
   ================================ */

// models/User.js
import mongoose from "mongoose";

const NullableFile = { type: mongoose.Schema.Types.Mixed, default: null };

const UserSchema = new mongoose.Schema(
  {
    //Role
    role: {
      type: String,
      enum: ["carowner","autoshopowner"],
    },

    //Profile
    name: { type: String},
    email: { type: String, sparse: true },
    countryCode:{type: String,},
    phone:{type: String, default: ""},
    pincode:{type: String, default: null},
    address:{type: String, default: null},
    city: { type: String, default: null }, // <-- Added city field
    profilePhoto:{type: String, default: null},
    isDisabled: { type: Boolean, default: false },
    isProfileComplete :{type: Boolean, default: false},
    //Car Owner
    favoriteAutoShops: [{ type: mongoose.Schema.Types.ObjectId, ref: "AutoShop", default: [] }],
    myVehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: [] }],
    onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    //Auto Shop Owner
    isAutoShopBusinessProfileComplete: { type: Boolean, default: false },
    businessProfile: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessProfile", default: null },
    myCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    // Track when a customer was added by the autoshopowner
    myCustomersMeta: [
      {
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        addedAt: { type: Date, default: Date.now }
      }
    ],

    documents: [
      {
        name: { type: String, required: true },
        // Save image directly as base64 string text format (instead of file path)
        imageData: { type: String, required: true }, // base64-encoded image string
      }
    ].slice(0, 5), // max 5 documents

    discardedDeals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Deal", default: [] }],

    // OTP fields are available for all users.
    otp: { type: String }, // Last sent OTP
    otpExpiresAt: { type: Date }, // Expiry time for current OTP
    otpGeneratedAt: { type: Date }, // When was the OTP generated
    otpAttempts: { type: Number, default: 0 }, // Attempts for the current OTP

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
