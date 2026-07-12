import express from "express";
import autoShopProfileRouter from "./profile.routes.js";
import autoShopHomeRouter from "./home.routes.js";
import autoShopServicesRouter from "./services.routes.js";
import autoShopCustomerRouter from "./customer.routes.js";
import autoShopAccountsRouter from "./accounts.routes.js";
import jobCardRouter from "./jobCards.routes.js";
import domainDetailsRouter from "./domainDetails.routes.js";
import websiteTemplateRouter from "./websiteTemplate.routes.js";
import autoShopDealsRouter from "./deals.routes.js";
import jobCardPrefixRouter from "./jobcardprefix.routes.js";
import subscriptionRouter from "./subscription.routes.js";


const autoShopNewRouter = express.Router();


autoShopNewRouter.use("/home", autoShopHomeRouter);

autoShopNewRouter.use("/profile",autoShopProfileRouter)

autoShopNewRouter.use("/services", autoShopServicesRouter);

autoShopNewRouter.use("/customer", autoShopCustomerRouter);

autoShopNewRouter.use("/account", autoShopAccountsRouter);

autoShopNewRouter.use("/jobcards", jobCardRouter);


autoShopNewRouter.use("/jobcard-prefix", jobCardPrefixRouter);


autoShopNewRouter.use("/domain-details", domainDetailsRouter);

autoShopNewRouter.use("/website-template", websiteTemplateRouter);

autoShopNewRouter.use("/autoshop-deals", autoShopDealsRouter);


autoShopNewRouter.use("/subscription", subscriptionRouter);



// INSERT_YOUR_CODE








export default autoShopNewRouter;