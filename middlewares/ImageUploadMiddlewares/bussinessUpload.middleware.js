import multer from "multer";
import { upload } from "./fileUpload.middleware.js";

/**
 * Middleware for handling uploads for business profiles and team members.
 * - Accepts businessLogo (image file) and teamMemberPhoto (optional image file).
 * - If no file fields present (not multipart/form-data), skips multer and nexts().
 * - Compatible with completeBusinessProfile & team-related routes.
 */
export const businessAndTeamUploadMiddleware = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return next();
  }
  // Accept both businessLogo (max 1) and teamMemberPhoto (max 1, optional)
  upload.fields([
    { name: "businessLogo", maxCount: 1 },
    { name: "teamMemberPhoto", maxCount: 1 },
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
