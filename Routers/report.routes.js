import express from "express";
import ReportsController from "../Controllers/Reports/reports.controller.js";
import jwtAuth from "../middlewares/Auth/auth.middleware.js";




const reportRouter = express.Router();


const reportsController = new ReportsController();

// Route to get all reports for vehicles belonging to the logged-in user
reportRouter.get("/my-vehicle-reports",jwtAuth,(req,res)=>{
    reportsController.getUserVehicleReports(req,res)
} );




export default reportRouter;
