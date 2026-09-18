import multer from "multer";
import { upload } from "./fileUpload.middleware.js";

/**
 * Middleware for uploading the profile photo of the logged-in Admin/Staff user.
 * - Accepts a single "profilePhoto" image file (stored under ./Uploads/UserProfiles,
 *   see fileUpload.middleware.js).
 * - Skips multer entirely when the request is not multipart/form-data, so plain
 *   JSON updates (no photo change) keep working.
 */
export const staffProfileUploadMiddleware = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return next();
  }

  upload.fields([{ name: "profilePhoto", maxCount: 1 }])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};