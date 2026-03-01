import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productImage: {
    type: String,
    required: false,
    default: ''
  },
  description: {
    type: String,
    default: "",
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  dealEnabled: {
    type: Boolean,
    default: false,
  },
  offersEndOnDate: {
    type: Date,
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Services",
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessProfile",
    required: false
  },
}, { timestamps: true });

const DealModel = mongoose.model("Deal", dealSchema);
export default DealModel;
