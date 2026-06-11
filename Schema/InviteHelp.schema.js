import mongoose from "mongoose";

const InviteHelpSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
    },
    audioBlob: {
      // Store audio as a buffer (binary) or as a String (e.g., S3 URL), adjust as needed
      type: Buffer,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["carowner", "autoshopowner"],
    },
    to: {
      type: String,
      enum: ['Admin', 'AutoShopOwner'],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InviteHelp", InviteHelpSchema);