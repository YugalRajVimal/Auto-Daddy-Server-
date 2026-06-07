import mongoose from 'mongoose';

const AdsSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Deals', 'Ads', 'Calendor'],
      required: true,
    },
    imageUpload: {
      type: String, // store image URL or filename
      required: true,
    },
    websiteURL: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Ads', AdsSchema);