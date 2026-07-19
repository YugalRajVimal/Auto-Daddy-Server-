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

const PAGE_SLUG_ENUM = [
  "Home - AutoShopOwner",
  "Profile - AutoShopOwner",
  "People - AutoShopOwner",
  "Services - AutoShopOwner",
  "JobCards - AutoShopOwner",
  "Wallet - AutoShopOwner",
  "MyWebsite - AutoShopOwner",
  "Reports - AutoShopOwner",
  "Deals - AutoShopOwner",
  "Help - AutoShopOwner",
  "Notifications - AutoShopOwner",

  "Home - Mechanic",
  "Profile - Mechanic",
  "People - Mechanic",
  "Services - Mechanic",
  "JobCards - Mechanic",
  "Wallet - Mechanic",
  "MyWebsite - Mechanic",
  "Reports - Mechanic",
  "Deals - Mechanic",
  "Help - Mechanic",
  "Notifications - Mechanic",


  "Home - CarOwner",
  "Profile - CarOwner",
  "MyVehicles - CarOwner",
  "Documents - CarOwner",
  "AutoShops - CarOwner",
  "Deals - CarOwner",
  "Expenses - CarOwner",
  "Digital Diary - CarOwner",
  "Reports - CarOwner",
  "Notifications - CarOwner",
  "Help - CarOwner"
];

const faqItemSchema = new mongoose.Schema(
  {
    role: { type: String, trim: true },
    date: { type: Date },
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
    pageSlug: { type: String, enum: PAGE_SLUG_ENUM }
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