// // // // import express from 'express';
// // // // import {
// // // //   fetchCommonCollection,
// // // //   addToCommonCollection,
// // // //   editCommonCollectionItem,
// // // //   deleteCommonCollectionItem
// // // // } from '../../Controllers/Admin/common.controller.js';

// // // // const thoughtOfTheDayRouter = express.Router();

// // // // const COLLECTION = 'thoughtOfTheDay';

// // // // // GET /admin/thought-of-the-day?country=&date=
// // // // thoughtOfTheDayRouter.get('/', (req, res) => {
// // // //   // Proxy to generic fetch, injecting collection param
// // // //   req.params.collection = COLLECTION;
// // // //   fetchCommonCollection(req, res);
// // // // });

// // // // // POST /admin/thought-of-the-day
// // // // thoughtOfTheDayRouter.post('/', (req, res) => {
// // // //   req.params.collection = COLLECTION;
// // // //   addToCommonCollection(req, res);
// // // // });

// // // // // PUT /admin/thought-of-the-day/:id
// // // // thoughtOfTheDayRouter.put('/:id', (req, res) => {
// // // //   req.params.collection = COLLECTION;
// // // //   req.params.subdocId = req.params.id;
// // // //   editCommonCollectionItem(req, res);
// // // // });

// // // // // DELETE /admin/thought-of-the-day/:id
// // // // thoughtOfTheDayRouter.delete('/:id', (req, res) => {
// // // //   req.params.collection = COLLECTION;
// // // //   req.params.subdocId = req.params.id;
// // // //   deleteCommonCollectionItem(req, res);
// // // // });

// // // // export default thoughtOfTheDayRouter;

// // // import express from 'express';
// // // import {
// // //   fetchCommonCollection,
// // //   addToCommonCollection,
// // //   editCommonCollectionItem,
// // //   deleteCommonCollectionItem
// // // } from '../../Controllers/Admin/common.controller.js';

// // // /**
// // //  * Builds a router bound to one collection name, so we don't repeat the
// // //  * same 4 routes 6 times with copy-paste risk.
// // //  *
// // //  * Usage:
// // //  *   const thoughtOfTheDayRouter = makeCommonRouter('thoughtOfTheDay');
// // //  */
// // // export function  commonRouter(collectionName) {
// // //   const router = express.Router();

// // //   router.get('/', (req, res) => {
// // //     req.params.collection = collectionName;
// // //     fetchCommonCollection(req, res);
// // //   });

// // //   router.post('/', (req, res) => {
// // //     req.params.collection = collectionName;
// // //     addToCommonCollection(req, res);
// // //   });

// // //   router.put('/:id', (req, res) => {
// // //     req.params.collection = collectionName;
// // //     req.params.subdocId = req.params.id;
// // //     editCommonCollectionItem(req, res);
// // //   });

// // //   router.delete('/:id', (req, res) => {
// // //     req.params.collection = collectionName;
// // //     req.params.subdocId = req.params.id;
// // //     deleteCommonCollectionItem(req, res);
// // //   });

// // //   return router;
// // // }
// // import express from 'express';
// // import { makeCommonRouter } from './makeCommonRouter.js';

// // const commonRoutes = express.Router();

// // // Each segment maps to one collection in CommonModel.
// // // Final paths (mounted at /admin/common in admin.routes.js):
// // //   /admin/common/thought-of-the-day
// // //   /admin/common/product-features
// // //   /admin/common/faqs
// // //   /admin/common/privacy-and-disclaimers
// // //   /admin/common/website-templates
// // //   /admin/common/invoice-templates
// // commonRoutes.use('/thought-of-the-day', makeCommonRouter('thoughtOfTheDay'));
// // commonRoutes.use('/product-features', makeCommonRouter('productFeatures'));
// // commonRoutes.use('/faqs', makeCommonRouter('faqs'));
// // commonRoutes.use('/privacy-and-disclaimers', makeCommonRouter('privacyAndDisclaimers'));
// // commonRoutes.use('/website-templates', makeCommonRouter('websiteTemplates'));
// // commonRoutes.use('/invoice-templates', makeCommonRouter('invoiceTemplates'));

// // export default commonRoutes;

// import express from 'express';
// import { makeCommonRouter } from './makeCommonRouter.js';

// const commonRoutes = express.Router();

// // Each segment maps to one collection in CommonModel.
// // Final paths (mounted at /admin/common in admin.routes.js):
// //   /admin/common/thought-of-the-day
// //   /admin/common/product-features
// //   /admin/common/faqs
// //   /admin/common/privacy-and-disclaimers
// //   /admin/common/website-templates
// //   /admin/common/invoice-templates
// // Second argument = multer fieldname for optional image upload (FormData).
// // null = no image field on this collection, keep sending JSON as before.
// commonRoutes.use('/thought-of-the-day', makeCommonRouter('thoughtOfTheDay', 'thoughtImage'));
// commonRoutes.use('/product-features', makeCommonRouter('productFeatures', 'featureImage'));
// commonRoutes.use('/faqs', makeCommonRouter('faqs', null));
// commonRoutes.use('/privacy-and-disclaimers', makeCommonRouter('privacyAndDisclaimers', null));
// commonRoutes.use('/website-templates', makeCommonRouter('websiteTemplates', null));
// commonRoutes.use('/invoice-templates', makeCommonRouter('invoiceTemplates', null));

// export default commonRoutes;

// Routers/Admin/common.routes.js

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