import mongoose from "mongoose";

// Helper to generate array of years from 1990 to current year
const getYears1990ToCurrent = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = 1990; year <= currentYear; year++) {
    years.push(year);
  }
  return years;
};

const carModelSchema = new mongoose.Schema(
  {
    modelName: {
      type: String,
      required: true,
      trim: true,
    },
    years: {
      type: [Number],
      default: getYears1990ToCurrent,
    },
  },
  { _id: false }
);

const carCompanySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    brandLogo: {
      type: String,
      default: null, // URL or path to the brand logo (optional, can be null)
    },
    models: [carModelSchema],
  },
  {
    timestamps: true,
  }
);

const CarCompany = mongoose.model("CarCompany", carCompanySchema);

export default CarCompany;