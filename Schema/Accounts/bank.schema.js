import mongoose from "mongoose";

const bankSchema = new mongoose.Schema(
  {
    BankName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: false,
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
    Interac: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Bank = mongoose.models.Bank || mongoose.model("Bank", bankSchema);

export default Bank;