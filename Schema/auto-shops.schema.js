import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: String, required: false }, // could be ref or just name
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" },
    date: { type: Date, default: Date.now }
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: false }
  },
  { _id: false }
);

const workingHourSchema = new mongoose.Schema(
  {
    day: { type: String, required: true }, // e.g. "Monday"
    open: { type: String, required: true }, // e.g. "09:00"
    close: { type: String, required: true } // e.g. "18:00"
  },
  { _id: false }
);

const autoShopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    location: {
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
      // Optionally, could add geo index
    },
    websiteLink: { type: String, required: false },
    tagline: { type: String, required: false },
    workingHours: [workingHourSchema], // Array, one for each day
    workingDays: [{ type: String }], // e.g. ["Monday", "Tuesday", ...]
    reviews: [reviewSchema],
    services: [serviceSchema]
  },
  { timestamps: true }
);

const AutoShopModel = mongoose.model("AutoShop", autoShopSchema);
export default AutoShopModel;
