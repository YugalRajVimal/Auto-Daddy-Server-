import express from "express";
import {
  setInvoicePrefixController,
  getInvoicePrefixController,
  getAllInvoicePrefixesController
} from "../../Controllers/AutoShops/Invoiceprefix.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const invoicePrefixRouter = express.Router();

invoicePrefixRouter.use(jwtAuth);

// Set or update the invoice prefix for a given year (body: { prefix, year? })
invoicePrefixRouter.put("/", setInvoicePrefixController);

// Get the invoice prefix for a specific year (?year=2026, defaults to current year)
invoicePrefixRouter.get("/", getInvoicePrefixController);

// Get all invoice prefix history for this business (all years set so far)
invoicePrefixRouter.get("/all", getAllInvoicePrefixesController);

export default invoicePrefixRouter;

// Mount with: autoShopNewRouter.use("/invoice-prefix", invoicePrefixRouter);
// Final base: {{BASE}}/api/autoshopowner/invoice-prefix