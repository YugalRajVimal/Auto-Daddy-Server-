/**
 * seedExpenseCategories.js
 *
 * Seeds the ExpenseCategory collection with sample data.
 *
 * Usage:
 *   node seedExpenseCategories.js
 *
 * Env:
 *   MONGO_URI — your MongoDB connection string (defaults to
 *   mongodb://localhost:27017/your-db-name if not set — update the
 *   fallback below to match your actual DB name).
 *
 * NOTE: Adjust the import path for ExpenseCategory to match your
 * project's actual model location.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import ExpenseCategory from "../Schema/Accounts/expensesCategoryDropdown.schema.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/your-db-name";

const sampleCategories = [
  {
    name: "Office Supplies",
    subcategories: [
      { name: "Stationery" },
      { name: "Printer Ink" },
      { name: "Furniture" },
    ],
  },
  {
    name: "Utilities",
    subcategories: [
      { name: "Electricity" },
      { name: "Water" },
      { name: "Internet" },
    ],
  },
  {
    name: "Travel",
    subcategories: [
      { name: "Airfare" },
      { name: "Hotel" },
      { name: "Local Transport" },
      { name: "Meals" },
    ],
  },
  {
    name: "Vehicle Maintenance",
    subcategories: [
      { name: "Fuel" },
      { name: "Repairs" },
      { name: "Spare Parts" },
    ],
  },
  {
    name: "Marketing",
    subcategories: [
      { name: "Ads" },
      { name: "Print Materials" },
      { name: "Sponsorships" },
    ],
  },
  {
    name: "Salaries",
    subcategories: [], // no subcategories — tests the empty-array path
  },
  {
    name: "Miscellaneous",
    subcategories: [{ name: "Uncategorized" }],
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB: ${MONGO_URI}`);

    let created = 0;
    let skipped = 0;

    for (const cat of sampleCategories) {
      const existing = await ExpenseCategory.findOne({ name: cat.name });
      if (existing) {
        console.log(`Skipping "${cat.name}" — already exists.`);
        skipped += 1;
        continue;
      }
      await ExpenseCategory.create(cat);
      console.log(`Created "${cat.name}" with ${cat.subcategories.length} subcategor${cat.subcategories.length === 1 ? "y" : "ies"}.`);
      created += 1;
    }

    console.log(`\nDone. Created: ${created}, Skipped (already existed): ${skipped}.`);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

seed();