import express from "express";

import AuthController from "../Controllers/AuthController/auth.controller.js";
import jwtAuth from "../middlewares/Auth/auth.middleware.js";
// import SuperAdminAuthController from "../Controllers/AuthController/super-admin.auth.controller.js";

const authRouter = express.Router();

const authController = new AuthController();
// const superAdminAuthController = new SuperAdminAuthController();


authRouter.post("/sign-up-log-in", authController.signupAndLogin);

// authRouter.post("/signin", authController.signin);
authRouter.post("/verify-otp", authController.verifyAccount);

authRouter.post("/", jwtAuth, authController.checkAuth);

authRouter.put("/complete-profile", jwtAuth, authController.completeProfile);




authRouter.post("/signout", jwtAuth, authController.signOut);



// authRouter.post("/super-admin/check-auth",jwtAuth, superAdminAuthController.checkAuth);
// authRouter.post("/super-admin/login", superAdminAuthController.login);
// authRouter.post("/super-admin/forgot-password", superAdminAuthController.forgotPassword);
// authRouter.post("/super-admin/verify-account", superAdminAuthController.verifyAccount);
// authRouter.post("/super-admin/reset-password", superAdminAuthController.resetPassword);


export default authRouter;
