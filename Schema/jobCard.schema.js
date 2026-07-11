// // // import mongoose from 'mongoose';
// // // const { Schema, Types } = mongoose;

// // // /**
// // //  * JobCard Schema:
// // //  * - customerId: ObjectId of the customer
// // //  * - vehicleId: ObjectId of the vehicle
// // //  * - odometerReading: Number
// // //  * - issueDescription: String
// // //  * - serviceType: Enum (Repair, Maintenance, Inspection)
// // //  * - priorityLevel: Enum (Normal, Urgent)
// // //  * - services: Array of { id: ObjectId (Service), subServices: [{ id: ObjectId (subService), price: Number, labourCharge: Number, labourDuration: String }] }
// // //  * - additionalNotes: String
// // //  * - vehiclePhotos: Array of file paths or URLs (multiple vehicle photos)
// // //  * - technicalRemarks: String
// // //  * - labourCharge: Number
// // //  * - labourDuration: String
// // //  * - jobNo: String (unique generated job number for this job card)
// // //  */
// // // // Match the subService and myService schemas from bussiness-profile.js

// // // const selectedSubServiceSchema = new Schema({
// // //   name: { type: String, required: true },
// // //   desc: { type: String },
// // //   price: { type: Number },
// // //   labourCharge: { type: Number }, // Added individual labourCharge for subService
// // //   labourDuration: { type: String }, // Added individual labourDuration for subService
// // // }, { _id: false });

// // // const jobServiceSchema = new Schema({
// // //   service: { type: Types.ObjectId, ref: 'Services', required: true }, // reference to Services collection
// // //   subServices: [selectedSubServiceSchema] // Embedded subservice selection
// // // }, { _id: false });

// // // const JobCardSchema = new Schema({
// // //     business: { type: Types.ObjectId, required: true, ref: 'BusinessProfile' },
// // //     customerId: { type: Types.ObjectId, required: true, ref: 'User' },
// // //     vehicleId: { type: Types.ObjectId, required: true, ref: 'Vehicle' },
// // //     odometerReading: { type: Number },
// // //     dueOdometerReading: { type: Number },
// // //     issueDescription: { type: String },
// // //     serviceType: {
// // //         type: String,
// // //         required: true,
// // //         enum: ['Repair', 'Maintenance', 'Inspection']
// // //     },
// // //     priorityLevel: {
// // //         type: String,
// // //         required: true,
// // //         enum: ['Normal', 'Urgent']
// // //     },
// // //     services: [jobServiceSchema],
// // //     additionalNotes: { type: String },
// // //     vehiclePhotos: {
// // //         type: [String],
// // //         default: [],
// // //         validate: [arr => arr.length <= 5, '{PATH} exceeds the limit of 5 images']
// // //     }, // Array of up to 5 image URLs or file paths
// // //     dealApplied: {
// // //         name: { type: String }, // e.g., "New Customer Discount"
// // //         percentageDiscount: { type: Number }, // e.g., 10
// // //         dealCode: { type: String } // e.g., "FIRST-10"
// // //     },
// // //     totalPayableAmount: { type: Number }, // Total amount after all discounts applied
// // //     paymentStatus: {
// // //         type: String,
// // //         enum: ['Pending', 'Paid', 'Cancelled'],
// // //         default: 'Pending'
// // //     },
// // //     paymentMethod: {
// // //         type: String,
// // //         enum: ['Cash', 'Online'],
// // //         default: 'Cash'
// // //     },
// // //     unpaid: {
// // //         type: Boolean,
// // //       },
// // //     technicalRemarks: { type: String },
// // //     // New fields added below:
// // //     labourCharge: { type: Number }, // Labour charge for the job
// // //     labourDuration: { type: String }, // Labour duration for the job
// // //     status: {
// // //         type: String,
// // //         enum: ['Pending', 'Approved', 'Rejected', 'AutoRejected'],
// // //         default: 'Pending',
// // //         description: 'Stores if the job card is approved from customer or not'
// // //     },
// // //     jobNo: { 
// // //         type: String, 
// // //         unique: true, 
// // //         sparse: true,
// // //         index: true,
// // //         description: 'Auto-incremented job number in format like J00001'
// // //     }, // Unique Job Number (to be generated on creation)
// // // images: {
// // //     type: [String],
// // //     default: [],
// // //     validate: [arr => arr.length <= 5, '{PATH} exceeds the limit of 5 images']
// // // }, // Array of up to 5 image URLs or file paths
// // // }, { timestamps: true });

// // // const JobCard = mongoose.model("JobCard", JobCardSchema);
// // // export default JobCard;


// // import mongoose from 'mongoose';
// // const { Schema, Types } = mongoose;

// // /**
// //  * One line item on a job card. `service` is an optional link back to the
// //  * Services collection — used at creation/edit time to check odoOutRequired
// //  * on that service and to default `category`. category/desc/unitCost/qty/
// //  * amount are always stored as plain values (snapshot), so the job card
// //  * stays correct even if the underlying Services doc changes later.
// //  */
// // const jobCardServiceSchema = new Schema({
// //   service: { type: Types.ObjectId, ref: 'Services' },
// //   category: { type: String, required: true },
// //   desc: { type: String },
// //   unitCost: { type: Number, required: true, min: 0 },
// //   qty: { type: Number, required: true, min: 1, default: 1 },
// //   amount: { type: Number, required: true, min: 0 }, // server-computed: unitCost * qty
// //   odoOutReading: { type: Number }, // required only when the referenced Service has odoOutRequired: true
// // }, { _id: false });

// // const JobCardSchema = new Schema({
// //   business: { type: Types.ObjectId, required: true, ref: 'BusinessProfile' },

// //   // Per-shop sequential number, starts at 1 for each business (see jobCardCounter.schema.js)
// //   jobCardNo: { type: Number, required: true },

// //   // Customer can be a real registered User OR a shop-onboarded customer with no account
// //   customerType: { type: String, enum: ['registered', 'onboarded'], required: true },
// //   customerId: { type: Types.ObjectId, ref: 'User' }, // set when customerType === 'registered'
// //   onboardedCustomerId: { type: Types.ObjectId }, // set when customerType === 'onboarded' (subdoc _id in BusinessProfile.myOnboardedCustomers)

// //   vehicleId: { type: Types.ObjectId, required: true, ref: 'Vehicle' },
// //   licensePlateNo: { type: String, required: true }, // snapshot at creation time

// //   // Customer snapshot — kept even if the real profile changes later
// //   customerName: { type: String, required: true },
// //   phone: { type: String, required: true },
// //   email: { type: String },
// //   city: { type: String },

// //   approvedByCustomer: { type: Boolean, default: false },
// //   approvalTime: { type: Date },

// //   date: { type: Date, default: Date.now },
// //   odoIn: { type: Number },

// //   services: { type: [jobCardServiceSchema], default: [] },

// //   bank: { type: Types.ObjectId, ref: 'AutoShopBank' }, // optional link to the actual bank account
// //   bankName: { type: String }, // snapshot of bank.BankName at time of save
// //   bankRefId: { type: String }, // free-text payment/transaction reference

// //   labourCharge: { type: Number, default: 0 },
// //   terms: { type: String },

// //   totalAmount: { type: Number }, // computed: sum(services.amount) + labourCharge (see pre-save hook)

// //   sendForApproval: { type: Boolean, default: false },
// //   sendForApprovalAt: { type: Date }, // used for the 7-day auto-reject window

// //   status: {
// //     type: String,
// //     enum: ['pending', 'autoRejected', 'convertedToInvoice', 'CashPaid'],
// //     default: 'pending',
// //   },
// // }, { timestamps: true });

// // // Each shop's job card numbers are independent of every other shop's
// // JobCardSchema.index({ business: 1, jobCardNo: 1 }, { unique: true });

// // JobCardSchema.pre('save', function (next) {
// //   const servicesTotal = (this.services || []).reduce((sum, s) => sum + (s.amount || 0), 0);
// //   this.totalAmount = servicesTotal + (this.labourCharge || 0);
// //   next();
// // });

// // const JobCard = mongoose.models.JobCard || mongoose.model('JobCard', JobCardSchema);
// // export default JobCard;

// import mongoose from 'mongoose';
// const { Schema, Types } = mongoose;

// /**
//  * One line item on a job card. `service` is an optional link back to the
//  * Services collection — used at creation/edit time to check odoOutRequired
//  * on that service and to default `category`. category/desc/unitCost/qty/
//  * amount are always stored as plain values (snapshot), so the job card
//  * stays correct even if the underlying Services doc changes later.
//  */
// const jobCardServiceSchema = new Schema({
//   service: { type: Types.ObjectId, ref: 'Services' },
//   category: { type: String, required: true },
//   desc: { type: String },
//   unitCost: { type: Number, required: true, min: 0 },
//   qty: { type: Number, required: true, min: 1, default: 1 },
//   amount: { type: Number, required: true, min: 0 }, // server-computed: unitCost * qty
//   odoOutReading: { type: Number }, // required only when the referenced Service has odoOutRequired: true
// }, { _id: false });

// const JobCardSchema = new Schema({
//   business: { type: Types.ObjectId, required: true, ref: 'BusinessProfile' },

//   // Per-shop sequential number, starts at 1 for each business (see jobCardCounter.schema.js)
//   jobCardNo: { type: Number, required: true },

//   // Customer can be a real registered User OR a shop-onboarded customer with no account
//   customerType: { type: String, enum: ['registered', 'onboarded'], required: true },
//   customerId: { type: Types.ObjectId, ref: 'User' }, // set when customerType === 'registered'
//   onboardedCustomerId: { type: Types.ObjectId }, // set when customerType === 'onboarded' (subdoc _id in BusinessProfile.myOnboardedCustomers)

//   vehicleId: { type: Types.ObjectId, required: true, ref: 'Vehicle' },
//   licensePlateNo: { type: String, required: true }, // snapshot at creation time

//   // Customer snapshot — kept even if the real profile changes later
//   customerName: { type: String, required: true },
//   phone: { type: String, required: true },
//   email: { type: String },
//   city: { type: String },

//   approvedByCustomer: { type: Boolean, default: false },
//   approvalTime: { type: Date },
//   rejectedAt: { type: Date }, // set when the customer explicitly rejects (distinct from the 7-day autoRejected timeout)

//   date: { type: Date, default: Date.now },
//   odoIn: { type: Number },

//   services: { type: [jobCardServiceSchema], default: [] },

//   bank: { type: Types.ObjectId, ref: 'AutoShopBank' }, // optional link to the actual bank account
//   bankName: { type: String }, // snapshot of bank.BankName at time of save

//   labourCharge: { type: Number, default: 0 },
//   terms: { type: String },

//   totalAmount: { type: Number }, // computed: sum(services.amount) + labourCharge (see pre-save hook)

//   sendForApproval: { type: Boolean, default: false },
//   sendForApprovalAt: { type: Date }, // used for the 7-day auto-reject window

//   status: {
//     type: String,
//     enum: ['pending', 'rejected', 'autoRejected', 'convertedToInvoice', 'CashPaid'],
//     default: 'pending',
//   },
//   invoicePaid: { type: Boolean, default: false },

// }, { timestamps: true });

// // Each shop's job card numbers are independent of every other shop's
// JobCardSchema.index({ business: 1, jobCardNo: 1 }, { unique: true });

// JobCardSchema.pre('save', function (next) {
//   const servicesTotal = (this.services || []).reduce((sum, s) => sum + (s.amount || 0), 0);
//   this.totalAmount = servicesTotal + (this.labourCharge || 0);
//   next();
// });

// const JobCard = mongoose.models.JobCard || mongoose.model('JobCard', JobCardSchema);
// export default JobCard;

import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * One doc per (business, year). Lets each shop owner choose their own
 * jobCardId prefix for a given calendar year (e.g. "ABC" for 2026), so
 * job card IDs are formatted as "ABC-1", "ABC-2", ... "ABC-137".
 *
 * The numeric part comes from JobCardCounter (Jobcardcounter.schema.js),
 * which is scoped to the business only — NOT to the year. This means the
 * sequence keeps climbing across years by default (e.g. "ABC-137" in 2026
 * can be followed by "XYZ-138" in 2027 if the owner picks a new prefix),
 * rather than resetting to 1 every January 1st.
 *
 * If you'd rather have the counter reset per year too (e.g. "XYZ-1" is
 * the first job card of 2027), scope JobCardCounter by { business, year }
 * instead of just { business } — see the note at the bottom of
 * jobCardIdentifier.helper.js for exactly what to change.
 */
const jobCardPrefixSchema = new Schema(
  {
    business: { type: Types.ObjectId, ref: "BusinessProfile", required: true },
    year: { type: Number, required: true }, // calendar year this prefix applies to
    prefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9]{1,10}$/, "Prefix must be 1-10 alphanumeric characters (A-Z, 0-9 only)"],
    },
  },
  { timestamps: true }
);

// One prefix per business per year — setJobCardPrefix() below relies on
// this for its upsert to behave as "create or overwrite this year's prefix".
jobCardPrefixSchema.index({ business: 1, year: 1 }, { unique: true });

const JobCardPrefix =
  mongoose.models.JobCardPrefix || mongoose.model("JobCardPrefix", jobCardPrefixSchema);

export default JobCardPrefix;

/**
 * Set (create or overwrite) the prefix for a business for a given year.
 * If year is omitted, defaults to the current calendar year.
 * Normalizes to uppercase, matching the schema's `uppercase: true`.
 */
export async function setJobCardPrefix(businessId, prefix, year) {
  const targetYear = year || new Date().getFullYear();
  const normalizedPrefix = String(prefix).trim().toUpperCase();

  const doc = await JobCardPrefix.findOneAndUpdate(
    { business: businessId, year: targetYear },
    { $set: { prefix: normalizedPrefix } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return doc;
}

/**
 * Get the prefix doc for a business for a given year (defaults to the
 * current year if omitted). Returns null if the shop owner hasn't set
 * a prefix for that year yet — callers decide how to handle that
 * (block job card creation vs. fall back to a default, see
 * jobCardIdentifier.helper.js).
 */
export async function getJobCardPrefixForYear(businessId, year) {
  const targetYear = year || new Date().getFullYear();
  return JobCardPrefix.findOne({ business: businessId, year: targetYear });
}