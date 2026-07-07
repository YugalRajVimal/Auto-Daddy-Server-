import mongoose from "mongoose";

const incomeSchema = new mongoose.Schema(
  {
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
    paymentMode: {
      type: String,
      required: true,
      trim: true,
    },
    bank: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Income =
  mongoose.models.Income || mongoose.model("Income", incomeSchema);

export default Income;