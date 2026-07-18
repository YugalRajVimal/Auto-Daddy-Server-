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

const router = express.Router();

/* ---------------------- Items ---------------------- */
router.get("/items", getItems);
router.get("/items/:id", getItemById);
router.post("/items", upload.single("itemImage"), createItem);
router.put("/items/:id", upload.single("itemImage"), updateItem);
router.patch("/items/bulk", bulkUpdateItems);

/* -------------------- Invoices ---------------------- */
router.get("/", getInvoices);
router.get("/:id", getInvoiceById);
router.post("/", createInvoice);
router.put("/:id", updateInvoice);
router.patch("/bulk", bulkUpdateInvoices);
router.post("/copy", copyInvoices);

/* ---------------------- Banks ------------------------ */
// Lightweight list endpoint for the invoice form's bank dropdown.
router.get("/banks/list", async (req, res) => {
  try {
    const banks = await Bank.find({ status: "active" }).select("BankName AccountName AccountNumber");
    res.json({ success: true, banks });
  } catch (err) {
    console.error("[INVOICES] banks list error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch banks" });
  }
});

export default router;
