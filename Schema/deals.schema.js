// import mongoose from 'mongoose';

// const selectedVehicleSchema = new mongoose.Schema(
//   {
//     id: {
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//     },
//     name: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     model: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     year: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//   },
//   { _id: false }
// );

// const dealSchema = new mongoose.Schema(
//   {
//     dealType: {
//       type: String,
//       required: true,
//       enum: ["Service", "Parts","Salvages"],
//     },
//     serviceId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Services",
//       required: function () {
//         return this.dealType === "Service";
//       },
//     },
//     partName: {
//       type: String,
//       required: function () {
//         return this.dealType === "Parts";
//       },
//       trim: true,
//     },
//     description: {
//       type: String,
//       required: true,
//       trim: true,
//       default: "",
//     },
//     selectedVehicle: {
//       type: selectedVehicleSchema,
//     },
//     originalPrice: {         // <-- Added original price field
//       type: Number,
//       required: true,
//       min: 0,
//     },
//     discountedPrice: {
//       type: Number,
//       required: true,
//       min: 0,
//     },
//     offerEndsOnDate: {
//       type: Date,
//       required: true,
//     },
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "BusinessProfile",
//       required: true,
//     },
//     dealImage: {
//       type: String,
//       required: false,
//       trim: true,
//       default: null,
//     },
//   },
//   { timestamps: true }
// );

// const DealModel = mongoose.model("Deal", dealSchema);
// export default DealModel;


import mongoose from "mongoose";

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
      enum: ["Service", "Parts", "Salvages"],
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Services",
      required: function () {
        return this.dealType === "Service";
      },
    },
    // NEW: was referenced by the controller (createDeal/editDeal) but
    // missing from the schema, so it was being silently stripped on save.
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: function () {
        return this.dealType === "Parts" || this.dealType === "Salvages";
      },
    },
    partName: {
      type: String,
      // FIX: was only required for "Parts" — Salvages needs it too.
      required: function () {
        return this.dealType === "Parts" || this.dealType === "Salvages";
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
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
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
    dealImage: {
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