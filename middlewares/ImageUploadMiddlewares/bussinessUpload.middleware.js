import multer from "multer";
import { upload } from "./fileUpload.middleware.js";

/**
 * Middleware for handling uploads for business profiles, team members, and vehicle photos (JobCard).
 * - Accepts businessLogo (image file), teamMemberPhoto (optional image file), and vehiclePhotos (max 5 files).
 * - If no file fields present (not multipart/form-data), skips multer and nexts().
 * - Compatible with completeBusinessProfile, team-related routes, and JobCard creation.
 */
export const businessAndTeamUploadMiddleware = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return next();
  }
  // Accept businessLogo (max 1), teamMemberPhoto (max 1), and vehiclePhotos (max 5, optional)
  upload.fields([
    { name: "businessLogo", maxCount: 1 },
    { name: "teamMemberPhoto", maxCount: 1 },
    { name: "vehiclePhotos", maxCount: 5 }
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
