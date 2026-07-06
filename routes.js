import express from "express";
import adminRouter from "./Routers/admin.routes.js";
import authRouter from "./Routers/auth.routes.js";
import userRouter from "./Routers/user.routes.js";
import autoShopRouter from "./Routers/auto-shop.routes.js";
import reportRouter from "./Routers/report.routes.js";



const router = express.Router();

router.get("/", (req, res) => {
  res.send("Welcome to Auto Daddy App Server APIs");
});

router.use("/auth", authRouter);
router.use("/admin", adminRouter);




router.use("/user", userRouter);
router.use("/auto-shop-owner", autoShopRouter);
router.use("/report", reportRouter);




export default router;
