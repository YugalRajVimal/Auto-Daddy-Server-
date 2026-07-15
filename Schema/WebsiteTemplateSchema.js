import mongoose from "mongoose";

const WebsiteTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    desc: {
      type: String,
      required: true,
      trim: true,
    },

    templateLink: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      enum: ["India", "USA", "Canada"],
      required: true,
    },

    shopType: {
      type: [String],
      enum: ["autoShop", "tyreShop", "carWash", "towTruck"],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("WebsiteTemplate", WebsiteTemplateSchema);