import multer from "multer";
import fs from "fs";

// -- v1
// Add import for VehicleModel if needed in future, but not required for this middleware code specifically

// Configure disk storage for multer
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
      // @vehicles.schema.js (8-9)
      // Support for car ownership certificate and insurance certificate
      file.fieldname === "licensePlateFrontImage" ||
      file.fieldname === "licensePlateBackImage" ||
      file.fieldname === "carImages" ||
      file.fieldname === "vehiclePhotos" ||
      file.fieldname === "carOwnershipCertificate" ||
      file.fieldname === "insuranceCertificate"
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

  const imageFields = [
    "licensePlateFrontImage",
    "licensePlateBackImage",
    "carImages",
    "vehiclePhotos",
    "businessLogo",
    "teamMemberPhoto",
    "profilePhoto",
    "carOwnerDocuments",        // Memory uploads and filtering
    // @vehicles.schema.js (8-9)
    "carOwnershipCertificate",
    "insuranceCertificate"
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

// Memory storage — for fields that need file.buffer (e.g. carOwnerDocuments saved as base64)
const uploadMemory = multer({ storage: multer.memoryStorage(), fileFilter });

export { upload, uploadMemory };