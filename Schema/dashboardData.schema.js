import mongoose from 'mongoose';

const dashboardDataSchema = new mongoose.Schema({
  thoughtOfTheDay: {
    type: String,
    default: 'Push yourself, because no one else is going to do it for you.'
  },
  aboutUs: {
    heading: {
      type: String,
      default: 'About Our Auto Shop'
    },
    desc: {
      type: String,
      default: 'We are committed to providing top-notch automobile services for all makes and models. Customer satisfaction is our priority.'
    }
  },
  privacyPolicy: {
    heading: {
      type: String,
      default: 'Privacy Policy'
    },
    desc: {
      type: String,
      default: 'Your privacy is important to us. All your data is handled securely and never shared with third parties without consent.'
    }
  },
  FAQs: {
    heading: {
      type: String,
      default: 'Frequently Asked Questions'
    },
    desc: {
      type: String,
      default: '1. What services do you provide?\n2. What payment methods are accepted?\n3. How do I book a service?'
    }
  },
  documents: {
    heading: {
      type: String,
      default: 'Important Documents'
    },
    desc: {
      type: String,
      default: "Here you'll find warranty, registration, and insurance documents required for various services."
    }
  },
  disclaimer: {
    heading: {
      type: String,
      default: 'Disclaimer'
    },
    desc: {
      type: String,
      default: 'All repairs are subject to part availability. Pricing may vary based on model and condition.'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const DashboardDataModel = mongoose.model('DashboardData', dashboardDataSchema);
export default DashboardDataModel;