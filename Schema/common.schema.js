import mongoose from 'mongoose';

// 1. Subdocument Schemas for Each Type
// NOTE: removed `{ _id: false }` on all of these — without it, Mongoose
// never assigns an _id to embedded array items, which silently broke
// every edit/delete endpoint (findIndex on item._id always failed).

const thoughtOfTheDayItemSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    country: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    likes: { type: Number, default: 0 },
    image: { type: String, trim: true }
  }
);

const productFeatureItemSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    country: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    feature: { type: String, trim: true },
    image: { type: String, trim: true }
  }
);

const faqItemSchema = new mongoose.Schema(
  {
    role: { type: String, trim: true },
    date: { type: Date },
    question: { type: String, trim: true },
    answer: { type: String, trim: true }
  }
);

const privacyAndDisclaimerItemSchema = new mongoose.Schema(
  {
    date: { type: Date },
    country: { type: String, trim: true },
    type: { type: String, trim: true },
    description: { type: String, trim: true }
  }
);

const websiteTemplateItemSchema = new mongoose.Schema(
  {
    templateName: { type: String, trim: true },
    url: { type: String, trim: true },
    date: { type: Date },
    country: { type: String, trim: true },
    shopType: { type: String, trim: true }
  }
);

const invoiceTemplateItemSchema = new mongoose.Schema(
  {
    templateName: { type: String, trim: true },
    date: { type: Date },
    country: { type: String, trim: true },
    shopType: { type: String, trim: true },
    image: { type: String, trim: true }
  }
);

// 2. Main Common Schema

const commonSchema = new mongoose.Schema(
  {
    thoughtOfTheDay: {
      type: [thoughtOfTheDayItemSchema],
      default: []
    },
    productFeatures: {
      type: [productFeatureItemSchema],
      default: []
    },
    faqs: {
      type: [faqItemSchema],
      default: []
    },
    privacyAndDisclaimers: {
      type: [privacyAndDisclaimerItemSchema],
      default: []
    },
    websiteTemplates: {
      type: [websiteTemplateItemSchema],
      default: []
    },
    invoiceTemplates: {
      type: [invoiceTemplateItemSchema],
      default: []
    }
  },
  { timestamps: true }
);

const CommonModel = mongoose.model('Common', commonSchema);

export default CommonModel;