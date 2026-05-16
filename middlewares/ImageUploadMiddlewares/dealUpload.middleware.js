import multer from "multer";
import { upload } from "./fileUpload.middleware.js";

// Middleware to handle a single dealImage upload
export const dealUploadMiddleware = (req, res, next) => {
  upload.single("dealImage")(req, res, (err) => {
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
