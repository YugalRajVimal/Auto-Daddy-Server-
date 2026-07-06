
// import multer from "multer";
// import fs from "fs";

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     let uploadPath = "./Uploads/";

//     const therapistFileFields = [
//       "aadhaarFront", "aadhaarBack", "photo", "resume", "certificate",
//     ];

//     if (
//       therapistFileFields.includes(file.fieldname) &&
//       req.method === "POST" &&
//       req.originalUrl &&
//       (
//         req.originalUrl === "/api/admin/therapist" ||
//         req.originalUrl.endsWith("/admin/therapist")
//       )
//     ) {
//       uploadPath = "./Uploads/Therapist";
//     }
//     else if (file.fieldname === "excelFile") {
//       uploadPath = "./Uploads/ExcelFiles";
//     }
//     else if (
//       file.fieldname === "carOwnershipCertificate" ||
//       file.fieldname === "insuranceCertificate" ||
//       // ✅ Match carImage_0, carImage_1, ... carImage_4
//       /^carImage_\d+$/.test(file.fieldname) ||
//       file.fieldname === "drivingLicenseFront" ||
//       file.fieldname === "drivingLicenseBack"
//     ) {
//       uploadPath = "./Uploads/Vehicles";
//     }
//     else if (file.fieldname === "businessLogo") {
//       uploadPath = "./Uploads/AutoShops";
//     }
//     else if (file.fieldname === "teamMemberPhoto") {
//       uploadPath = "./Uploads/TeamMembers";
//     }
//     else if (file.fieldname === "profilePhoto") {
//       uploadPath = "./Uploads/UserProfiles";
//     }
//     else if (file.fieldname === "adsImage") {
//       uploadPath = "./Uploads/AdsImages";
//     }

//     console.log("[MULTER] Storing file:", {
//       destination: uploadPath,
//       fieldname: file.fieldname,
//       originalname: file.originalname,
//       mimetype: file.mimetype,
//       method: req.method,
//       url: req.originalUrl,
//     });

//     fs.mkdirSync(uploadPath, { recursive: true });
//     cb(null, uploadPath);
//   },

//   filename: (req, file, cb) => {
//     const timestamp = Date.now();
//     const cleanName = file.originalname.replace(/\s+/g, "_");
//     const filename = `${timestamp}-${cleanName}`;
//     console.log("[MULTER] Generated filename:", filename);
//     cb(null, filename);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   if (
//     file.fieldname === "excelFile" &&
//     !/\.(xls|xlsx)$/i.test(file.originalname)
//   ) {
//     console.log("[MULTER] Excel file filter failed:", file.originalname);
//     return cb(new Error("Only Excel files are allowed"), false);
//   }

//   const imageFields = [
//     "businessLogo",
//     "teamMemberPhoto",
//     "profilePhoto",
//     "carOwnershipCertificate",
//     "insuranceCertificate",
//     "drivingLicenseFront",
//     "drivingLicenseBack",
//     "adsImage", // Add adsImage to accepted image fields
//   ];

//   // ✅ Accept carImage_0 ... carImage_4 as image fields
//   const isIndexedCarImage = /^carImage_\d+$/.test(file.fieldname);

//   if (imageFields.includes(file.fieldname) || isIndexedCarImage) {
//     if (!file.mimetype.startsWith("image/")) {
//       console.log("[MULTER] Image file filter failed:", file.originalname, file.mimetype);
//       return cb(new Error("Only image files are allowed"), false);
//     }
//   }

//   console.log("[MULTER] File accepted by filter:", file.originalname);
//   cb(null, true);
// };

// const upload = multer({ storage, fileFilter });
// const uploadMemory = multer({ storage: multer.memoryStorage(), fileFilter });

// export { upload, uploadMemory };

import multer from "multer";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "./Uploads/";

    const therapistFileFields = [
      "aadhaarFront", "aadhaarBack", "photo", "resume", "certificate",
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
      file.fieldname === "carOwnershipCertificate" ||
      file.fieldname === "insuranceCertificate" ||
      // ✅ Match carImage_0, carImage_1, ... carImage_4
      /^carImage_\d+$/.test(file.fieldname) ||
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
    else if (file.fieldname === "adsImage") {
      uploadPath = "./Uploads/AdsImages";
    }
    // ✅ New: Thought of the Day image
    else if (file.fieldname === "thoughtImage") {
      uploadPath = "./Uploads/ThoughtOfTheDay";
    }
    // ✅ New: Product Feature image
    else if (file.fieldname === "featureImage") {
      uploadPath = "./Uploads/ProductFeatures";
    }
    else if (file.fieldname === "dealerImage") {
      uploadPath = "./Uploads/Dealers";
    }

    console.log("[MULTER] Storing file:", {
      destination: uploadPath,
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      method: req.method,
      url: req.originalUrl,
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
    "businessLogo",
    "teamMemberPhoto",
    "profilePhoto",
    "carOwnershipCertificate",
    "insuranceCertificate",
    "drivingLicenseFront",
    "drivingLicenseBack",
    "adsImage",
    // ✅ New optional image fields
    "thoughtImage",
    "featureImage",
    "dealerImage"
  ];

  // ✅ Accept carImage_0 ... carImage_4 as image fields
  const isIndexedCarImage = /^carImage_\d+$/.test(file.fieldname);

  if (imageFields.includes(file.fieldname) || isIndexedCarImage) {
    if (!file.mimetype.startsWith("image/")) {
      console.log("[MULTER] Image file filter failed:", file.originalname, file.mimetype);
      return cb(new Error("Only image files are allowed"), false);
    }
  }

  console.log("[MULTER] File accepted by filter:", file.originalname);
  cb(null, true);
};

const upload = multer({ storage, fileFilter });
const uploadMemory = multer({ storage: multer.memoryStorage(), fileFilter });

export { upload, uploadMemory };