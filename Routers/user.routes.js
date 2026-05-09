import express from "express";
import UserController from "../Controllers/User/user.controller.js";
import jwtAuth from "../middlewares/Auth/auth.middleware.js";
import { vehicleUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/vehicleUpload.middleware.js";
import { upload } from "../middlewares/ImageUploadMiddlewares/fileUpload.middleware.js";
import { carOwnerUploadMiddleware } from "../middlewares/ImageUploadMiddlewares/carOwnerUploadMiddleware.js";



const userRouter = express.Router();



const userController = new UserController();

// Route to get dashboard details (dashboard content + user profile + upcoming service)
userRouter.get("/dashboard", jwtAuth, (req, res) => { userController.getDashboardsDetails(req, res) });


// Route to complete user profile (for car owners)
userRouter.put("/complete-profile",jwtAuth,(req,res)=>{ userController.completeProfile(req,res)});
userRouter.get("/profile",jwtAuth,(req,res)=>{ userController.getProfileDetails(req,res)});
// Route to edit/update user profile (for car owners)
userRouter.put("/edit-profile", jwtAuth, upload.single('profilePhoto'),(req, res) => { userController.editProfile(req, res) });

userRouter.post("/toggle-auto-shop-fav", jwtAuth, (req, res) => { userController.toggleAutoShopFav(req, res) });
userRouter.get("/favorite-auto-shops", jwtAuth, (req, res) => { userController.getFavAutoShops(req, res) });

// -------- VEHICLE CRUD ROUTES --------

// Add a new vehicle

userRouter.post(
  "/vehicle",
  jwtAuth,
  vehicleUploadMiddleware,
  (req, res) => {
    userController.addVehicle(req, res);
  }
);

// Edit/update a vehicle
userRouter.put("/vehicle/:vehicleId", jwtAuth, (req, res) => { userController.editVehicle(req, res) });

// Fetch all vehicles for the authenticated user (car owner)
userRouter.get("/vehicles", jwtAuth, (req, res) => { userController.fetchAllVehicles(req, res) });




// Route to get all deals (public endpoint)
userRouter.get("/deals", (req, res) => { userController.getAllDeals(req, res) });


// Route to get all auto shops (public endpoint)
userRouter.get("/auto-shops", (req, res) => { userController.getAllAutoShops(req, res) });

// Fetch all job cards for the authenticated user (car owner)
userRouter.get("/job-cards", jwtAuth, (req, res) => { userController.getAllJobCards(req, res) });


// Approve a job card (customer approves it)
userRouter.post("/job-cards/:jobCardId/approve", jwtAuth, (req, res) => { 
  userController.approveJobCard(req, res); 
});

// Reject a job card (customer rejects it)
userRouter.post("/job-cards/:jobCardId/reject", jwtAuth, (req, res) => { 
  userController.rejectJobCard(req, res); 
});

// Route to fetch Canadian cities (search or paginated)
userRouter.get("/cities", (req, res) => {
  userController.fetchCities(req, res);
});


// ---- CAR OWNER DOCUMENTS ROUTES ----

// Upto 5 documents per user - Managed by addCarOwnerDocument controller

// Upload/add a car owner document (image as base64, name in body)
// Upload/add one or more car owner document(s) (images as base64, name(s) in body)
// Accepts up to 5 files per user, via .array middleware
userRouter.post(
  "/documents",
  jwtAuth,
  carOwnerUploadMiddleware ,
  (req, res) => userController.addCarOwnerDocument(req, res)
);

// Edit a car owner document's name by its index in the documents array
userRouter.put(
  "/documents/:docIdx",
  jwtAuth,
  (req, res) => userController.editCarOwnerDocument(req, res)
);

// Delete a car owner document by index
userRouter.delete(
  "/documents/:docIdx",
  jwtAuth,
  (req, res) => userController.deleteCarOwnerDocument(req, res)
);

// Get all car owner documents (names and base64 image) for the authenticated user
userRouter.get(
  "/documents",
  jwtAuth,
  (req, res) => userController.getCarOwnerDocuments(req, res)
);





export default userRouter;
