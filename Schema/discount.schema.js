import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema({
  discountEnabled: {
    type: Boolean,
    default: false
  },
  discount: {
    type: Number,
    min: 0,
    max: 100
  },
  couponCode: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
});

const DiscountModel = mongoose.model("Discount", discountSchema);
export default DiscountModel;
