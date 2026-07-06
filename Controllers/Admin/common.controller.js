// // import CommonModel from '../../Schema/common.schema.js';

// // /**
// //  * ================= Administration Controller for "Everything" =================
// //  * Handles CRUD operations on all `Common` embedded arrays:
// //  *    - Thought of the Day
// //  *    - Product Features
// //  *    - FAQs
// //  *    - Privacy & Disclaimers
// //  *    - Website Templates
// //  *    - Invoice Templates
// //  * ============================================================================
// //  *
// //  * All endpoints expect:
// //  *   - collection: one of "thoughtOfTheDay", "productFeatures", "faqs",
// //  *                 "privacyAndDisclaimers", "websiteTemplates", "invoiceTemplates"
// //  *   - For fetch: can provide optional filters via query params
// //  *   - For edit/delete: subdocId parameter (MongoDB objectId of array element)
// //  */

// // // ------------------- Helper: Allowed Collections -------------------

// // const allowedCollections = [
// //   "thoughtOfTheDay",
// //   "productFeatures",
// //   "faqs",
// //   "privacyAndDisclaimers",
// //   "websiteTemplates",
// //   "invoiceTemplates"
// // ];

// // // ------------------- Generic Fetch -------------------

// // /**
// //  * Fetch entries from the specified collection with optional query filters.
// //  * For "thoughtOfTheDay", "productFeatures", etc,
// //  *   - filters via query: key values to match in subdocuments
// //  */
// // export const fetchCommonCollection = async (req, res) => {
// //   try {
// //     const { collection } = req.params;
// //     if (!allowedCollections.includes(collection)) {
// //       return res.status(400).json({ error: `Invalid collection: ${collection}` });
// //     }
// //     const filters = { ...req.query };

// //     // Convert some fields, if present, to appropriate types
// //     if (filters.date) {
// //       // Support YYYY-MM-DD or ISO
// //       const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.date);
// //       if (m) {
// //         const [_, y, mth, d] = m;
// //         filters.date = {
// //           $gte: new Date(`${y}-${mth}-${d}T00:00:00.000Z`),
// //           $lte: new Date(`${y}-${mth}-${d}T23:59:59.999Z`)
// //         };
// //       } else {
// //         // fallback: parse as ISO
// //         const dt = new Date(filters.date);
// //         if (!isNaN(dt.getTime())) filters.date = dt;
// //       }
// //     }
// //     if (filters.country) {
// //       filters.country = { $regex: `^${filters.country.trim()}$`, $options: 'i' };
// //     }

// //     // Build aggregation to search in [collection] array
// //     const pipeline = [
// //       { $unwind: `$${collection}` },
// //       { $replaceRoot: { newRoot: `$${collection}` } }
// //     ];
// //     if (Object.keys(filters).length > 0) {
// //       pipeline.push({ $match: filters });
// //     }

// //     const results = await CommonModel.aggregate(pipeline);
// //     if (results.length === 0) {
// //       return res.status(404).json({ message: `No entries found in ${collection}.` });
// //     }
// //     res.json(results);
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ------------------- Generic Add -------------------

// // /**
// //  * Add a new subdocument to a collection
// //  * Expects: { ...fields... } in body
// //  * Path param: :collection
// //  */
// // export const addToCommonCollection = async (req, res) => {
// //   try {
// //     const { collection } = req.params;
// //     if (!allowedCollections.includes(collection)) {
// //       return res.status(400).json({ error: `Invalid collection: ${collection}` });
// //     }
// //     const doc = { ...req.body };

// //     // Some required fields handling for certain collections
// //     if (collection === "thoughtOfTheDay") {
// //       if (!doc.date || !doc.country || !doc.subject) {
// //         return res.status(400).json({ error: 'Date, country, and subject are required.' });
// //       }
// //       doc.country = doc.country.trim();
// //       doc.subject = doc.subject.trim();
// //       if (doc.notes) doc.notes = doc.notes.trim();
// //       if (doc.image) doc.image = doc.image.trim();
// //       doc.date = new Date(doc.date);

// //       // Uniqueness check on date+country
// //       const exists = await CommonModel.findOne({ [`${collection}`]: { $elemMatch: { date: doc.date, country: doc.country } } });
// //       if (exists) {
// //         return res.status(409).json({ error: "Entry already exists for this date and country." });
// //       }
// //     }
// //     // Add similar validation for other collections if desired

// //     // Find/create Common doc and push
// //     let common = await CommonModel.findOne();
// //     if (!common) {
// //       common = new CommonModel();
// //     }
// //     common[collection].push(doc);
// //     await common.save();

// //     // Return the newly added element (it is last in array)
// //     res.status(201).json(common[collection][common[collection].length - 1]);
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ------------------- Generic Edit -------------------

// // /**
// //  * Edit a subdocument in a collection by _id.
// //  * Path params: :collection, :subdocId
// //  * Body: fields to update
// //  */
// // export const editCommonCollectionItem = async (req, res) => {
// //   try {
// //     const { collection, subdocId } = req.params;
// //     if (!allowedCollections.includes(collection)) {
// //       return res.status(400).json({ error: `Invalid collection: ${collection}` });
// //     }
// //     const updates = req.body;

// //     let common = await CommonModel.findOne();
// //     if (!common) {
// //       return res.status(404).json({ error: "No Common document found." });
// //     }
// //     const idx = common[collection].findIndex(
// //       (item) => item._id && item._id.toString() === subdocId
// //     );
// //     if (idx === -1) {
// //       return res.status(404).json({ error: "Entry not found." });
// //     }

// //     // Clean (trim) and assign updated fields
// //     for (const key in updates) {
// //       if (
// //         typeof updates[key] === "string" &&
// //         ["country", "subject", "notes", "image", "templateName", "url", "role", "feature", "question", "answer", "type", "description", "shopType"].includes(key)
// //       ) {
// //         common[collection][idx][key] = updates[key].trim();
// //       } else if (key === "date") {
// //         common[collection][idx][key] = new Date(updates[key]);
// //       } else {
// //         common[collection][idx][key] = updates[key];
// //       }
// //     }

// //     await common.save();
// //     res.json(common[collection][idx]);
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ------------------- Generic Delete -------------------

// // /**
// //  * Delete a subdocument from a collection by _id.
// //  * Path params: :collection, :subdocId
// //  */
// // export const deleteCommonCollectionItem = async (req, res) => {
// //   try {
// //     const { collection, subdocId } = req.params;
// //     if (!allowedCollections.includes(collection)) {
// //       return res.status(400).json({ error: `Invalid collection: ${collection}` });
// //     }
// //     let common = await CommonModel.findOne();
// //     if (!common) return res.status(404).json({ error: "No Common document found." });

// //     const idx = common[collection].findIndex(
// //       (item) => item._id && item._id.toString() === subdocId
// //     );
// //     if (idx === -1) {
// //       return res.status(404).json({ error: "Entry not found." });
// //     }
// //     common[collection].splice(idx, 1);
// //     await common.save();
// //     res.json({ deleted: true, id: subdocId });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // };


// // export default {
// //   fetchCommonCollection,
// //   addToCommonCollection,
// //   editCommonCollectionItem,
// //   deleteCommonCollectionItem
// // };

// import mongoose from 'mongoose';
// import CommonModel from '../../Schema/common.schema.js';

// /**
//  * ================= Administration Controller for "Everything" =================
//  * Handles CRUD operations on all `Common` embedded arrays:
//  *    - Thought of the Day
//  *    - Product Features
//  *    - FAQs
//  *    - Privacy & Disclaimers
//  *    - Website Templates
//  *    - Invoice Templates
//  * ============================================================================
//  *
//  * All endpoints expect:
//  *   - collection: one of "thoughtOfTheDay", "productFeatures", "faqs",
//  *                 "privacyAndDisclaimers", "websiteTemplates", "invoiceTemplates"
//  *   - For fetch: can provide optional filters via query params
//  *   - For edit/delete: subdocId parameter (MongoDB objectId of array element)
//  *
//  * IMPORTANT: This relies on the schema NOT setting `{ _id: false }` on the
//  * subdocuments. If you regenerate common.schema.js, make sure `_id: false`
//  * is not present on any of the item schemas, or edit/delete will silently
//  * fail to find anything.
//  */

// // ------------------- Helper: Allowed Collections -------------------

// const allowedCollections = [
//   "thoughtOfTheDay",
//   "productFeatures",
//   "faqs",
//   "privacyAndDisclaimers",
//   "websiteTemplates",
//   "invoiceTemplates"
// ];

// // Per-collection required fields + trimmable string fields, used for
// // generic validation/cleanup on add and edit so every collection gets
// // the same treatment instead of only thoughtOfTheDay.
// const collectionConfig = {
//   thoughtOfTheDay: {
//     required: ["date", "country", "subject"],
//     trimFields: ["country", "subject", "notes", "image"],
//     dateFields: ["date"]
//   },
//   productFeatures: {
//     required: ["date", "country"],
//     trimFields: ["country", "role", "feature", "image"],
//     dateFields: ["date"]
//   },
//   faqs: {
//     required: ["question", "answer"],
//     trimFields: ["role", "question", "answer"],
//     dateFields: ["date"]
//   },
//   privacyAndDisclaimers: {
//     required: ["type", "description"],
//     trimFields: ["country", "type", "description"],
//     dateFields: ["date"]
//   },
//   websiteTemplates: {
//     required: ["templateName", "url"],
//     trimFields: ["templateName", "url", "country", "shopType"],
//     dateFields: ["date"]
//   },
//   invoiceTemplates: {
//     required: ["templateName"],
//     trimFields: ["templateName", "country", "shopType", "image"],
//     dateFields: ["date"]
//   }
// };

// const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// // ------------------- Generic Fetch -------------------

// /**
//  * Fetch entries from the specified collection with optional query filters.
//  * Returns 200 + [] when nothing matches (empty result is not an error),
//  * and reserves 400/404 for actual client mistakes (bad collection name,
//  * no Common document created yet at all).
//  */
// export const fetchCommonCollection = async (req, res) => {
//   try {
//     const { collection } = req.params;
//     if (!allowedCollections.includes(collection)) {
//       return res.status(400).json({ error: `Invalid collection: ${collection}` });
//     }
//     const filters = { ...req.query };

//     // Convert some fields, if present, to appropriate types
//     if (filters.date) {
//       const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.date);
//       if (m) {
//         const [, y, mth, d] = m;
//         filters.date = {
//           $gte: new Date(`${y}-${mth}-${d}T00:00:00.000Z`),
//           $lte: new Date(`${y}-${mth}-${d}T23:59:59.999Z`)
//         };
//       } else {
//         const dt = new Date(filters.date);
//         if (!isNaN(dt.getTime())) filters.date = dt;
//       }
//     }
//     if (filters.country) {
//       filters.country = { $regex: `^${filters.country.trim()}$`, $options: 'i' };
//     }

//     const pipeline = [
//       { $unwind: `$${collection}` },
//       { $replaceRoot: { newRoot: `$${collection}` } }
//     ];
//     if (Object.keys(filters).length > 0) {
//       pipeline.push({ $match: filters });
//     }

//     const results = await CommonModel.aggregate(pipeline);
//     // Empty result set is a normal, successful response.
//     return res.status(200).json(results);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ------------------- Generic Add -------------------

// /**
//  * Add a new subdocument to a collection.
//  * Expects: { ...fields... } in body
//  * Path param: :collection
//  */
// export const addToCommonCollection = async (req, res) => {
//   try {
//     const { collection } = req.params;
//     if (!allowedCollections.includes(collection)) {
//       return res.status(400).json({ error: `Invalid collection: ${collection}` });
//     }
//     const config = collectionConfig[collection];
//     const doc = { ...req.body };

//     // Generic required-field validation
//     const missing = config.required.filter((f) => !doc[f]);
//     if (missing.length > 0) {
//       return res.status(400).json({ error: `Missing required field(s): ${missing.join(", ")}` });
//     }

//     // Trim string fields
//     for (const field of config.trimFields) {
//       if (typeof doc[field] === "string") doc[field] = doc[field].trim();
//     }

//     // Convert date fields
//     for (const field of config.dateFields) {
//       if (doc[field]) doc[field] = new Date(doc[field]);
//     }

//     // Uniqueness check on date+country, only where both fields exist
//     if (doc.date && doc.country) {
//       const exists = await CommonModel.findOne({
//         [collection]: { $elemMatch: { date: doc.date, country: doc.country } }
//       });
//       if (exists) {
//         return res.status(409).json({ error: "Entry already exists for this date and country." });
//       }
//     }

//     let common = await CommonModel.findOne();
//     if (!common) {
//       common = new CommonModel();
//     }
//     common[collection].push(doc);
//     await common.save();

//     // Return the newly added element (it is last in array); it now has an _id
//     res.status(201).json(common[collection][common[collection].length - 1]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ------------------- Generic Edit -------------------

// /**
//  * Edit a subdocument in a collection by _id.
//  * Path params: :collection, :subdocId
//  * Body: fields to update
//  */
// export const editCommonCollectionItem = async (req, res) => {
//   try {
//     const { collection, subdocId } = req.params;
//     if (!allowedCollections.includes(collection)) {
//       return res.status(400).json({ error: `Invalid collection: ${collection}` });
//     }
//     if (!isValidObjectId(subdocId)) {
//       return res.status(400).json({ error: "Invalid subdocument id." });
//     }
//     const config = collectionConfig[collection];
//     const updates = { ...req.body };

//     let common = await CommonModel.findOne();
//     if (!common) {
//       return res.status(404).json({ error: "No Common document found." });
//     }

//     const item = common[collection].id(subdocId);
//     if (!item) {
//       return res.status(404).json({ error: "Entry not found." });
//     }

//     for (const key in updates) {
//       if (typeof updates[key] === "string" && config.trimFields.includes(key)) {
//         item[key] = updates[key].trim();
//       } else if (config.dateFields.includes(key)) {
//         item[key] = new Date(updates[key]);
//       } else {
//         item[key] = updates[key];
//       }
//     }

//     await common.save();
//     res.json(item);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ------------------- Generic Delete -------------------

// /**
//  * Delete a subdocument from a collection by _id.
//  * Path params: :collection, :subdocId
//  */
// export const deleteCommonCollectionItem = async (req, res) => {
//   try {
//     const { collection, subdocId } = req.params;
//     if (!allowedCollections.includes(collection)) {
//       return res.status(400).json({ error: `Invalid collection: ${collection}` });
//     }
//     if (!isValidObjectId(subdocId)) {
//       return res.status(400).json({ error: "Invalid subdocument id." });
//     }

//     let common = await CommonModel.findOne();
//     if (!common) return res.status(404).json({ error: "No Common document found." });

//     const item = common[collection].id(subdocId);
//     if (!item) {
//       return res.status(404).json({ error: "Entry not found." });
//     }
//     item.deleteOne(); // removes subdoc from the parent array
//     await common.save();
//     res.json({ deleted: true, id: subdocId });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// export default {
//   fetchCommonCollection,
//   addToCommonCollection,
//   editCommonCollectionItem,
//   deleteCommonCollectionItem
// };

import mongoose from 'mongoose';
import CommonModel from '../../Schema/common.schema.js';
import { deleteUploadedFile } from '../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js';

/**
 * ================= Administration Controller for "Everything" =================
 * Handles CRUD operations on all `Common` embedded arrays:
 *    - Thought of the Day
 *    - Product Features
 *    - FAQs
 *    - Privacy & Disclaimers
 *    - Website Templates
 *    - Invoice Templates
 * ============================================================================
 *
 * All endpoints expect:
 *   - collection: one of "thoughtOfTheDay", "productFeatures", "faqs",
 *                 "privacyAndDisclaimers", "websiteTemplates", "invoiceTemplates"
 *   - For fetch: can provide optional filters via query params
 *   - For edit/delete: subdocId parameter (MongoDB objectId of array element)
 *
 * IMPORTANT: This relies on the schema NOT setting `{ _id: false }` on the
 * subdocuments. If you regenerate common.schema.js, make sure `_id: false`
 * is not present on any of the item schemas, or edit/delete will silently
 * fail to find anything.
 */

// ------------------- Helper: Allowed Collections -------------------

const allowedCollections = [
  "thoughtOfTheDay",
  "productFeatures",
  "faqs",
  "privacyAndDisclaimers",
  "websiteTemplates",
  "invoiceTemplates"
];

// Per-collection required fields + trimmable string fields, used for
// generic validation/cleanup on add and edit so every collection gets
// the same treatment instead of only thoughtOfTheDay.
const collectionConfig = {
  thoughtOfTheDay: {
    required: ["date", "country", "subject"],
    trimFields: ["country", "subject", "notes", "image"],
    dateFields: ["date"]
  },
  productFeatures: {
    required: ["date", "country"],
    trimFields: ["country", "role", "feature", "image"],
    dateFields: ["date"]
  },
  faqs: {
    required: ["question", "answer"],
    trimFields: ["role", "question", "answer"],
    dateFields: ["date"]
  },
  privacyAndDisclaimers: {
    required: ["type", "description"],
    trimFields: ["country", "type", "description"],
    dateFields: ["date"]
  },
  websiteTemplates: {
    required: ["templateName", "url"],
    trimFields: ["templateName", "url", "country", "shopType"],
    dateFields: ["date"]
  },
  invoiceTemplates: {
    required: ["templateName"],
    trimFields: ["templateName", "country", "shopType", "image"],
    dateFields: ["date"]
  }
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ------------------- Generic Fetch -------------------

/**
 * Fetch entries from the specified collection with optional query filters.
 * Returns 200 + [] when nothing matches (empty result is not an error),
 * and reserves 400/404 for actual client mistakes (bad collection name,
 * no Common document created yet at all).
 */
export const fetchCommonCollection = async (req, res) => {
  try {
    const { collection } = req.params;
    if (!allowedCollections.includes(collection)) {
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }
    const filters = { ...req.query };

    // Convert some fields, if present, to appropriate types
    if (filters.date) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.date);
      if (m) {
        const [, y, mth, d] = m;
        filters.date = {
          $gte: new Date(`${y}-${mth}-${d}T00:00:00.000Z`),
          $lte: new Date(`${y}-${mth}-${d}T23:59:59.999Z`)
        };
      } else {
        const dt = new Date(filters.date);
        if (!isNaN(dt.getTime())) filters.date = dt;
      }
    }
    if (filters.country) {
      filters.country = { $regex: `^${filters.country.trim()}$`, $options: 'i' };
    }

    const pipeline = [
      { $unwind: `$${collection}` },
      { $replaceRoot: { newRoot: `$${collection}` } }
    ];
    if (Object.keys(filters).length > 0) {
      pipeline.push({ $match: filters });
    }

    const results = await CommonModel.aggregate(pipeline);
    // Empty result set is a normal, successful response.
    return res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------- Generic Add -------------------

/**
 * Add a new subdocument to a collection.
 * Expects: { ...fields... } in body
 * Path param: :collection
 */
export const addToCommonCollection = async (req, res) => {
  // req.file is populated by multer (upload.single(imageField)) only when the
  // collection has an image field configured in common.routes.js, and only
  // when the client actually attached a file — it's optional, so this can be
  // undefined and that's fine.
  const uploadedFile = req.file;

  try {
    const { collection } = req.params;
    if (!allowedCollections.includes(collection)) {
      deleteUploadedFile(uploadedFile);
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }
    const config = collectionConfig[collection];
    // req.body will contain the non-file fields when the request is FormData
    // (multipart), same as it would from JSON — Express/Multer parse both.
    const doc = { ...req.body };

    if (uploadedFile) {
      doc.image = uploadedFile.path;
    }

    // Generic required-field validation
    const missing = config.required.filter((f) => !doc[f]);
    if (missing.length > 0) {
      deleteUploadedFile(uploadedFile);
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(", ")}` });
    }

    // Trim string fields
    for (const field of config.trimFields) {
      if (typeof doc[field] === "string") doc[field] = doc[field].trim();
    }

    // Convert date fields
    for (const field of config.dateFields) {
      if (doc[field]) doc[field] = new Date(doc[field]);
    }

    // Uniqueness check on date+country, only where both fields exist
    if (doc.date && doc.country) {
      const exists = await CommonModel.findOne({
        [collection]: { $elemMatch: { date: doc.date, country: doc.country } }
      });
      if (exists) {
        deleteUploadedFile(uploadedFile);
        return res.status(409).json({ error: "Entry already exists for this date and country." });
      }
    }

    let common = await CommonModel.findOne();
    if (!common) {
      common = new CommonModel();
    }
    common[collection].push(doc);
    await common.save();

    // Return the newly added element (it is last in array); it now has an _id
    res.status(201).json(common[collection][common[collection].length - 1]);
  } catch (err) {
    // Any failure past this point (including a save() error) should not
    // leave an orphaned file sitting on disk.
    deleteUploadedFile(uploadedFile);
    res.status(500).json({ error: err.message });
  }
};

// ------------------- Generic Edit -------------------

/**
 * Edit a subdocument in a collection by _id.
 * Path params: :collection, :subdocId
 * Body: fields to update
 */
export const editCommonCollectionItem = async (req, res) => {
  const uploadedFile = req.file; // optional replacement image, may be undefined

  try {
    const { collection, subdocId } = req.params;
    if (!allowedCollections.includes(collection)) {
      deleteUploadedFile(uploadedFile);
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }
    if (!isValidObjectId(subdocId)) {
      deleteUploadedFile(uploadedFile);
      return res.status(400).json({ error: "Invalid subdocument id." });
    }
    const config = collectionConfig[collection];
    const updates = { ...req.body };

    let common = await CommonModel.findOne();
    if (!common) {
      deleteUploadedFile(uploadedFile);
      return res.status(404).json({ error: "No Common document found." });
    }

    const item = common[collection].id(subdocId);
    if (!item) {
      deleteUploadedFile(uploadedFile);
      return res.status(404).json({ error: "Entry not found." });
    }

    // Remember the old image path so we can delete it only after the new
    // one is confirmed saved (avoid deleting the old file if save() fails).
    const oldImagePath = item.image;

    for (const key in updates) {
      if (typeof updates[key] === "string" && config.trimFields.includes(key)) {
        item[key] = updates[key].trim();
      } else if (config.dateFields.includes(key)) {
        item[key] = new Date(updates[key]);
      } else {
        item[key] = updates[key];
      }
    }

    if (uploadedFile) {
      item.image = uploadedFile.path;
    }

    await common.save();

    // Now safe to remove the replaced image, if there was one and it changed.
    if (uploadedFile && oldImagePath) {
      deleteUploadedFile(oldImagePath);
    }

    res.json(item);
  } catch (err) {
    // Save failed — clean up the newly uploaded file, leave the old one alone.
    deleteUploadedFile(uploadedFile);
    res.status(500).json({ error: err.message });
  }
};

// ------------------- Generic Delete -------------------

/**
 * Delete a subdocument from a collection by _id.
 * Path params: :collection, :subdocId
 */
export const deleteCommonCollectionItem = async (req, res) => {
  try {
    const { collection, subdocId } = req.params;
    if (!allowedCollections.includes(collection)) {
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }
    if (!isValidObjectId(subdocId)) {
      return res.status(400).json({ error: "Invalid subdocument id." });
    }

    let common = await CommonModel.findOne();
    if (!common) return res.status(404).json({ error: "No Common document found." });

    const item = common[collection].id(subdocId);
    if (!item) {
      return res.status(404).json({ error: "Entry not found." });
    }
    const imagePath = item.image; // capture before removal
    item.deleteOne(); // removes subdoc from the parent array
    await common.save();

    // Entry is gone from the DB — the file it referenced is now orphaned.
    if (imagePath) deleteUploadedFile(imagePath);

    res.json({ deleted: true, id: subdocId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default {
  fetchCommonCollection,
  addToCommonCollection,
  editCommonCollectionItem,
  deleteCommonCollectionItem
};