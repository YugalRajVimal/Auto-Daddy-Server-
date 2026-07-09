// import mongoose from "mongoose";

// const autoShoExpenseSchema = new mongoose.Schema(
//   {
//     date: {
//       type: Date,
//       required: true,
//     },
//     vendor: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     amount: {
//       type: Number,
//       required: true,
//       min: 0,
//     },
//     category: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     subCategory: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     notes: {
//       type: String,
//       trim: true,
//     },
//     gst: {
//       type: Number,
//       min: 0,
//     },
//     billNumber: {
//       type: String,
//       trim: true,
//     },
//     account: {
//       type: String,
//       trim: true,
//     },
//     imagePath: {
//       type: String,
//       trim: true,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// const AutoShopExpense =
//   mongoose.models.AutoShopExpense || mongoose.model("AutoShopExpense", autoShoExpenseSchema);

// export default AutoShopExpense;

import mongoose from "mongoose";

const autoShopExpenseSchema = new mongoose.Schema(
  {
    // Added: owner reference — without this, expenses couldn't be
    // scoped to a specific shop.
    businessProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    vendor: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    subCategory: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    gst: {
      type: Number,
      min: 0,
    },
    billNumber: {
      type: String,
      trim: true,
    },
    account: {
      type: String,
      trim: true,
    },
    imagePath: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const AutoShopExpense =
  mongoose.models.AutoShopExpense || mongoose.model("AutoShopExpense", autoShopExpenseSchema);

export default AutoShopExpense;