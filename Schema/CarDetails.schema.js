import mongoose from 'mongoose';

const yearSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true
  }
}, { _id: false });

const modelSchema = new mongoose.Schema({
  modelName: {
    type: String,
    required: true,
    trim: true
  },
  years: {
    type: [Number],
    required: true,
    default: []
  }
}, { _id: false });

const carDetailsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  models: {
    type: [modelSchema],
    required: true,
    default: []
  }
}, { timestamps: true });

const CarDetailsModel = mongoose.model('CarDetails', carDetailsSchema);
export default CarDetailsModel;