// import mongoose from "mongoose";

// const citySchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       trim: true,
//     },
//     status: {
//       type: String,
//       enum: ["Active", "Inactive"],
//       default: "Active",
//     },
//   },
//   {
//     _id: false,
//   }
// );

// // Province schema: each province has a name, optional nickName, status, and cities (as embedded docs, array of citySchema)
// const provinceSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true,
//       unique: true,
//     },
//     nickName: {
//       type: String,
//       trim: true,
//       default: "",
//     },
//     status: {
//       type: String,
//       enum: ["Active", "Inactive"],
//       default: "Active",
//     },
//     cities: {
//       type: [citySchema],
//       default: [],
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// const Province = mongoose.model("Province", provinceSchema);

// export default Province;

import mongoose from "mongoose";

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  }
  // NOTE: removed `{ _id: false }`. The existing editCity/deleteCity routes
  // look cities up by name (not _id) so this doesn't fix a broken route the
  // way it did for common.schema.js — but leaving _id off means renaming a
  // city has no stable identifier to hang onto mid-request. Adding _id here
  // is forward-compatible; it doesn't break your current name-based routes.
);

// Province schema: each province has a name, country, optional nickName,
// status, and cities (as embedded docs, array of citySchema).
const provinceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    nickName: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    cities: {
      type: [citySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Uniqueness is now scoped to (name, country) rather than name alone —
// e.g. two different countries could each have a province/state called
// "Central", and that's not a conflict. Case sensitivity is handled at the
// application layer (controller does case-insensitive regex checks); this
// index is a DB-level backstop against exact-match race conditions.
provinceSchema.index({ name: 1, country: 1 }, { unique: true });

const Province = mongoose.model("Province", provinceSchema);

export default Province;