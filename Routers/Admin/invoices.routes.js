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

// const router = express.Router();

// /* ---------------------- Items ---------------------- */
// router.get("/items", getItems);
// router.get("/items/:id", getItemById);
// router.post("/items", upload.single("itemImage"), createItem);
// router.put("/items/:id", upload.single("itemImage"), updateItem);
// router.patch("/items/bulk", bulkUpdateItems);

// /* -------------------- Invoices ---------------------- */
// router.get("/", getInvoices);
// router.get("/:id", getInvoiceById);
// router.post("/", createInvoice);
// router.put("/:id", updateInvoice);
// router.patch("/bulk", bulkUpdateInvoices);
// router.post("/copy", copyInvoices);

// /* ---------------------- Banks ------------------------ */
// // Lightweight list endpoint for the invoice form's bank dropdown.
// router.get("/banks/list", async (req, res) => {
//   try {
//     const banks = await Bank.find({ status: "active" }).select("BankName AccountName AccountNumber");
//     res.json({ success: true, banks });
//   } catch (err) {
//     console.error("[INVOICES] banks list error:", err);
//     res.status(500).json({ success: false, message: "Failed to fetch banks" });
//   }
// });

// export default router;


// Routers/Admin/invoices.routes.js
// MODULE MAP:
//   /items*      -> invoices.items
//   / (invoices) -> invoices.invoices
//   /banks/list  -> invoices.invoices (view) — read-only lookup for the
//                    invoice form's bank dropdown, not a Bank CRUD action,
//                    so it doesn't need accounts.bank permission.

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
import Bank from "../../Schema/Accounts/bank.schema.js";
import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


const router = express.Router();
router.use(jwtAuth);

/* ---------------------- Items ---------------------- */
router.get("/items", requireNavPermission("invoices", "items", "view"), getItems);
router.get("/items/:id", requireNavPermission("invoices", "items", "view"), getItemById);
router.post("/items", requireNavPermission("invoices", "items", "create"), upload.single("itemImage"), createItem);
router.put("/items/:id", requireNavPermission("invoices", "items", "update"), upload.single("itemImage"), updateItem);
router.patch("/items/bulk", requireNavPermission("invoices", "items", "update"), bulkUpdateItems);

/* -------------------- Invoices ---------------------- */
router.get("/", requireNavPermission("invoices", "invoices", "view"), getInvoices);
router.get("/:id", requireNavPermission("invoices", "invoices", "view"), getInvoiceById);
router.post("/", requireNavPermission("invoices", "invoices", "create"), createInvoice);
router.put("/:id", requireNavPermission("invoices", "invoices", "update"), updateInvoice);
router.patch("/bulk", requireNavPermission("invoices", "invoices", "update"), bulkUpdateInvoices);
router.post("/copy", requireNavPermission("invoices", "invoices", "create"), copyInvoices);

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