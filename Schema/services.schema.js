
import mongoose from "mongoose";

// Schema for subService (with name and status)
const subServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
);

const servicesSchema = new mongoose.Schema({
  name: { type: String, required: true },
  shopType: {
    type: String,
    enum: ["autoShop", "tyreShop", "carWash", "towTruck"],
    required: true,
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
  },
  subServices: [subServiceSchema],
  odoOutRequired: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.model("Services", servicesSchema);
