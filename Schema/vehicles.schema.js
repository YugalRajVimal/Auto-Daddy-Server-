import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema(
  {
    licensePlateNo: { type: String, required: true }, // Vehicle license plate number
    licensePlateFrontImagePath: { type: String, default: null }, // Path or URL to license plate image
    licensePlateBackImagePath: { type: String, default: null }, // Path or URL to license plate image

    vinNo: { type: String, required: true }, // Vehicle Identification Number (VIN)
    make: {
      name: { type: String, required: true }, // Car make/brand
      model: { type: String, required: true }  // Car model
    },
    year: { type: Number, required: true }, // Model year
    odometerReading: { type: Number, default: 0 }, // Odometer reading (kilometers/miles)
    carImages: {
      type: [String],
      default: [],
      validate: [arr => arr.length <= 5, '{PATH} exceeds the limit of 5 images']
    } // Array of up to 5 image URLs
  },
  {
    timestamps: true
  }
);

export const VehicleModel = mongoose.model("Vehicle", VehicleSchema);
