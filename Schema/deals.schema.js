import mongoose from 'mongoose';

const selectedVehicleSchema = new mongoose.Schema(
  {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const dealSchema = new mongoose.Schema(
  {
    dealType: {
      type: String,
      required: true,
      enum: ["Service", "Parts"],
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Services",
      required: function () {
        return this.dealType === "Service";
      },
    },
    partName: {
      type: String,
      required: function () {
        return this.dealType === "Parts";
      },
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
    selectedVehicle: {
      type: selectedVehicleSchema,
    },
    discountedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    offerEndsOnDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
      required: true,
    },
    imagePath: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

const DealModel = mongoose.model("Deal", dealSchema);
export default DealModel;
