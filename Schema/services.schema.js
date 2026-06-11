
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
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
  },
  subServices: [subServiceSchema],
});

export default mongoose.model("Services", servicesSchema);
