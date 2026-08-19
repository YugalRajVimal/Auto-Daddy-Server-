

import express from 'express';
import { makeCommonRouter } from './makeCommonRouter.js';

const commonRoutes = express.Router();

// Each segment maps to one collection in CommonModel AND one home.<subNav>
// permission module. Final paths (mounted at /admin/common in admin.routes.js):
//   /admin/common/thought-of-the-day     -> home.thoughtOfDay
//   /admin/common/product-features       -> home.features
//   /admin/common/faqs                   -> home.faqs
//   /admin/common/privacy-and-disclaimers -> home.privacy
//   /admin/common/website-templates      -> home.websiteTemplate
//   /admin/common/invoice-templates      -> home.invoiceTemplate
commonRoutes.use('/thought-of-the-day', makeCommonRouter('thoughtOfTheDay', 'thoughtImage', 'thoughtOfDay'));
commonRoutes.use('/product-features', makeCommonRouter('productFeatures', 'featureImage', 'features'));
commonRoutes.use('/faqs', makeCommonRouter('faqs', null, 'faqs'));
commonRoutes.use('/privacy-and-disclaimers', makeCommonRouter('privacyAndDisclaimers', null, 'privacy'));
commonRoutes.use('/website-templates', makeCommonRouter('websiteTemplates', null, 'websiteTemplate'));
commonRoutes.use('/invoice-templates', makeCommonRouter('invoiceTemplates', null, 'invoiceTemplate'));

export default commonRoutes;