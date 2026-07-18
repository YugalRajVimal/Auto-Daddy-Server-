import fs from "fs";
import path from "path";
import AdminInvoiceItem from "../../../Schema/AdminInvoices/AdminInvoiceItem.js";

const round2 = (n) => Math.round(n * 100) / 100;

// Adds a computed costWithGst field to a plain item object for the frontend table
function withComputed(itemDoc) {
  const item = itemDoc.toObject ? itemDoc.toObject() : itemDoc;
  const costWithGst =
    item.unitCost != null && item.gstPercent != null
      ? round2(item.unitCost * (1 + item.gstPercent / 100))
      : null;
  return { ...item, costWithGst };
}

function deleteFileIfExists(filename) {
  if (!filename) return;
  const filePath = path.join("./Uploads/Items", filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("[ITEMS] Failed to delete image:", filePath, err.message);
    }
  });
}

// GET /api/admin/invoices/items?view=active&search=&page=1&limit=10
export const getItems = async (req, res) => {
  try {
    const { view = "active", search = "", page = 1, limit = 10 } = req.query;

    const filter = { view };
    if (search.trim()) {
      filter.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    const [items, total] = await Promise.all([
      AdminInvoiceItem.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      AdminInvoiceItem.countDocuments(filter),
    ]);

    res.json({
      success: true,
      items: items.map(withComputed),
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error("[ITEMS] getItems error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch items" });
  }
};

// GET /api/admin/invoices/items/:id
export const getItemById = async (req, res) => {
  try {
    const item = await AdminInvoiceItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, item: withComputed(item) });
  } catch (err) {
    console.error("[ITEMS] getItemById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch item" });
  }
};

// POST /api/admin/invoices/items  (multipart/form-data, field: itemImage)
export const createItem = async (req, res) => {
  try {
    const {
      itemName,
      hsnCode,
      itemType,
      description,
      unitCost,
      quantity,
      unitType,
      gstPercent,
      openingStock,
    } = req.body;

    if (!itemName || !itemName.trim()) {
      return res.status(400).json({ success: false, message: "Item name is required." });
    }
    if (unitCost === undefined || unitCost === "" || isNaN(Number(unitCost))) {
      return res.status(400).json({ success: false, message: "Unit cost is required." });
    }

    const stockValue = openingStock !== undefined && openingStock !== "" ? Number(openingStock) : 0;

    const item = await AdminInvoiceItem.create({
      itemName: itemName.trim(),
      hsnCode: hsnCode?.trim() || "",
      itemType: itemType || "Goods",
      description: description?.trim() || "",
      unitCost: Number(unitCost),
      quantity: quantity ? Number(quantity) : 1,
      unitType: unitType || "",
      gstPercent: gstPercent !== undefined && gstPercent !== "" ? Number(gstPercent) : 0,
      initialStock: stockValue,
      openingStock: stockValue,
      image: req.file ? req.file.filename : "",
      view: "active",
    });

    res.status(201).json({ success: true, item: withComputed(item) });
  } catch (err) {
    console.error("[ITEMS] createItem error:", err);
    res.status(500).json({ success: false, message: "Failed to create item" });
  }
};

// PUT /api/admin/invoices/items/:id  (multipart/form-data, field: itemImage optional)
export const updateItem = async (req, res) => {
  try {
    const existing = await AdminInvoiceItem.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Item not found" });

    const {
      itemName,
      hsnCode,
      itemType,
      description,
      unitCost,
      quantity,
      unitType,
      gstPercent,
      openingStock,
    } = req.body;

    if (itemName !== undefined) {
      if (!itemName.trim()) {
        return res.status(400).json({ success: false, message: "Item name is required." });
      }
      existing.itemName = itemName.trim();
    }
    if (hsnCode !== undefined) existing.hsnCode = hsnCode.trim();
    if (itemType !== undefined) existing.itemType = itemType;
    if (description !== undefined) existing.description = description.trim();
    if (unitCost !== undefined && unitCost !== "") existing.unitCost = Number(unitCost);
    if (quantity !== undefined && quantity !== "") existing.quantity = Number(quantity);
    if (unitType !== undefined) existing.unitType = unitType;
    if (gstPercent !== undefined) existing.gstPercent = gstPercent === "" ? 0 : Number(gstPercent);
    // Editing openingStock directly from the form adjusts the live count manually.
    // It does NOT touch initialStock (that stays as the original baseline).
    if (openingStock !== undefined && openingStock !== "") {
      existing.openingStock = Number(openingStock);
    }

    if (req.file) {
      deleteFileIfExists(existing.image);
      existing.image = req.file.filename;
    }

    await existing.save();
    res.json({ success: true, item: withComputed(existing) });
  } catch (err) {
    console.error("[ITEMS] updateItem error:", err);
    res.status(500).json({ success: false, message: "Failed to update item" });
  }
};

// PATCH /api/admin/invoices/items/bulk  { ids: [], action: "archive" | "delete" | "restore" }
export const bulkUpdateItems = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No items selected." });
    }

    const viewMap = { archive: "archived", delete: "deleted", restore: "active" };
    const view = viewMap[action];
    if (!view) return res.status(400).json({ success: false, message: "Invalid action." });

    await AdminInvoiceItem.updateMany({ _id: { $in: ids } }, { $set: { view } });
    res.json({ success: true, message: `Item(s) ${action}d.` });
  } catch (err) {
    console.error("[ITEMS] bulkUpdateItems error:", err);
    res.status(500).json({ success: false, message: "Failed to update items" });
  }
};

export default {
  getItems,
  getItemById,
  createItem,
  updateItem,
  bulkUpdateItems,
};
