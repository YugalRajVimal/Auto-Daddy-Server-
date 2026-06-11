import mongoose from "mongoose";

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    _id: false,
  }
);

// Province schema: each province has a name, optional nickName, status, and cities (as embedded docs, array of citySchema)
const provinceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    nickName: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    cities: {
      type: [citySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Province = mongoose.model("Province", provinceSchema);

export default Province;