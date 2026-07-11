import mongoose from "mongoose";
import AutoShopBank from "../../Schema/AutoShopAccounts/autoShopBank.schema.js";
import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import AutoShopExpense from "../../Schema/AutoShopAccounts/autoShopExpenses.schema.js";
import { User } from "../../Schema/user.schema.js";
import ExpenseCategory from "../../Schema/Accounts/expensesCategoryDropdown.schema.js";



/* Helper: resolve the caller's businessProfile id from DB (req.user only
   ever has { id, role, ... } from jwtAuth — never businessProfile). */
async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

/* =========================================================
   BANK ACCOUNTS
   ========================================================= */

export const addBankAccount = async (req, res) => {
  try {
    const { BankName, openingBalance, AccountName, AccountNumber, assignToInvoice } = req.body;

    if (!BankName || openingBalance === undefined) {
      return res.status(400).json({
        success: false,
        message: "BankName and openingBalance are required",
      });
    }
    if (openingBalance < 0) {
      return res.status(400).json({ success: false, message: "openingBalance cannot be negative" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const bank = await AutoShopBank.create({
      businessProfile: businessId,
      BankName,
      openingBalance,
      totalBalance: openingBalance, // starts equal to opening balance
      AccountName,
      AccountNumber,
      assignToInvoice: assignToInvoice || false,
    });

    return res.status(201).json({ success: true, message: "Bank account added", data: bank });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add bank account",
      error: error.message,
    });
  }
};

export const editBankAccount = async (req, res) => {
  try {
    const { bankId } = req.params;
    const { BankName, openingBalance, totalBalance, AccountName, AccountNumber, assignToInvoice } =
      req.body;

    if (!mongoose.Types.ObjectId.isValid(bankId)) {
      return res.status(400).json({ success: false, message: "Invalid bankId" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    // Scoped to this shop's own business — a bank belonging to another
    // shop simply won't be found.
    const bank = await AutoShopBank.findOne({ _id: bankId, businessProfile: businessId });
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank account not found (or does not belong to your shop)",
      });
    }

    if (openingBalance !== undefined && openingBalance < 0) {
      return res.status(400).json({ success: false, message: "openingBalance cannot be negative" });
    }
    if (totalBalance !== undefined && totalBalance < 0) {
      return res.status(400).json({ success: false, message: "totalBalance cannot be negative" });
    }

    if (BankName !== undefined) bank.BankName = BankName;
    if (openingBalance !== undefined) bank.openingBalance = openingBalance;
    if (totalBalance !== undefined) bank.totalBalance = totalBalance;
    if (AccountName !== undefined) bank.AccountName = AccountName;
    if (AccountNumber !== undefined) bank.AccountNumber = AccountNumber;
    if (assignToInvoice !== undefined) bank.assignToInvoice = assignToInvoice;

    await bank.save();

    return res.status(200).json({ success: true, message: "Bank account updated", data: bank });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update bank account",
      error: error.message,
    });
  }
};

export const getBankAccounts = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const banks = await AutoShopBank.find({ businessProfile: businessId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: banks });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bank accounts",
      error: error.message,
    });
  }
};

export const getBankAccountById = async (req, res) => {
  try {
    const { bankId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bankId)) {
      return res.status(400).json({ success: false, message: "Invalid bankId" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const bank = await AutoShopBank.findOne({ _id: bankId, businessProfile: businessId });
    if (!bank) {
      return res.status(404).json({ success: false, message: "Bank account not found" });
    }

    return res.status(200).json({ success: true, data: bank });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bank account",
      error: error.message,
    });
  }
};

/* =========================================================
   EXPENSES
   Uses `upload.single("expenseImage")` (already mapped in
   your multer middleware) for the optional bill photo.
   ========================================================= */

   /**
 * Fetch all expense categories and their subcategories
 * GET /admin/accounts/expenses-category
 */
export const fetchExpenseCategories = async (req, res) => {
  try {
    const categories = await ExpenseCategory.find();
    return res.status(200).json({ success: true, data: categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch expense categories.", error: err.message });
  }
};

export const addExpense = async (req, res) => {
  try {
    const { date, vendor, amount, category, subCategory, notes, gst, billNumber, account } =
      req.body;

    if (!date || !vendor || amount === undefined || !category || !subCategory) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "date, vendor, amount, category and subCategory are required",
      });
    }
    if (amount < 0) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(400).json({ success: false, message: "amount cannot be negative" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const expense = await AutoShopExpense.create({
      businessProfile: businessId,
      date,
      vendor,
      amount,
      category,
      subCategory,
      notes,
      gst,
      billNumber,
      account,
      imagePath: req.file ? req.file.path : undefined,
    });

    return res.status(201).json({ success: true, message: "Expense added", data: expense });
  } catch (error) {
    if (req.file) deleteUploadedFile(req.file);
    return res.status(500).json({
      success: false,
      message: "Failed to add expense",
      error: error.message,
    });
  }
};

export const editExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { date, vendor, amount, category, subCategory, notes, gst, billNumber, account } =
      req.body;

    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(400).json({ success: false, message: "Invalid expenseId" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const expense = await AutoShopExpense.findOne({ _id: expenseId, businessProfile: businessId });
    if (!expense) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(404).json({
        success: false,
        message: "Expense not found (or does not belong to your shop)",
      });
    }

    if (amount !== undefined && amount < 0) {
      if (req.file) deleteUploadedFile(req.file);
      return res.status(400).json({ success: false, message: "amount cannot be negative" });
    }

    const oldImage = expense.imagePath;

    if (date !== undefined) expense.date = date;
    if (vendor !== undefined) expense.vendor = vendor;
    if (amount !== undefined) expense.amount = amount;
    if (category !== undefined) expense.category = category;
    if (subCategory !== undefined) expense.subCategory = subCategory;
    if (notes !== undefined) expense.notes = notes;
    if (gst !== undefined) expense.gst = gst;
    if (billNumber !== undefined) expense.billNumber = billNumber;
    if (account !== undefined) expense.account = account;
    if (req.file) expense.imagePath = req.file.path;

    await expense.save();

    if (req.file && oldImage) deleteUploadedFile(oldImage);

    return res.status(200).json({ success: true, message: "Expense updated", data: expense });
  } catch (error) {
    if (req.file) deleteUploadedFile(req.file);
    return res.status(500).json({
      success: false,
      message: "Failed to update expense",
      error: error.message,
    });
  }
};

/* GET with optional filters: ?startDate=&endDate=&category=&account= */
export const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category, account } = req.query;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const filter = { businessProfile: businessId };

    if (category) filter.category = category;
    if (account) filter.account = account;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const expenses = await AutoShopExpense.find(filter).sort({ date: -1 });

    return res.status(200).json({ success: true, data: expenses });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch expenses",
      error: error.message,
    });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const { expenseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ success: false, message: "Invalid expenseId" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const expense = await AutoShopExpense.findOne({ _id: expenseId, businessProfile: businessId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.status(200).json({ success: true, data: expense });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch expense",
      error: error.message,
    });
  }
};