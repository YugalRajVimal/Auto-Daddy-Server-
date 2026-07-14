import express from 'express';
import { getFaq, getPrivacyAndDisclaimer, getProductFeatures } from '../../Controllers/CarOwner/common.controller.js';

const commonRouter = express.Router();

// Retrieve FAQs for car owners (GET /api/faq?role=carowner)
commonRouter.get('/faq', getFaq);

// Retrieve Privacy and Disclaimer content (GET /api/privacy-and-disclaimer?country=canada&type=privacy)
commonRouter.get('/privacy-and-disclaimer', getPrivacyAndDisclaimer);

// Retrieve product features (GET /api/product-features?country=canada&role=carowner)
commonRouter.get('/product-features', getProductFeatures);

export default commonRouter;