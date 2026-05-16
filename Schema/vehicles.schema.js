import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema(
  {
    licensePlateNo: { type: String, required: true }, // Vehicle license plate number

    vinNo: { type: String, required: true }, // Vehicle Identification Number (VIN)
    make: {
      name: { type: String, required: true }, // Car make/brand
      model: { type: String, required: true }  // Car model
    },
    year: { type: Number, required: true }, // Model year
    odometerReading: { type: Number, default: 0 }, // Odometer reading (kilometers/miles)
   
    disabled: { type: Boolean, default: false } // Whether the vehicle is disabled (soft-deleted/archived)
  },
  {
    timestamps: true
  }
);

export const VehicleModel = mongoose.model("Vehicle", VehicleSchema);
