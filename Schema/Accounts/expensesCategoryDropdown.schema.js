import mongoose from "mongoose";

// Schema for an expense subcategory
const expenseSubCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
  },
  { _id: false }
);

// Schema for an expense category, which contains subcategories
const expenseCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    subcategories: {
      type: [expenseSubCategorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

const ExpenseCategory = mongoose.model("ExpenseCategory", expenseCategorySchema);

export default ExpenseCategory;