import express from "express";
// import adminRouter from "./Routers/admin.routes.js";
import authRouter from "./Routers/auth.routes.js";
// import parentRouter from "./Routers/parent.routes.js";
// import therapistRouter from "./Routers/therapist.routes.js";
// import superAdminRouter from "./Routers/super-admin.routes.js";
import carOwnerRouter from "./Routers/car-owner.routes.js";
import userRouter from "./Routers/user.routes.js";
import autoShopRouter from "./Routers/auto-shop.routes.js";
import reportRouter from "./Routers/report.routes.js";
// import discountRouter from "./Routers/discount.routes.js";


const router = express.Router();

router.get("/", (req, res) => {
  res.send("Welcome to EV App Server APIs");
});

router.use("/auth", authRouter);
// router.use("/admin", adminRouter);
// router.use("/super-admin", superAdminRouter);
// router.use("/parent", parentRouter);
// router.use("/therapist", therapistRouter);

router.use("/user", userRouter);

router.use("/car-owner", carOwnerRouter);


router.use("/auto-shop-owner", autoShopRouter);

router.use("/report", reportRouter);

// router.use("/discount", discountRouter);






export default router;
