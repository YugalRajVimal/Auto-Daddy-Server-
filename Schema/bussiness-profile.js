import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

// Team Member Schema
const teamMemberSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  designation: { type: String },
  photo: { type: String } // URL or file path to the photo
});

// SubService Selection Schema: Each subservice is referenced by ObjectId (since subservices are embedded in Services)
const selectedSubServiceSchema = new Schema({
  subService: { type: Types.ObjectId, required: true } // Reference to subService's _id INSIDE the parent service
}, { _id: false });

// MyService Schema: Each entry references a main Service, and contains selected sub-services as ObjectIds
const myServiceSchema = new Schema({
  service: { type: Types.ObjectId, ref: 'Services', required: true }, // Reference to Services collection
  subServices: [selectedSubServiceSchema] // List of subService ObjectIds for this service
}, { _id: false });

// Business Profile Schema
const businessProfileSchema = new Schema({
  businessName: { type: String, required: true },
  businessAddress: { type: String, required: true },
  pincode: { type: String, required: true },
  businessMapLocation: {
    type: {
      lat: { type: Number }, // Latitude
      lng: { type: Number }  // Longitude
    },
    required: false
  },
  businessPhone: { type: String, required: true },
  businessEmail: { type: String, required: true },
  businessHSTNumber: { type: String },
  openHours: { type: String },         // e.g., "08:00-20:00"
  openDays: { type: [String] },        // e.g., ["Monday", "Tuesday", ...]
  teamMembers: [teamMemberSchema],
  businessLogo: { type: String },      // URL or file path to the logo

  // Nested myServices array, each containing a reference to a main service and selected subservices (nested like services schema)
  myServices: [myServiceSchema],

  // Add support for linking deals to this business profile
  myDeals: [{  type: Schema.Types.ObjectId, ref: "Deal" }],

  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const BusinessProfileModel = mongoose.model("BusinessProfile", businessProfileSchema);
export default BusinessProfileModel;
