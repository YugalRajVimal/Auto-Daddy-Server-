import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import Bank from "../../Schema/Accounts/bank.schema.js";
import Expense from "../../Schema/Accounts/expenses.schema.js";
import Income from "../../Schema/Accounts/income.schema.js";
import ExpenseCategory from "../../Schema/Accounts/expensesCategoryDropdown.schema.js";


function isValidDate(value) {
  return !isNaN(new Date(value).getTime());
}

const BANK_REQUIRED_PAYMENT_MODES = ["Bank Transfer", "Cheque"];

/* ==================== EXPENSES ==================== */

/**
 * Add a new expense, with optional expenseImage upload
 * POST /admin/accounts/expenses
 * Body: { date, vendor, amount, category, notes?, gst?, billNumber?, byCheque?, account? }
 * File: expenseImage (optional)
 */



/**
 * Add a new expense category with optional subcategories
 * POST /admin/accounts/expenses-category
 * Body: { name, subcategories: [string] }
 */
export const addExpenseCategory = async (req, res) => {
  try {
    const { name, subcategories } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required." });
    }
    // Check if exists
    const existingCategory = await ExpenseCategory.findOne({ name: name.trim() });
    if (existingCategory) {
      return res.status(409).json({ success: false, message: `Expense category '${name}' already exists.` });
    }

    const category = new ExpenseCategory({
      name: name.trim(),
      subcategories: Array.isArray(subcategories)
        ? subcategories
            .filter((s) => !!s && !!s.trim())
            .map((s) => ({ name: s.trim() }))
        : [],
    });

    await category.save();
    return res.status(201).json({ success: true, data: category });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to add expense category.", error: err.message });
  }
};

/**
 * Edit an expense category's name or subcategories
 * PUT /admin/accounts/expenses-category/:id
 * Body: { name?, subcategories? }
 */
export const editExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subcategories } = req.body;

    const category = await ExpenseCategory.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Expense category not found." });
    }

    if (name && name.trim()) {
      // Check for name conflict
      const nameConflict = await ExpenseCategory.findOne({ name: name.trim(), _id: { $ne: id } });
      if (nameConflict) {
        return res.status(409).json({ success: false, message: `Another category named '${name}' already exists.` });
      }
      category.name = name.trim();
    }

    if (subcategories && Array.isArray(subcategories)) {
      category.subcategories = subcategories
        .filter((s) => !!s && !!s.trim())
        .map((s) => ({ name: s.trim() }));
    }

    await category.save();
    return res.status(200).json({ success: true, data: category });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to edit expense category.", error: err.message });
  }
};

/**
 * Remove (delete) an expense category (and its subcategories)
 * DELETE /admin/accounts/expenses-category/:id
 */
export const removeExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await ExpenseCategory.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Expense category not found." });
    }

    return res.status(200).json({ success: true, message: "Expense category deleted." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete expense category.", error: err.message });
  }
};

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
  let imagePath = null;
  try {
    const { date, vendor, amount, category, notes, gst, billNumber, byCheque, account } = req.body;

    const byChequeBool = byCheque === true || byCheque === "true";

    if (!date || !vendor || amount === undefined || !category) {
      if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
      return res.status(400).json({ success: false, message: "date, vendor, amount and category are required." });
    }

    if (!isValidDate(date)) {
      if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    if (isNaN(Number(amount)) || Number(amount) < 0) {
      if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
      return res.status(400).json({ success: false, message: "amount must be a positive number." });
    }

    if (byChequeBool && !account) {
      if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
      return res.status(400).json({ success: false, message: "account is required when byCheque is true." });
    }

    if (req.files && req.files.expenseImage && req.files.expenseImage[0]) {
      imagePath = req.files.expenseImage[0].path;
    }

    const expenseData = {
      date: new Date(date),
      vendor: vendor.trim(),
      amount: Number(amount),
      category: category.trim(),
      byCheque: byChequeBool,
      imagePath: imagePath || null,
    };

    if (notes) expenseData.notes = notes.trim();
    if (gst !== undefined && gst !== "") expenseData.gst = Number(gst);
    if (billNumber) expenseData.billNumber = billNumber.trim();
    if (byChequeBool && account) expenseData.account = account.trim();

    const newExpense = new Expense(expenseData);
    await newExpense.save();

    return res.status(201).json({ success: true, data: newExpense });
  } catch (err) {
    if (imagePath) deleteUploadedFile(imagePath);
    console.error("[addExpense] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to add expense", error: err.message });
  }
};

/**
 * Edit an expense by ID, with optional expenseImage replace
 * PATCH /admin/accounts/expenses/:id
 */
export const editExpense = async (req, res) => {
  let imagePath = null;
  try {
    const { id } = req.params;
    const { date, vendor, amount, category, notes, gst, billNumber, byCheque, account } = req.body;

    const hasTextUpdate = date || vendor || amount !== undefined || category ||
      notes || gst !== undefined || billNumber || byCheque !== undefined || account;

    if (!hasTextUpdate && !req.files?.expenseImage) {
      if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    const updateFields = {};

    if (date) {
      if (!isValidDate(date)) {
        if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
        return res.status(400).json({ success: false, message: "Invalid date." });
      }
      updateFields.date = new Date(date);
    }

    if (amount !== undefined) {
      if (isNaN(Number(amount)) || Number(amount) < 0) {
        if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
        return res.status(400).json({ success: false, message: "amount must be a positive number." });
      }
      updateFields.amount = Number(amount);
    }

    if (vendor) updateFields.vendor = vendor.trim();
    if (category) updateFields.category = category.trim();
    if (notes) updateFields.notes = notes.trim();
    if (gst !== undefined && gst !== "") updateFields.gst = Number(gst);
    if (billNumber) updateFields.billNumber = billNumber.trim();

    let byChequeBool;
    if (byCheque !== undefined) {
      byChequeBool = byCheque === true || byCheque === "true";
      updateFields.byCheque = byChequeBool;
    }

    // If byCheque is being set true (either now or already true) and no account given, reject
    const existingForCheck = byChequeBool !== undefined ? null : await Expense.findById(id);
    const effectiveByCheque = byChequeBool !== undefined ? byChequeBool : existingForCheck?.byCheque;

    if (effectiveByCheque && !account && !(existingForCheck?.account)) {
      if (req.files?.expenseImage?.[0]) deleteUploadedFile(req.files.expenseImage[0]);
      return res.status(400).json({ success: false, message: "account is required when byCheque is true." });
    }

    if (account) updateFields.account = account.trim();

    if (req.files && req.files.expenseImage && req.files.expenseImage[0]) {
      imagePath = req.files.expenseImage[0].path;
      updateFields.imagePath = imagePath;
    }

    let prevExpense = null;
    if (imagePath) {
      prevExpense = await Expense.findById(id);
    }

    const updated = await Expense.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });
    if (!updated) {
      if (imagePath) deleteUploadedFile(imagePath);
      return res.status(404).json({ success: false, message: "Expense not found." });
    }

    if (imagePath && prevExpense && prevExpense.imagePath && prevExpense.imagePath !== imagePath) {
      deleteUploadedFile(prevExpense.imagePath);
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (imagePath) deleteUploadedFile(imagePath);
    console.error("[editExpense] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to edit expense", error: err.message });
  }
};

/**
 * Fetch expenses, optional filters
 * GET /admin/accounts/expenses?category=Fuel&vendor=Shell&byCheque=true&from=2026-01-01&to=2026-12-31
 */
export const getExpenses = async (req, res) => {
  try {
    const { category, vendor, byCheque, account, from, to } = req.query;
    const filter = {};

    if (category) filter.category = { $regex: category, $options: "i" };
    if (vendor) filter.vendor = { $regex: vendor, $options: "i" };
    if (account) filter.account = { $regex: account, $options: "i" };
    if (byCheque !== undefined) filter.byCheque = byCheque === "true";

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });
    return res.status(200).json({ success: true, data: expenses });
  } catch (err) {
    console.error("[getExpenses] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch expenses", error: err.message });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found." });
    return res.status(200).json({ success: true, data: expense });
  } catch (err) {
    console.error("[getExpenseById] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch expense", error: err.message });
  }
};

/**
 * Delete an expense (also deletes its uploaded image, if any)
 * DELETE /admin/accounts/expenses/:id
 */
export const deleteExpense = async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Expense not found." });
    if (deleted.imagePath) deleteUploadedFile(deleted.imagePath);
    return res.status(200).json({ success: true, message: "Expense deleted." });
  } catch (err) {
    console.error("[deleteExpense] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete expense", error: err.message });
  }
};

/* ==================== INCOME ==================== */

/**
 * Add a new income record, with optional incomeImage upload
 * POST /admin/accounts/income
 * Body: { date, vendor, amount, paymentMode, bank?, category, notes? }
 * File: incomeImage (optional)
 */
export const addIncome = async (req, res) => {
  let imagePath = null;
  try {
    const { date, vendor, amount, paymentMode, bank, category, notes } = req.body;

    if (!date || !vendor || amount === undefined || !paymentMode || !category) {
      if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
      return res.status(400).json({
        success: false,
        message: "date, vendor, amount, paymentMode and category are required.",
      });
    }

    if (!isValidDate(date)) {
      if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    if (isNaN(Number(amount)) || Number(amount) < 0) {
      if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
      return res.status(400).json({ success: false, message: "amount must be a positive number." });
    }

    if (BANK_REQUIRED_PAYMENT_MODES.includes(paymentMode) && !bank) {
      if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
      return res.status(400).json({
        success: false,
        message: `bank is required when paymentMode is one of: ${BANK_REQUIRED_PAYMENT_MODES.join(", ")}.`,
      });
    }

    if (req.files && req.files.incomeImage && req.files.incomeImage[0]) {
      imagePath = req.files.incomeImage[0].path;
    }

    const incomeData = {
      date: new Date(date),
      vendor: vendor.trim(),
      amount: Number(amount),
      paymentMode: paymentMode.trim(),
      category: category.trim(),
      image: imagePath || null,
    };

    if (bank) incomeData.bank = bank.trim();
    if (notes) incomeData.notes = notes.trim();

    const newIncome = new Income(incomeData);
    await newIncome.save();

    return res.status(201).json({ success: true, data: newIncome });
  } catch (err) {
    if (imagePath) deleteUploadedFile(imagePath);
    console.error("[addIncome] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to add income", error: err.message });
  }
};

/**
 * Edit an income record by ID, with optional incomeImage replace
 * PATCH /admin/accounts/income/:id
 */
export const editIncome = async (req, res) => {
  let imagePath = null;
  try {
    const { id } = req.params;
    const { date, vendor, amount, paymentMode, bank, category, notes } = req.body;

    const hasTextUpdate = date || vendor || amount !== undefined || paymentMode || bank || category || notes;

    if (!hasTextUpdate && !req.files?.incomeImage) {
      if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    const updateFields = {};

    if (date) {
      if (!isValidDate(date)) {
        if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
        return res.status(400).json({ success: false, message: "Invalid date." });
      }
      updateFields.date = new Date(date);
    }

    if (amount !== undefined) {
      if (isNaN(Number(amount)) || Number(amount) < 0) {
        if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
        return res.status(400).json({ success: false, message: "amount must be a positive number." });
      }
      updateFields.amount = Number(amount);
    }

    if (vendor) updateFields.vendor = vendor.trim();
    if (category) updateFields.category = category.trim();
    if (notes) updateFields.notes = notes.trim();
    if (paymentMode) updateFields.paymentMode = paymentMode.trim();

    const effectivePaymentMode = paymentMode || (await Income.findById(id))?.paymentMode;
    if (BANK_REQUIRED_PAYMENT_MODES.includes(effectivePaymentMode) && !bank) {
      const existing = await Income.findById(id);
      if (!existing?.bank) {
        if (req.files?.incomeImage?.[0]) deleteUploadedFile(req.files.incomeImage[0]);
        return res.status(400).json({
          success: false,
          message: `bank is required when paymentMode is one of: ${BANK_REQUIRED_PAYMENT_MODES.join(", ")}.`,
        });
      }
    }
    if (bank) updateFields.bank = bank.trim();

    if (req.files && req.files.incomeImage && req.files.incomeImage[0]) {
      imagePath = req.files.incomeImage[0].path;
      updateFields.image = imagePath;
    }

    let prevIncome = null;
    if (imagePath) {
      prevIncome = await Income.findById(id);
    }

    const updated = await Income.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });
    if (!updated) {
      if (imagePath) deleteUploadedFile(imagePath);
      return res.status(404).json({ success: false, message: "Income record not found." });
    }

    if (imagePath && prevIncome && prevIncome.image && prevIncome.image !== imagePath) {
      deleteUploadedFile(prevIncome.image);
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (imagePath) deleteUploadedFile(imagePath);
    console.error("[editIncome] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to edit income", error: err.message });
  }
};

/**
 * Fetch income records, optional filters
 * GET /admin/accounts/income?category=Sales&paymentMode=Cash&bank=HDFC&from=2026-01-01&to=2026-12-31
 */
export const getIncomes = async (req, res) => {
  try {
    const { category, vendor, paymentMode, bank, from, to } = req.query;
    const filter = {};

    if (category) filter.category = { $regex: category, $options: "i" };
    if (vendor) filter.vendor = { $regex: vendor, $options: "i" };
    if (paymentMode) filter.paymentMode = paymentMode;
    if (bank) filter.bank = { $regex: bank, $options: "i" };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const incomes = await Income.find(filter).sort({ date: -1 });
    return res.status(200).json({ success: true, data: incomes });
  } catch (err) {
    console.error("[getIncomes] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch income records", error: err.message });
  }
};

export const getIncomeById = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);
    if (!income) return res.status(404).json({ success: false, message: "Income record not found." });
    return res.status(200).json({ success: true, data: income });
  } catch (err) {
    console.error("[getIncomeById] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch income record", error: err.message });
  }
};

/**
 * Delete an income record (also deletes its uploaded image, if any)
 * DELETE /admin/accounts/income/:id
 */
export const deleteIncome = async (req, res) => {
  try {
    const deleted = await Income.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Income record not found." });
    if (deleted.image) deleteUploadedFile(deleted.image);
    return res.status(200).json({ success: true, message: "Income record deleted." });
  } catch (err) {
    console.error("[deleteIncome] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete income record", error: err.message });
  }
};

/* ==================== BANK ==================== */

/**
 * Add a new bank account (no image)
 * POST /admin/accounts/banks
 * Body: { BankName, status?, openingBalance, AccountName?, AccountNumber?, Interac? }
 */
export const addBank = async (req, res) => {
  try {
    const { BankName, status, openingBalance, AccountName, AccountNumber, Interac } = req.body;

    if (!BankName || openingBalance === undefined) {
      return res.status(400).json({ success: false, message: "BankName and openingBalance are required." });
    }

    if (isNaN(Number(openingBalance)) || Number(openingBalance) < 0) {
      return res.status(400).json({ success: false, message: "openingBalance must be a positive number." });
    }

    const existing = await Bank.findOne({ BankName });
    if (existing) {
      return res.status(409).json({ success: false, message: "Bank with this name already exists." });
    }

    const bankData = {
      BankName: BankName.trim(),
      openingBalance: Number(openingBalance),
      totalBalance: Number(openingBalance), // starts equal to opening balance
    };

    if (status) bankData.status = status.trim();
    if (AccountName) bankData.AccountName = AccountName.trim();
    if (AccountNumber) bankData.AccountNumber = AccountNumber.trim();
    if (Interac) bankData.Interac = Interac.trim();

    const newBank = new Bank(bankData);
    await newBank.save();

    return res.status(201).json({ success: true, data: newBank });
  } catch (err) {
    console.error("[addBank] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to add bank", error: err.message });
  }
};

/**
 * Edit a bank account
 * PATCH /admin/accounts/banks/:id
 */
export const editBank = async (req, res) => {
  try {
    const { id } = req.params;
    const { BankName, status, openingBalance, totalBalance, AccountName, AccountNumber, Interac } = req.body;

    const updateFields = {};
    if (BankName) updateFields.BankName = BankName.trim();
    if (status) updateFields.status = status.trim();
    if (AccountName) updateFields.AccountName = AccountName.trim();
    if (AccountNumber) updateFields.AccountNumber = AccountNumber.trim();
    if (Interac) updateFields.Interac = Interac.trim();

    if (openingBalance !== undefined) {
      if (isNaN(Number(openingBalance)) || Number(openingBalance) < 0) {
        return res.status(400).json({ success: false, message: "openingBalance must be a positive number." });
      }
      updateFields.openingBalance = Number(openingBalance);
    }

    if (totalBalance !== undefined) {
      if (isNaN(Number(totalBalance)) || Number(totalBalance) < 0) {
        return res.status(400).json({ success: false, message: "totalBalance must be a positive number." });
      }
      updateFields.totalBalance = Number(totalBalance);
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    // If BankName is changing, check for duplicates
    if (BankName) {
      const existing = await Bank.findOne({ BankName, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ success: false, message: "Another bank with this name already exists." });
      }
    }

    const updated = await Bank.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Bank not found." });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[editBank] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to edit bank", error: err.message });
  }
};

/**
 * Fetch banks, optional filters
 * GET /admin/accounts/banks?status=active&name=HDFC
 */
export const getBanks = async (req, res) => {
  try {
    const { status, name } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (name) filter.BankName = { $regex: name, $options: "i" };

    const banks = await Bank.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: banks });
  } catch (err) {
    console.error("[getBanks] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch banks", error: err.message });
  }
};

export const getBankById = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "Bank not found." });
    return res.status(200).json({ success: true, data: bank });
  } catch (err) {
    console.error("[getBankById] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch bank", error: err.message });
  }
};

/**
 * Delete a bank account
 * DELETE /admin/accounts/banks/:id
 */
export const deleteBank = async (req, res) => {
  try {
    const deleted = await Bank.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Bank not found." });
    return res.status(200).json({ success: true, message: "Bank deleted." });
  } catch (err) {
    console.error("[deleteBank] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete bank", error: err.message });
  }
};