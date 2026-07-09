import express from "express";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";


import { upload } from "../../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import { addExpense, editExpense, getExpenseById, getExpenses,addBankAccount, editBankAccount, getBankAccountById, getBankAccounts  } from "../../Controllers/AutoShops/accounts.controller.js";

const autoShopAccountsRouter = express.Router();

autoShopAccountsRouter.use(jwtAuth);

/* Bank accounts */
autoShopAccountsRouter.post("/bank", addBankAccount);
autoShopAccountsRouter.put("/bank/:bankId", editBankAccount);
autoShopAccountsRouter.get("/bank", getBankAccounts);
autoShopAccountsRouter.get("/bank/:bankId", getBankAccountById);

/* Expenses */
autoShopAccountsRouter.post("/expenses", upload.single("expenseImage"), addExpense);
autoShopAccountsRouter.put("/expenses/:expenseId", upload.single("expenseImage"), editExpense);
autoShopAccountsRouter.get("/expenses", getExpenses);
autoShopAccountsRouter.get("/expenses/:expenseId", getExpenseById);

export default autoShopAccountsRouter;

// Mount, following the same chain pattern as your other autoshopowner modules:
// autoShopNewRouter.use("/account", autoShopAccountsRouter);
// -> Final base: {{BASE}}/api/autoshopowner/account