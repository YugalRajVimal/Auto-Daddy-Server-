import mongoose from 'mongoose';

const vehicleTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true
  },

}, { timestamps: true });

const VehicleType = mongoose.model('VehicleType', vehicleTypeSchema);

export default VehicleType;