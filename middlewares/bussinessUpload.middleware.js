import multer from "multer";
import { upload } from "./fileUpload.middleware.js";

/**
 * Middleware for handling business profile uploads.
 * Accepts a businessLogo (image file); other fields are expected in the body.
 * Integrates with completeBusinessProfile controller logic (see auto-shop.controller.js:138-316).
 * If file (businessLogo) is not present, skips multer for upload and calls next().
 */

export const businessUploadMiddleware = (req, res, next) => {
  // If file field not present in req (request is likely JSON only), skip multer and continue
  // Multer only processes if content-type is multipart/form-data and file is sent
  const contentType = req.headers['content-type'] || "";
  // If not multipart (so, definitely no file), just next()
  if (!contentType.startsWith("multipart/form-data")) {
    return next();
  }
  // Otherwise, process file upload
  upload.fields([
    { name: "businessLogo", maxCount: 1 },
    // Future: could add other uploads for teamMembers etc.
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
