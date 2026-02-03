import multer from "multer";
import { upload } from "./fileUpload.middleware.js";


export const vehicleUploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: "licensePlateFrontImage", maxCount: 1 },
    { name: "licensePlateBackImage", maxCount: 1 },
    { name: "carImages", maxCount: 5 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    next();
  });
};
