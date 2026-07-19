import mongoose from "mongoose";
import AdminInvoiceItem from "../../../Schema/AdminInvoices/AdminInvoiceItem.js";
import AdminInvoiceSchema from "../../../Schema/AdminInvoices/AdminInvoice.schema.js";

// The only allowed unitTypes for items are "Unit" and "Days"
// All stock/HSN/itemType logic is removed

const round2 = (n) => Math.round(n * 100) / 100;

function lineAmount(unitPrice, units) {
  return (Number(unitPrice) || 0) * (Number(units) || 0);
}
function lineGst(unitPrice, units, gstPercent) {
  return lineAmount(unitPrice, units) * ((Number(gstPercent) || 0) / 100);
}

// Builds the items[] array for storage, validating each referenced item exists
async function buildInvoiceItems(rawLineItems) {
  const built = [];
  for (const line of rawLineItems) {
    if (!line.itemRefId) {
      throw new Error("Each invoice line must reference an existing Item (itemRefId).");
    }
    const itemDoc = await AdminInvoiceItem.findById(line.itemRefId);
    if (!itemDoc) {
      throw new Error(`Item not found for id ${line.itemRefId}`);
    }
    // Enforce unitType as only "Unit" or "Days", fallback to "Unit" if anything else
    let unitType = (itemDoc.unitType || "Unit").toString();
    if (!["Unit", "Days"].includes(unitType)) unitType = "Unit";

    const unitPrice = Number(line.unitPrice) || 0;
    const units = Number(line.units) || 0;
    const gstPercent = Number(line.gstPercent) || 0;

    built.push({
      ItemRefId: itemDoc._id,
      Item: itemDoc.itemName,
      Description: line.description || "",
      UnitType: unitType,
      UnitPrice: unitPrice,
      Units: units,
      GSTPercent: gstPercent,
      Amount: round2(lineAmount(unitPrice, units)),
    });
  }
  return built;
}

function computeTotals(items, roundOffEnabled, roundOffAmount) {
  const subtotal = round2(items.reduce((sum, l) => sum + lineAmount(l.UnitPrice, l.Units), 0));
  const gst = round2(items.reduce((sum, l) => sum + lineGst(l.UnitPrice, l.Units, l.GSTPercent), 0));
  const roundOff = roundOffEnabled ? Number(roundOffAmount) || 0 : 0;
  const invoiceTotal = round2(subtotal + gst + roundOff);
  return { subtotal, gst, roundOff, invoiceTotal };
}

// Removed adjustStock and all stock/HSN code
// GET /api/admin/invoices?view=active&search=&page=1&limit=10
export const getInvoices = async (req, res) => {
  try {
    const { view = "active", search = "", page = 1, limit = 10 } = req.query;
    const filter = { view };
    if (search.trim()) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { client: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    const [invoices, total, totalsAgg] = await Promise.all([
      AdminInvoiceSchema.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      AdminInvoiceSchema.countDocuments(filter),
      AdminInvoiceSchema.aggregate([
        { $match: filter },
        { $group: { _id: null, grandTotal: { $sum: "$invoiceTotal" } } },
      ]),
    ]);

    res.json({
      success: true,
      invoices,
      total,
      page: pageNum,
      limit: limitNum,
      grandTotal: totalsAgg[0]?.grandTotal || 0,
    });
  } catch (err) {
    console.error("[INVOICES] getInvoices error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch invoices" });
  }
};

// GET /api/admin/invoices/:id
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await AdminInvoiceSchema.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, invoice });
  } catch (err) {
    console.error("[INVOICES] getInvoiceById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch invoice" });
  }
};

// POST /api/admin/invoices
// body: { client, clientRemark, invoiceNumber, dateOfIssue, poNumber, lineItems: [{itemRefId, description, unitPrice, units, gstPercent}], bankRefId, bankName, terms, roundOffEnabled, roundOffAmount, status }
export const createInvoice = async (req, res) => {
  try {
    const {
      clientRefId,
      clientRemark,
      invoiceNumber,
      dateOfIssue,
      poNumber,
      lineItems,
      bankRefId,
      bankName,
      terms,
      roundOffEnabled,
      roundOffAmount,
      status,
    } = req.body;

    if (!clientRefId) {
      return res.status(400).json({ success: false, message: "Client is required." });
    }
    const clientUser = await User.findOne({ _id: clientRefId, role: "autoshopowner" }).select("name");
    if (!clientUser) {
      return res.status(400).json({ success: false, message: "Selected client is not a valid auto shop owner." });
    }
    const client = clientUser.name;

    if (!invoiceNumber || !invoiceNumber.trim()) {
      return res.status(400).json({ success: false, message: "Invoice number is required." });
    }
    if (!dateOfIssue) {
      return res.status(400).json({ success: false, message: "Date of issue is required." });
    }
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ success: false, message: "At least one line item is required." });
    }

    const items = await buildInvoiceItems(lineItems);
    const { subtotal, gst, roundOff, invoiceTotal } = computeTotals(items, roundOffEnabled, roundOffAmount);

    const invoice = await AdminInvoiceSchema.create({
      clientRefId: clientUser._id,
      client: client.trim(),
      clientRemark: clientRemark?.trim() || "",
      invoiceNumber: invoiceNumber.trim(),
      dateOfIssue,
      poNumber: poNumber?.trim() || "",
      items,
      subtotal,
      gst,
      roundOff,
      invoiceTotal,
      bankRefId: bankRefId || undefined,
      bankName: bankName || "",
      terms: terms || "",
      status: status || "Draft",
      view: "active",
    });

    // No stock decrement or adjustment

    res.status(201).json({ success: true, invoice });
  } catch (err) {
    console.error("[INVOICES] createInvoice error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Invoice number already exists." });
    }
    res.status(400).json({ success: false, message: err.message || "Failed to create invoice" });
  }
};

// PUT /api/admin/invoices/:id
// Same body shape as create. No stock to reconcile, just update invoice.
export const updateInvoice = async (req, res) => {
  try {
    const existing = await AdminInvoiceSchema.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Invoice not found" });

    const {
      clientRefId,
      clientRemark,
      invoiceNumber,
      dateOfIssue,
      poNumber,
      lineItems,
      bankRefId,
      bankName,
      terms,
      roundOffEnabled,
      roundOffAmount,
      status,
    } = req.body;

    let clientUser = null;
    if (clientRefId !== undefined) {
      if (!clientRefId) {
        return res.status(400).json({ success: false, message: "Client is required." });
      }
      clientUser = await User.findOne({ _id: clientRefId, role: "autoshopowner" }).select("name");
      if (!clientUser) {
        return res.status(400).json({ success: false, message: "Selected client is not a valid auto shop owner." });
      }
    }

    let newItems = existing.items;
    if (Array.isArray(lineItems)) {
      if (lineItems.length === 0) {
        return res.status(400).json({ success: false, message: "At least one line item is required." });
      }
      newItems = await buildInvoiceItems(lineItems);
    }

    const { subtotal, gst, roundOff, invoiceTotal } = computeTotals(
      newItems,
      roundOffEnabled !== undefined ? roundOffEnabled : existing.roundOff > 0,
      roundOffAmount !== undefined ? roundOffAmount : existing.roundOff
    );

    if (clientUser) {
      existing.clientRefId = clientUser._id;
      existing.client = clientUser.name;
    }
    existing.clientRemark = clientRemark !== undefined ? clientRemark.trim() : existing.clientRemark;
    existing.invoiceNumber = invoiceNumber !== undefined ? invoiceNumber.trim() : existing.invoiceNumber;
    existing.dateOfIssue = dateOfIssue !== undefined ? dateOfIssue : existing.dateOfIssue;
    existing.poNumber = poNumber !== undefined ? poNumber.trim() : existing.poNumber;
    existing.items = newItems;
    existing.subtotal = subtotal;
    existing.gst = gst;
    existing.roundOff = roundOff;
    existing.invoiceTotal = invoiceTotal;
    existing.bankRefId = bankRefId !== undefined ? bankRefId || undefined : existing.bankRefId;
    existing.bankName = bankName !== undefined ? bankName : existing.bankName;
    existing.terms = terms !== undefined ? terms : existing.terms;
    existing.status = status !== undefined ? status : existing.status;

    await existing.save();
    res.json({ success: true, invoice: existing });
  } catch (err) {
    console.error("[INVOICES] updateInvoice error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Invoice number already exists." });
    }
    res.status(400).json({ success: false, message: err.message || "Failed to update invoice" });
  }
};

// PATCH /api/admin/invoices/bulk  { ids: [], action: "archive" | "delete" | "restore" | "send" | "markPaid" | "markDraft" }
// All stock logic removed.
export const bulkUpdateInvoices = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No invoices selected." });
    }

    if (action === "delete") {
      await AdminInvoiceSchema.updateMany({ _id: { $in: ids } }, { $set: { view: "deleted" } });
      return res.json({ success: true, message: "Invoice(s) deleted." });
    }

    const map = {
      archive: { view: "archived" },
      restore: { view: "active" },
      send: { status: "Sent" },
      markPaid: { status: "Paid" },
      markDraft: { status: "Draft" },
    };
    const update = map[action];
    if (!update) return res.status(400).json({ success: false, message: "Invalid action." });

    await AdminInvoiceSchema.updateMany({ _id: { $in: ids } }, { $set: update });
    res.json({ success: true, message: "Invoice(s) updated." });
  } catch (err) {
    console.error("[INVOICES] bulkUpdateInvoices error:", err);
    res.status(500).json({ success: false, message: "Failed to update invoices" });
  }
};

// POST /api/admin/invoices/copy  { ids: [], invoiceCode, startingSeq }
// Duplicates invoices as new Draft invoices. No stock processed.
export const copyInvoices = async (req, res) => {
  try {
    const { ids, nextInvoiceNumbers } = req.body; // nextInvoiceNumbers: array of strings, same order as ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No invoices selected." });
    }
    if (!Array.isArray(nextInvoiceNumbers) || nextInvoiceNumbers.length !== ids.length) {
      return res.status(400).json({ success: false, message: "Invoice numbers for copies are required." });
    }

    const originals = await AdminInvoiceSchema.find({ _id: { $in: ids } });
    const created = [];
    for (let i = 0; i < originals.length; i++) {
      const orig = originals[i];
      const copy = await AdminInvoiceSchema.create({
        client: orig.client,
        clientRemark: orig.clientRemark,
        invoiceNumber: nextInvoiceNumbers[i],
        dateOfIssue: orig.dateOfIssue,
        poNumber: orig.poNumber,
        items: orig.items,
        subtotal: orig.subtotal,
        gst: orig.gst,
        roundOff: orig.roundOff,
        invoiceTotal: orig.invoiceTotal,
        bankRefId: orig.bankRefId,
        bankName: orig.bankName,
        terms: orig.terms,
        status: "Draft",
        view: "active",
      });
      // No adjustStock performed on copies
      created.push(copy);
    }

    res.status(201).json({ success: true, invoices: created });
  } catch (err) {
    console.error("[INVOICES] copyInvoices error:", err);
    res.status(500).json({ success: false, message: "Failed to copy invoices" });
  }
};

export default {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  bulkUpdateInvoices,
  copyInvoices,
};
