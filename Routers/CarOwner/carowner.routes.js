import express from "express";
import approvalsRouter from "./carOwnerApproval.routes.js";
import { getHome, inviteHelpCarOwnerToShopOwner } from "../../Controllers/CarOwner/home.controller.js";

// Endpoint for car owner to send an invite help audio to the Admin
import { Router } from "express";
import multer from "multer";
import jwtAuth from "../../middlewares/Auth/auth.middleware.js";


// Setup multer memory storage for audio uploads
const uploadAudio = multer({ storage: multer.memoryStorage() });

const carownerRouter = express.Router();

// Home route for Car Owner, delivers personalized home screen info
carownerRouter.get("/home", getHome);

// Mount additional Car Owner related routes here (e.g., approvals sub-router)
carownerRouter.use("/approvals", approvalsRouter);

carownerRouter.post(
    "/invite-help-shopowner",
    jwtAuth,
    uploadAudio.single("audio"),
    async (req, res) => {
      await inviteHelpCarOwnerToShopOwner(req, res);
    }
  );



export default carownerRouter;
