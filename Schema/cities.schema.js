import mongoose from "mongoose";

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    }
  },
  {
    timestamps: true,
  }
);

citySchema.index({ name: 1 }, { unique: true });

const City = mongoose.model("City", citySchema);

export default City;