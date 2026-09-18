import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * Singleton document (always _id: "platform-settings").
 * Every customisable number in the Wallet + Job Card + Website
 * subscription system lives here so Admin can change it without a
 * code deploy.
 */
const platformSettingsSchema = new Schema(
  {
    _id: { type: String, default: "platform-settings" },

    // --- Software trial ---
    trialDays: { type: Number, required: true, default: 15, min: 0 },

    // --- Wallet (Software / Job Cards) ---
    minWalletRechargeAmount: { type: Number, required: true, default: 100, min: 1 },
    perJobCardCharge: { type: Number, required: true, default: 1, min: 0 },
    walletCurrency: { type: String, default: "CAD" },

    // --- Website subscription (separate, optional) ---
    websiteSubscriptionPrice: { type: Number, required: true, default: 365, min: 0 },
    websiteSubscriptionDays: { type: Number, required: true, default: 365, min: 1 },
    websiteSubscriptionHstRate: { type: Number, required: true, default: 0.13, min: 0 },
  },
  { timestamps: true, _id: false }
);

const PlatformSettingsModel = mongoose.model("PlatformSettings", platformSettingsSchema);
export default PlatformSettingsModel;