import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  designation: { type: String },
  photo: { type: String } // URL or file path to the photo
});

const businessProfileSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const BusinessProfileModel = mongoose.model("BusinessProfile", businessProfileSchema);
export default BusinessProfileModel;
