import mongoose from "mongoose";

const carModelSchema = new mongoose.Schema({
  modelName: {
    type: String,
    required: true,
    trim: true,
  },
  years: [
    {
      type: Number,
      required: true,
    },
  ],
});

const carCompanySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    models: [carModelSchema],
  },
  {
    timestamps: true,
  }
);

const CarCompany = mongoose.model("CarCompany", carCompanySchema);

export default CarCompany;