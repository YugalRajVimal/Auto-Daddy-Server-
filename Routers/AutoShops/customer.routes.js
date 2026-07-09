import express from "express";


import {
  onboardCustomer,
  getMyOnboardedCustomers,
  editMyOnboardedCustomer,
  addVehicleToMyOnboardedCustomer,
  searchExistingCustomers,
  addToMyCustomers,
  getAllAddedCustomers,
  deleteAddedCustomer,

} from "../../Controllers/AutoShops/customers.controller.js";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";

const autoShopCustomerRouter = express.Router();

autoShopCustomerRouter.use(jwtAuth);

/* Onboarded customers (no User account, embedded in BusinessProfile) */
autoShopCustomerRouter.post("/onboard", onboardCustomer);
autoShopCustomerRouter.get("/onboarded", getMyOnboardedCustomers);
autoShopCustomerRouter.put("/onboarded/:customerId", editMyOnboardedCustomer);
autoShopCustomerRouter.post("/onboarded/:customerId/vehicles", addVehicleToMyOnboardedCustomer);

/* Existing users added as customers (pending -> approved flow) */
autoShopCustomerRouter.get("/search", searchExistingCustomers);
autoShopCustomerRouter.post("/add", addToMyCustomers);
autoShopCustomerRouter.get("/added", getAllAddedCustomers);
autoShopCustomerRouter.delete("/added/:customerId", deleteAddedCustomer);

export default autoShopCustomerRouter;

// Mount chain (as given):
// app.use("/api", router);
// router.use("/autoshopowner", autoShopNewRouter);
// autoShopNewRouter.use("/customer", autoShopCustomerRouter);
//
// Final base: {{BASE}}/api/autoshopowner/customer