
// import express from "express";

// import {
//   getItems,
//   getItemById,
//   createItem,
//   updateItem,
//   bulkUpdateItems,
// } from "../../Controllers/Admin/AdminInvoice/adminInvoiceItemController.js";

// import {
//   getInvoices,
//   getInvoiceById,
//   createInvoice,
//   updateInvoice,
//   bulkUpdateInvoices,
//   copyInvoices,
// } from "../../Controllers/Admin/AdminInvoice/adminInvoiceController.js";
// import Bank from "../../Schema/Accounts/bank.schema.js";
// import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
// import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
// import { requireNavPermission } from "../../middlewares/Permission.middleware.js"
// import {
//   getInvoiceSettings,
//   updateInvoiceSettings,
// } from "../../Controllers/Admin/AdminInvoice/adminInvoiceSettingsController.js";


// const router = express.Router();
// router.use(jwtAuth);

// /* ---------------------- Items ---------------------- */
// router.get("/items", requireNavPermission("invoices", "items", "view"), getItems);
// router.get("/items/:id", requireNavPermission("invoices", "items", "view"), getItemById);
// router.post("/items", requireNavPermission("invoices", "items", "create"), upload.single("itemImage"), createItem);
// router.put("/items/:id", requireNavPermission("invoices", "items", "update"), upload.single("itemImage"), updateItem);
// router.patch("/items/bulk", requireNavPermission("invoices", "items", "update"), bulkUpdateItems);

// /* -------------------- Invoices ---------------------- */
// router.get("/", requireNavPermission("invoices", "invoices", "view"), getInvoices);
// router.get("/:id", requireNavPermission("invoices", "invoices", "view"), getInvoiceById);
// router.post("/", requireNavPermission("invoices", "invoices", "create"), createInvoice);
// router.put("/:id", requireNavPermission("invoices", "invoices", "update"), updateInvoice);
// router.patch("/bulk", requireNavPermission("invoices", "invoices", "update"), bulkUpdateInvoices);
// router.post("/copy", requireNavPermission("invoices", "invoices", "create"), copyInvoices);



// /* ------------------ Invoice numbering settings ------------------ */
// router.get("/settings", requireNavPermission("invoices", "invoices", "view"), getInvoiceSettings);
// router.put("/settings", requireNavPermission("invoices", "invoices", "update"), updateInvoiceSettings);

// /* ---------------------- Banks ------------------------ */
// router.get("/banks/list", requireNavPermission("invoices", "invoices", "view"), async (req, res) => {
//   try {
//     const banks = await Bank.find({ status: "active" }).select("BankName AccountName AccountNumber");
//     res.json({ success: true, banks });
//   } catch (err) {
//     console.error("[INVOICES] banks list error:", err);
//     res.status(500).json({ success: false, message: "Failed to fetch banks" });
//   }
// });

// export default router;

import express from "express";

import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  bulkUpdateItems,
} from "../../Controllers/Admin/AdminInvoice/adminInvoiceItemController.js";

import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  bulkUpdateInvoices,
  copyInvoices,
} from "../../Controllers/Admin/AdminInvoice/adminInvoiceController.js";
import {
  getInvoiceSettings,
  updateInvoiceSettings,
} from "../../Controllers/Admin/AdminInvoice/adminInvoiceSettingsController.js";
import Bank from "../../Schema/Accounts/bank.schema.js";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js";

const router = express.Router();
router.use(jwtAuth);

/* ---------------------- Items ---------------------- */
router.get("/items", requireNavPermission("invoices", "items", "view"), getItems);
router.get("/items/:id", requireNavPermission("invoices", "items", "view"), getItemById);
router.post("/items", requireNavPermission("invoices", "items", "create"), upload.single("itemImage"), createItem);
router.put("/items/:id", requireNavPermission("invoices", "items", "update"), upload.single("itemImage"), updateItem);
router.patch("/items/bulk", requireNavPermission("invoices", "items", "update"), bulkUpdateItems);

/* ------------- Invoice numbering settings ---------- */
// MUST come before the "/:id" routes below — otherwise Express matches
// GET/PUT "/settings" against "/:id" first and tries to Mongoose-cast the
// literal string "settings" as an ObjectId, which is exactly what's in
// the error log above.
router.get("/settings", requireNavPermission("invoices", "invoices", "view"), getInvoiceSettings);
router.put("/settings", requireNavPermission("invoices", "invoices", "update"), updateInvoiceSettings);

/* -------------------- Invoices ---------------------- */
router.get("/", requireNavPermission("invoices", "invoices", "view"), getInvoices);
router.post("/", requireNavPermission("invoices", "invoices", "create"), createInvoice);
router.post("/copy", requireNavPermission("invoices", "invoices", "create"), copyInvoices);
router.patch("/bulk", requireNavPermission("invoices", "invoices", "update"), bulkUpdateInvoices);
router.get("/:id", requireNavPermission("invoices", "invoices", "view"), getInvoiceById);
router.put("/:id", requireNavPermission("invoices", "invoices", "update"), updateInvoice);

/* ---------------------- Banks ------------------------ */
router.get("/banks/list", requireNavPermission("invoices", "invoices", "view"), async (req, res) => {
  try {
    const banks = await Bank.find({ status: "active" }).select("BankName AccountName AccountNumber");
    res.json({ success: true, banks });
  } catch (err) {
    console.error("[INVOICES] banks list error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch banks" });
  }
});

export default router;