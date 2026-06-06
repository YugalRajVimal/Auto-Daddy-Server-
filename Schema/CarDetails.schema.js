import mongoose from 'mongoose';

// Helper to generate array of years from 1990 to current year
const getYears1990ToCurrent = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = 1990; year <= currentYear; year++) {
    years.push(year);
  }
  return years;
};

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
    default: getYears1990ToCurrent
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