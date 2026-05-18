import multer from "multer";
import { upload } from "./fileUpload.middleware.js";

// Updated to match the vehicle document field names in user.schema.js (VehicleDocumentSchema)
export const vehicleUploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: "carOwnershipCertificate", maxCount: 1 },
    { name: "insuranceCertificate", maxCount: 1 },
    { name: "carImage", maxCount: 1 },
    { name: "drivingLicenseFront", maxCount: 1 },
    { name: "drivingLicenseBack", maxCount: 1 },
    { name: "vehicleImage", maxCount: 1 },

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
