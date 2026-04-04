import mongoose from 'mongoose';
const { Schema, Types } = mongoose;

/**
 * JobCard Schema:
 * - customerId: ObjectId of the customer
 * - vehicleId: ObjectId of the vehicle
 * - odometerReading: Number
 * - issueDescription: String
 * - serviceType: Enum (Repair, Maintenance, Inspection)
 * - priorityLevel: Enum (Normal, Urgent)
 * - services: Array of { id: ObjectId (Service), subServices: [{ id: ObjectId (subService), price: Number }] }
 * - additionalNotes: String
 * - vehiclePhotos: Array of file paths or URLs (multiple vehicle photos)
 * - technicalRemarks: String
 * - labourCharge: Number
 * - labourDuration: String
 * - jobNo: String (unique generated job number for this job card)
 */
// Match the subService and myService schemas from bussiness-profile.js

const selectedSubServiceSchema = new Schema({
  name: { type: String, required: true },
  desc: { type: String },
  price: { type: Number },
}, { _id: false });

const jobServiceSchema = new Schema({
  service: { type: Types.ObjectId, ref: 'Services', required: true }, // reference to Services collection
  subServices: [selectedSubServiceSchema] // Embedded subservice selection
}, { _id: false });

const JobCardSchema = new Schema({
    business: { type: Types.ObjectId, required: true, ref: 'BusinessProfile' },
    customerId: { type: Types.ObjectId, required: true, ref: 'User' },
    vehicleId: { type: Types.ObjectId, required: true, ref: 'Vehicle' },
    odometerReading: { type: Number },
    dueOdometerReading: { type: Number },
    issueDescription: { type: String },
    serviceType: {
        type: String,
        required: true,
        enum: ['Repair', 'Maintenance', 'Inspection']
    },
    priorityLevel: {
        type: String,
        required: true,
        enum: ['Normal', 'Urgent']
    },
    services: [jobServiceSchema],
    additionalNotes: { type: String },
    vehiclePhotos: {
        type: [String],
        default: [],
        validate: [arr => arr.length <= 5, '{PATH} exceeds the limit of 5 images']
    }, // Array of up to 5 image URLs or file paths
    dealApplied: {
        name: { type: String }, // e.g., "New Customer Discount"
        percentageDiscount: { type: Number }, // e.g., 10
        dealCode: { type: String } // e.g., "FIRST-10"
    },
    totalPayableAmount: { type: Number }, // Total amount after all discounts applied
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Cancelled'],
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Online'],
        default: 'Cash'
    },
    unpaid: {
        type: Boolean,
      },
    technicalRemarks: { type: String },
    // New fields added below:
    labourCharge: { type: Number }, // Labour charge for the job
    labourDuration: { type: String }, // Labour duration for the job
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
        description: 'Stores if the job card is approved from customer or not'
    },
    jobNo: { 
        type: String, 
        unique: true, 
        sparse: true,
        index: true,
        description: 'Auto-incremented job number in format like J00001'
    }, // Unique Job Number (to be generated on creation)
}, { timestamps: true });

const JobCard = mongoose.model("JobCard", JobCardSchema);
export default JobCard;
