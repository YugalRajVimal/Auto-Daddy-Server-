import express from "express";

import {
  addExpenseCategory,
  editExpenseCategory,
  removeExpenseCategory,
  fetchExpenseCategories,
  addExpense, editExpense, getExpenses, getExpenseById, deleteExpense,
  addIncome, editIncome, getIncomes, getIncomeById, deleteIncome,
  addBank, editBank, getBanks, getBankById, deleteBank,
} from "../../Controllers/Admin/accounts.controller.js";
import { expenseImageUploadMiddleware, incomeImageUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/accountsUpload.middleware.js";

const accountsRouter = express.Router();



// ---- Expense Categories ----
accountsRouter.post("/expenses-category", addExpenseCategory);
accountsRouter.put("/expenses-category/:id", editExpenseCategory);
accountsRouter.delete("/expenses-category/:id", removeExpenseCategory);
accountsRouter.get("/expenses-category", fetchExpenseCategories);


// ---- Expenses ----
accountsRouter.post("/expenses", expenseImageUploadMiddleware, addExpense);
accountsRouter.get("/expenses", getExpenses);
accountsRouter.get("/expenses/:id", getExpenseById);
accountsRouter.patch("/expenses/:id", expenseImageUploadMiddleware, editExpense);
accountsRouter.delete("/expenses/:id", deleteExpense);

// ---- Income ----
accountsRouter.post("/income", incomeImageUploadMiddleware, addIncome);
accountsRouter.get("/income", getIncomes);
accountsRouter.get("/income/:id", getIncomeById);
accountsRouter.patch("/income/:id", incomeImageUploadMiddleware, editIncome);
accountsRouter.delete("/income/:id", deleteIncome);

// ---- Banks ----
accountsRouter.post("/banks", addBank);
accountsRouter.get("/banks", getBanks);
accountsRouter.get("/banks/:id", getBankById);
accountsRouter.patch("/banks/:id", editBank);
accountsRouter.delete("/banks/:id", deleteBank);

export default accountsRouter;