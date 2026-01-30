import multer from "multer";
import fs from "fs";

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "./Uploads/"; // default fallback

    // Therapist uploads
    const therapistFileFields = [
      "aadhaarFront",
      "aadhaarBack",
      "photo",
      "resume",
      "certificate",
    ];

    if (
      therapistFileFields.includes(file.fieldname) &&
      req.method === "POST" &&
      req.originalUrl &&
      (
        req.originalUrl === "/api/admin/therapist" ||
        req.originalUrl.endsWith("/admin/therapist")
      )
    ) {
      uploadPath = "./Uploads/Therapist";
    } else if (file.fieldname === "excelFile") {
      uploadPath = "./Uploads/ExcelFiles";
    }
    // --- Begin vehicle images logic ---
    // Save vehicle image uploads to ./Uploads/Vehicles
    else if (
      // Vehicle license plate images
      file.fieldname === "licensePlateFrontImage" ||
      file.fieldname === "licensePlateBackImage" ||
      // Vehicle carImages (array)
      file.fieldname === "carImages"
    ) {
      uploadPath = "./Uploads/Vehicles";
    }
    // --- End vehicle images logic ---

    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${cleanName}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Only allow Excel file types for excelFile field
  if (
    file.fieldname === "excelFile" &&
    !file.originalname.match(/\.(xls|xlsx)$/)
  ) {
    return cb(new Error("Only Excel files are allowed!"), false);
  }
  // Only allow image files for vehicle-related fields
  if (
    (
      file.fieldname === "licensePlateFrontImage" ||
      file.fieldname === "licensePlateBackImage" ||
      file.fieldname === "carImages"
    ) &&
    !file.mimetype.startsWith("image/")
  ) {
    return cb(new Error("Only image files are allowed for vehicle images!"), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
});
