

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

// Import PAGE_SLUG_ENUM from the common schema file


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
    required: ["question", "answer", "pageSlug"],
    trimFields: ["role", "question", "answer", "pageSlug"],
    dateFields: ["date"],
    enumFields: {
      pageSlug: PAGE_SLUG_ENUM
    }
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

    let match = {};

    if (collection === "thoughtOfTheDay") {
      // Filtering for date (with range for YYYY-MM-DD), and partial search on subject, country, notes
      if (filters.date) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.date);
        if (m) {
          const [, y, mth, d] = m;
          match.date = {
            $gte: new Date(`${y}-${mth}-${d}T00:00:00.000Z`),
            $lte: new Date(`${y}-${mth}-${d}T23:59:59.999Z`)
          };
        } else {
          const dt = new Date(filters.date);
          if (!isNaN(dt.getTime())) match.date = dt;
        }
      }
      if (filters.country) {
        match.country = { $regex: filters.country.trim(), $options: 'i' };
      }
      if (filters.subject) {
        match.subject = { $regex: filters.subject.trim(), $options: 'i' };
      }
      if (filters.notes) {
        match.notes = { $regex: filters.notes.trim(), $options: 'i' };
      }
    } else if (collection === "faqs") {
      // Add filter for pageSlug and keep existing filters
      if (filters.pageSlug) {
        match.pageSlug = filters.pageSlug.trim();
      }
      if (filters.question) {
        match.question = { $regex: filters.question.trim(), $options: 'i' };
      }
      if (filters.answer) {
        match.answer = { $regex: filters.answer.trim(), $options: 'i' };
      }
      if (filters.role) {
        match.role = { $regex: filters.role.trim(), $options: 'i' };
      }
      if (filters.date) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.date);
        if (m) {
          const [, y, mth, d] = m;
          match.date = {
            $gte: new Date(`${y}-${mth}-${d}T00:00:00.000Z`),
            $lte: new Date(`${y}-${mth}-${d}T23:59:59.999Z`)
          };
        } else {
          const dt = new Date(filters.date);
          if (!isNaN(dt.getTime())) match.date = dt;
        }
      }
    } else {
      // Default for other collections (retains previous logic)
      if (filters.date) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.date);
        if (m) {
          const [, y, mth, d] = m;
          match.date = {
            $gte: new Date(`${y}-${mth}-${d}T00:00:00.000Z`),
            $lte: new Date(`${y}-${mth}-${d}T23:59:59.999Z`)
          };
        } else {
          const dt = new Date(filters.date);
          if (!isNaN(dt.getTime())) match.date = dt;
        }
      }
      if (filters.country) {
        match.country = { $regex: `^${filters.country.trim()}$`, $options: 'i' };
      }
    }

    const pipeline = [
      { $unwind: `$${collection}` },
      { $replaceRoot: { newRoot: `$${collection}` } }
    ];
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
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

    // Special case: pageSlug is only required for FAQs collection.
    let missing = [];
    if (collection === "faqs") {
      // For FAQs, use all configured required fields as usual
      missing = config.required.filter((f) => !doc[f]);
    } else {
      // For other collections, filter out "pageSlug" from the required list if present
      missing = config.required.filter((f) => f !== "pageSlug" && !doc[f]);
    }

    if (missing.length > 0) {
      deleteUploadedFile(uploadedFile);
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(", ")}` });
    }

    // Check enums if defined for the collection (e.g., faqs.pageSlug)
    if (config.enumFields) {
      for (const key in config.enumFields) {
        if (doc[key] && !config.enumFields[key].includes(doc[key])) {
          deleteUploadedFile(uploadedFile);
          return res.status(400).json({ error: `Invalid value for ${key}. Allowed values: ${config.enumFields[key].join(", ")}` });
        }
      }
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

    if (config.enumFields) {
      for (const key in config.enumFields) {
        if (updates[key] && !config.enumFields[key].includes(updates[key])) {
          deleteUploadedFile(uploadedFile);
          return res.status(400).json({ error: `Invalid value for ${key}. Allowed values: ${config.enumFields[key].join(", ")}` });
        }
      }
    }

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