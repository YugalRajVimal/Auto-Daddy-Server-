import express from "express";
import UserController from "../Controllers/User/user.controller.js";
import jwtAuth from "../middlewares/Auth/auth.middleware.js";


const userRouter = express.Router();



const userController = new UserController();

// Route to complete user profile (for car owners)
userRouter.put("/complete-profile",jwtAuth,(req,res)=>{ userController.completeProfile(req,res)});
userRouter.get("/profile",jwtAuth,(req,res)=>{ userController.getProfileDetails(req,res)});
userRouter.post("/toggle-auto-shop-fav", jwtAuth, (req, res) => { userController.toggleAutoShopFav(req, res) });
userRouter.get("/favorite-auto-shops", jwtAuth, (req, res) => { userController.getFavAutoShops(req, res) });

// -------- VEHICLE CRUD ROUTES --------

// Add a new vehicle
userRouter.post("/vehicle", jwtAuth, (req, res) => { userController.addVehicle(req, res) });

// Edit/update a vehicle
userRouter.put("/vehicle/:vehicleId", jwtAuth, (req, res) => { userController.editVehicle(req, res) });

// Fetch all vehicles for the authenticated user (car owner)
userRouter.get("/vehicles", jwtAuth, (req, res) => { userController.fetchAllVehicles(req, res) });








export default userRouter;
