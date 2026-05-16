import multer from "multer";
import fs from "fs";

// Configure disk storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "./Uploads/";

    // Therapist file fields (unchanged for context outside user.schema.js updates)
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
      // Vehicle-related user document fields as per user.schema.js
      file.fieldname === "carOwnershipCertificate" ||
      file.fieldname === "insuranceCertificate" ||
      file.fieldname === "carImage" ||
      file.fieldname === "drivingLicenseFront" ||
      file.fieldname === "drivingLicenseBack"
    ) {
      uploadPath = "./Uploads/Vehicles";
    }
    else if (file.fieldname === "businessLogo") {
      uploadPath = "./Uploads/AutoShops";
    }
    else if (file.fieldname === "teamMemberPhoto") {
      uploadPath = "./Uploads/TeamMembers";
    }
    else if (file.fieldname === "profilePhoto") {
      uploadPath = "./Uploads/UserProfiles";
    }

    console.log("[MULTER] Storing file:", {
      destination: uploadPath,
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      method: req.method,
      url: req.originalUrl
    });

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, "_");
    const filename = `${timestamp}-${cleanName}`;
    console.log("[MULTER] Generated filename:", filename);
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.fieldname === "excelFile" &&
    !/\.(xls|xlsx)$/i.test(file.originalname)
  ) {
    console.log("[MULTER] Excel file filter failed:", file.originalname);
    return cb(new Error("Only Excel files are allowed"), false);
  }

  // Update imageFields to match names in user.schema.js
  const imageFields = [
    "businessLogo",
    "teamMemberPhoto",
    "profilePhoto",
    "carOwnershipCertificate",
    "insuranceCertificate",
    "carImage",
    "drivingLicenseFront",
    "drivingLicenseBack"
  ];

  if (imageFields.includes(file.fieldname)) {
    if (!file.mimetype.startsWith("image/")) {
      console.log("[MULTER] Image file filter failed:", file.originalname, file.mimetype);
      return cb(new Error("Only image files are allowed"), false);
    }
  }

  console.log("[MULTER] File accepted by filter:", file.originalname);
  cb(null, true);
};

// Disk storage — for all regular file uploads
const upload = multer({ storage, fileFilter });

// Memory storage — for fields that need file.buffer (e.g., special memory uploads—none as per user.schema.js)
const uploadMemory = multer({ storage: multer.memoryStorage(), fileFilter });

export { upload, uploadMemory };