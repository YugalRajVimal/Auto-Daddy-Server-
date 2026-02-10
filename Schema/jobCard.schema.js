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
 */
const subServiceSelectionSchema = new Schema({
    id: { type: Types.ObjectId, required: true, ref: 'Services.services' }, // reference to subService's _id INSIDE the parent service
    price: { type: Number }
    ,
    discountedPrice: { type: Number }, // discounted price after applying discount, optional
    discountAmount: { type: Number }   // discount amount applied to this subservice, optional
}, { _id: false });

const jobServiceSchema = new Schema({
    id: { type: Types.ObjectId, required: true, ref: 'Services' }, // reference to service's _id
    subServices: [subServiceSelectionSchema]
}, { _id: false });

const JobCardSchema = new Schema({
    business:{ type: Types.ObjectId, required: true, ref: 'BusinessProfile' },
    customerId: { type: Types.ObjectId, required: true, ref: 'User' },
    vehicleId: { type: Types.ObjectId, required: true, ref: 'Vehicle' },
    odometerReading: { type: Number },
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
    
    technicalRemarks: { type: String }
}, { timestamps: true });

const JobCard = mongoose.model("JobCard", JobCardSchema);
export default JobCard;
