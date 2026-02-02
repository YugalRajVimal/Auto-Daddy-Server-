import multer from "multer";
import fs from "fs";

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "./Uploads/";

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
    } 
    else if (file.fieldname === "excelFile") {
      uploadPath = "./Uploads/ExcelFiles";
    }
    else if (
      file.fieldname === "licensePlateFrontImage" ||
      file.fieldname === "licensePlateBackImage" ||
      file.fieldname === "carImages"
    ) {
      uploadPath = "./Uploads/Vehicles";
    }
    else if (file.fieldname === "businessLogo") {
      uploadPath = "./Uploads/AutoShops";
    }
    else if (file.fieldname === "teamMemberPhoto") {
      uploadPath = "./Uploads/TeamMembers";
    }

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${cleanName}`);
  },
});


// ✅ CLEAN & STANDARDIZED FILE FILTER
const fileFilter = (req, file, cb) => {
  // Excel validation
  if (
    file.fieldname === "excelFile" &&
    !/\.(xls|xlsx)$/i.test(file.originalname)
  ) {
    return cb(new Error("Only Excel files are allowed"), false);
  }

  // Image validation
  const imageFields = [
    "licensePlateFrontImage",
    "licensePlateBackImage",
    "carImages",
    "businessLogo",
    "teamMemberPhoto",
  ];

  if (imageFields.includes(file.fieldname)) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
});
