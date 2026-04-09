import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema({
  dealType: {
    type: String,
    required: true,
    enum: ['Service', 'Parts'],
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Services",
    required: function() { return this.dealType === 'Service'; }
  },
  partName: {
    type: String,
    required: function() { return this.dealType === 'Parts'; },
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    default: "",
  },
  vehicleTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VehicleType",
    required: false
  },
  discountedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  offerEndsOnDate: {
    type: Date,
    required: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  dealEnabled: {
    type: Boolean,
    required: true,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessProfile",
    required: true
  }
}, { timestamps: true });

const DealModel = mongoose.model("Deal", dealSchema);
export default DealModel;
