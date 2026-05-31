import multer from "multer";
import { uploadMemory } from "./fileUpload.middleware.js"; // ← changed import

export const onboardCarOwnerUploadMiddleware = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return next();
  }

  uploadMemory.fields([              // ← uploadMemory, not upload
    { name: "profileImage", maxCount: 1 },
    { name: "vehicleImage", maxCount: 1 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};