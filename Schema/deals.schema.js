import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  value: {
    type: String,
    enum: ["categories", "subcategories", "all"],
    required: true,
    // Defines the deal's scope: applies to categories, subcategories, or all
  },
  // If value is 'categories' or 'subcategories', optionally store their respective id (ObjectId or String)
  valueId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      return this.value === "categories" || this.value === "subcategories";
    },
    refPath: 'value', // Will reference either categories or subcategories model if needed for population
  },
  percentageDiscount: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  dealEnabled: {
    type: Boolean,
    default: false,
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: false
  },
  additionalDetails: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
}, { timestamps: true });

const DealModel = mongoose.model("Deal", dealSchema);
export default DealModel;
