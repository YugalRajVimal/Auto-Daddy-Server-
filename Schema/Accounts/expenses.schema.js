import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
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
    category: {
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
    byCheque: {
      type: Boolean,
      required: true,
      default: false,
    },
    account: {
      type: String,
      trim: true,
      required: function () {
        return this.byCheque === true;
      },
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

const Expense =
  mongoose.models.Expense || mongoose.model("Expense", expenseSchema);

export default Expense;