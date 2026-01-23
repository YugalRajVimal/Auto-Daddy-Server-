import mongoose from "mongoose";

const ReportsSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    autoShopId: { type: mongoose.Schema.Types.ObjectId, ref: "AutoShop", required: true },
    date: { type: Date, required: true },
    heading: { type: String, required: true },
    odometerReading: { type: String, required: true },
    invoiceId: { type: String, required: true },
    amount: { type: String, required: true },
    billImagePath: { type: String, required: false },
    services: [
      {
        type: {
          type: String,
          required: true
        },
        value: {
          type: String,
          enum: ["Yes", "No"],
          required: true
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

export const ReportsModel = mongoose.model("Report", ReportsSchema);
