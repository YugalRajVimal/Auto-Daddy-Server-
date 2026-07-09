import express from "express";
import autoShopProfileRouter from "./profile.routes.js";
import autoShopHomeRouter from "./home.routes.js";
import autoShopServicesRouter from "./services.routes.js";
import autoShopCustomerRouter from "./customer.routes.js";
import autoShopAccountsRouter from "./accounts.routes.js";


const autoShopNewRouter = express.Router();


autoShopNewRouter.use("/home", autoShopHomeRouter);


autoShopNewRouter.use("/profile",autoShopProfileRouter)

autoShopNewRouter.use("/services", autoShopServicesRouter);



autoShopNewRouter.use("/customer", autoShopCustomerRouter);

autoShopNewRouter.use("/account", autoShopAccountsRouter);





export default autoShopNewRouter;