// import mongoose from "mongoose";

// const autoShopBankSchema = new mongoose.Schema(
//   {
//     BankName: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     openingBalance: {
//       type: Number,
//       required: true,
//       min: 0,
//     },
//     totalBalance: {
//       type: Number,
//       min: 0,
//     },
//     AccountName: {
//       type: String,
//       trim: true,
//     },
//     AccountNumber: {
//       type: String,
//       trim: true,
//     },
//     assignToInvoice: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// const AutoShopBank = mongoose.models.AutoShopBank || mongoose.model("AutoShopBank", autoShopBankSchema);

// export default AutoShopBank;

import mongoose from "mongoose";

const autoShopBankSchema = new mongoose.Schema(
  {
    // Added: owner reference — without this, bank accounts couldn't be
    // scoped to a specific shop.
    businessProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
      required: true,
    },
    BankName: {
      type: String,
      required: true,
      trim: true,
    },
    openingBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    totalBalance: {
      type: Number,
      min: 0,
    },
    AccountName: {
      type: String,
      trim: true,
    },
    AccountNumber: {
      type: String,
      trim: true,
    },
    assignToInvoice: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const AutoShopBank = mongoose.models.AutoShopBank || mongoose.model("AutoShopBank", autoShopBankSchema);

export default AutoShopBank;