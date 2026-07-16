import mongoose from "mongoose";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const leadSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Please provide a valid email address."],
    },
    website: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    sentTo: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      trim: true,
      enum: ["Pending", "Visited", "Completed"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

const Lead = mongoose.models.Lead || mongoose.model("Lead", leadSchema);

export default Lead;