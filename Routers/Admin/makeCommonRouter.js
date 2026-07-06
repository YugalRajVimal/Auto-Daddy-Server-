// import express from 'express';
// import {
//   fetchCommonCollection,
//   addToCommonCollection,
//   editCommonCollectionItem,
//   deleteCommonCollectionItem
// } from '../../Controllers/Admin/common.controller.js';

// /**
//  * Builds a router bound to one collection name, so we don't repeat the
//  * same 4 routes 6 times with copy-paste risk.
//  *
//  * Usage:
//  *   const thoughtOfTheDayRouter = makeCommonRouter('thoughtOfTheDay');
//  */
// export function makeCommonRouter(collectionName) {
//   const router = express.Router();

//   router.get('/', (req, res) => {
//     req.params.collection = collectionName;
//     fetchCommonCollection(req, res);
//   });

//   router.post('/', (req, res) => {
//     req.params.collection = collectionName;
//     addToCommonCollection(req, res);
//   });

//   router.put('/:id', (req, res) => {
//     req.params.collection = collectionName;
//     req.params.subdocId = req.params.id;
//     editCommonCollectionItem(req, res);
//   });

//   router.delete('/:id', (req, res) => {
//     req.params.collection = collectionName;
//     req.params.subdocId = req.params.id;
//     deleteCommonCollectionItem(req, res);
//   });

//   return router;
// }

import express from 'express';
import {
  fetchCommonCollection,
  addToCommonCollection,
  editCommonCollectionItem,
  deleteCommonCollectionItem
} from '../../Controllers/Admin/common.controller.js';
import { upload } from '../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js';

/**
 * Builds a router bound to one collection name.
 *
 * @param {string} collectionName - e.g. 'thoughtOfTheDay'
 * @param {string|null} imageField - multer fieldname for optional image upload
 *   on this collection (e.g. 'thoughtImage'), or null if the collection has
 *   no image field at all (faqs, privacyAndDisclaimers).
 *
 * IMPORTANT: imageField must exactly match the fieldname the frontend sends
 * in FormData, and must exactly match what's registered in multer.config.js's
 * destination/fileFilter switch. A mismatch here silently drops the file —
 * keep this string in sync in all 3 places.
 */
export function makeCommonRouter(collectionName, imageField = null) {
  const router = express.Router();
  // Since the image is optional, upload.single(...) works fine even when
  // no file part is sent — req.file will just be undefined.
  const imageMiddleware = imageField ? upload.single(imageField) : (req, res, next) => next();

  router.get('/', (req, res) => {
    req.params.collection = collectionName;
    fetchCommonCollection(req, res);
  });

  router.post('/', imageMiddleware, (req, res) => {
    req.params.collection = collectionName;
    req.uploadedImageField = imageField;
    addToCommonCollection(req, res);
  });

  router.put('/:id', imageMiddleware, (req, res) => {
    req.params.collection = collectionName;
    req.params.subdocId = req.params.id;
    req.uploadedImageField = imageField;
    editCommonCollectionItem(req, res);
  });

  router.delete('/:id', (req, res) => {
    req.params.collection = collectionName;
    req.params.subdocId = req.params.id;
    deleteCommonCollectionItem(req, res);
  });

  return router;
}