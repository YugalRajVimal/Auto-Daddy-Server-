import mongoose from "mongoose";

const dealerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  dealership: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    // Optional street address for the dealer/dealership
    type: String,
    trim: true
  },
  websiteUrl: {
    type: String,
    trim: true
  },
  image: {
    // This can be image path to the dealership or dealer's image
    type: String,
    trim: true
  },
  date: {
    // Represents the date the dealer joined or the record was created
    type: Date,
    required: true,
    default: Date.now
  },
  listings: {
    // Number of car listings by this dealer
    type: Number,
    default: 0
  },
  leads: {
    // Number of leads received by this dealer
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Suspended', 'Deleted'],
    default: 'Active'
  }
}, {
  timestamps: true // To track createdAt and updatedAt
});

const Dealer = mongoose.model('Dealer', dealerSchema);

export default Dealer;