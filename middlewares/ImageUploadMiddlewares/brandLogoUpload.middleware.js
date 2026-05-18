import multer from "multer";
import { upload } from "./fileUpload.middleware.js";

// Updated to match the vehicle document field names in user.schema.js (VehicleDocumentSchema)
export const brandLogoUploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: "brandLogo", maxCount: 1 },
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
