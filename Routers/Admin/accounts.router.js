// import express from "express";

// import {
//   addExpenseCategory,
//   editExpenseCategory,
//   removeExpenseCategory,
//   fetchExpenseCategories,
//   addExpense, editExpense, getExpenses, getExpenseById, deleteExpense,
//   addIncome, editIncome, getIncomes, getIncomeById, deleteIncome,
//   addBank, editBank, getBanks, getBankById, deleteBank,
// } from "../../Controllers/Admin/accounts.controller.js";
// import { expenseImageUploadMiddleware, incomeImageUploadMiddleware } from "../../middlewares/ImageUploadMiddlewares/accountsUpload.middleware.js";

// const accountsRouter = express.Router();



// // ---- Expense Categories ----
// accountsRouter.post("/expenses-category", addExpenseCategory);
// accountsRouter.put("/expenses-category/:id", editExpenseCategory);
// accountsRouter.delete("/expenses-category/:id", removeExpenseCategory);
// accountsRouter.get("/expenses-category", fetchExpenseCategories);


// // ---- Expenses ----
// accountsRouter.post("/expenses", expenseImageUploadMiddleware, addExpense);
// accountsRouter.get("/expenses", getExpenses);
// accountsRouter.get("/expenses/:id", getExpenseById);
// accountsRouter.patch("/expenses/:id", expenseImageUploadMiddleware, editExpense);
// accountsRouter.delete("/expenses/:id", deleteExpense);

// // ---- Income ----
// accountsRouter.post("/income", incomeImageUploadMiddleware, addIncome);
// accountsRouter.get("/income", getIncomes);
// accountsRouter.get("/income/:id", getIncomeById);
// accountsRouter.patch("/income/:id", incomeImageUploadMiddleware, editIncome);
// accountsRouter.delete("/income/:id", deleteIncome);

// // ---- Banks ----
// accountsRouter.post("/banks", addBank);
// accountsRouter.get("/banks", getBanks);
// accountsRouter.get("/banks/:id", getBankById);
// accountsRouter.patch("/banks/:id", editBank);
// accountsRouter.delete("/banks/:id", deleteBank);

// export default accountsRouter;

// Routers/Admin/accounts.router.js
//
// MODULE MAP:
//   expenses-category, expenses  -> accounts.expenses
//   income                       -> NOT in the confirmed module tree (only
//                                    "Expenses" and "Bank" sub-navs exist
//                                    under Accounts). Gated as
//                                    accounts.expenses for now — confirm
//                                    whether Income needs its own sub-nav
//                                    or truly belongs under Expenses.
//   banks                        -> accounts.bank

import express from "express";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";
import { requireNavPermission } from "../../middlewares/Permission.middleware.js"


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
accountsRouter.use(jwtAuth);

// ---- Expense Categories ----
accountsRouter.post("/expenses-category", requireNavPermission("accounts", "expenses", "create"), addExpenseCategory);
accountsRouter.put("/expenses-category/:id", requireNavPermission("accounts", "expenses", "update"), editExpenseCategory);
accountsRouter.delete("/expenses-category/:id", requireNavPermission("accounts", "expenses", "delete"), removeExpenseCategory);
accountsRouter.get("/expenses-category", requireNavPermission("accounts", "expenses", "view"), fetchExpenseCategories);

// ---- Expenses ----
accountsRouter.post("/expenses", requireNavPermission("accounts", "expenses", "create"), expenseImageUploadMiddleware, addExpense);
accountsRouter.get("/expenses", requireNavPermission("accounts", "expenses", "view"), getExpenses);
accountsRouter.get("/expenses/:id", requireNavPermission("accounts", "expenses", "view"), getExpenseById);
accountsRouter.patch("/expenses/:id", requireNavPermission("accounts", "expenses", "update"), expenseImageUploadMiddleware, editExpense);
accountsRouter.delete("/expenses/:id", requireNavPermission("accounts", "expenses", "delete"), deleteExpense);

// ---- Income (see MODULE MAP note above — gated under accounts.expenses) ----
accountsRouter.post("/income", requireNavPermission("accounts", "expenses", "create"), incomeImageUploadMiddleware, addIncome);
accountsRouter.get("/income", requireNavPermission("accounts", "expenses", "view"), getIncomes);
accountsRouter.get("/income/:id", requireNavPermission("accounts", "expenses", "view"), getIncomeById);
accountsRouter.patch("/income/:id", requireNavPermission("accounts", "expenses", "update"), incomeImageUploadMiddleware, editIncome);
accountsRouter.delete("/income/:id", requireNavPermission("accounts", "expenses", "delete"), deleteIncome);

// ---- Banks ----
accountsRouter.post("/banks", requireNavPermission("accounts", "bank", "create"), addBank);
accountsRouter.get("/banks", requireNavPermission("accounts", "bank", "view"), getBanks);
accountsRouter.get("/banks/:id", requireNavPermission("accounts", "bank", "view"), getBankById);
accountsRouter.patch("/banks/:id", requireNavPermission("accounts", "bank", "update"), editBank);
accountsRouter.delete("/banks/:id", requireNavPermission("accounts", "bank", "delete"), deleteBank);

export default accountsRouter;