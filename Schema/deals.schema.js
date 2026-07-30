

// import mongoose from "mongoose";

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
//       enum: ["Service", "Parts", "Salvages"],
//     },
//     serviceId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Services",
//       required: function () {
//         return this.dealType === "Service";
//       },
//     },
//     subServiceName:{
//       type: String
//     },
//     // NEW: was referenced by the controller (createDeal/editDeal) but
//     // missing from the schema, so it was being silently stripped on save.
//     vehicle: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Vehicle",
//       required: function () {
//         return this.dealType === "Parts" || this.dealType === "Salvages";
//       },
//     },
//     partName: {
//       type: String,
//       // FIX: was only required for "Parts" — Salvages needs it too.
//       required: function () {
//         return this.dealType === "Parts" || this.dealType === "Salvages";
//       },
//       trim: true,
//     },
//     description: {
//       type: String,
//       trim: true,
//       default: "",
//     },
//     selectedVehicle: {
//       type: selectedVehicleSchema,
//     },
//     originalPrice: {
//       type: Number,
//       min: 0,
//     },
//     discountedPrice: {
//       type: Number,
//       min: 0,
//     },
//     discountPercentage: {
//       type: Number,
//       min: 0,
//       max: 100,
//       required: function() {
//         return this.dealType === "Service";
//       },
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
    subServiceName:{
      type: String
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
      trim: true,
      default: "",
    },
    selectedVehicle: {
      type: selectedVehicleSchema,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      required: function() {
        return this.dealType === "Service";
      },
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
    // CHANGED: single dealImage (String) -> dealImages (up to 2 image paths).
    // A custom validator (rather than a hardcoded array length) keeps the
    // "max 2" rule enforceable from one place if it ever needs to change.
    dealImages: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length <= 2;
        },
        message: "A deal can have at most 2 images.",
      },
    },
  },
  { timestamps: true }
);

const DealModel = mongoose.model("Deal", dealSchema);
export default DealModel;