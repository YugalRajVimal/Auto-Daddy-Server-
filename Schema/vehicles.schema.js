import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema(
  {
    carCompany: { type: mongoose.Schema.Types.ObjectId, ref: "CarCompany", required: false }, // Reference to car company

    licensePlateNo: { type: String, required: true }, // Vehicle license plate number
    vinNo: { type: String, required: true }, // Vehicle Identification Number (VIN)
    make: {
      name: { type: String, required: true }, // Car make/brand
      model: { type: String, required: true }  // Car model
    },
    year: { type: Number, required: true }, // Model year
    odometerReading: { type: Number, default: 0 }, // Odometer reading (kilometers/miles)
    dueOdometerReading: { type: Number, default: null }, // Odometer reading for next service due
  },
  {
    timestamps: true
  }
);

export const VehicleModel = mongoose.model("Vehicle", VehicleSchema);
