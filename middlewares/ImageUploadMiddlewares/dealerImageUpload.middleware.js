import { upload } from "./fileUpload.middleware.js";


const dealerImageUploadMiddleware = upload.fields([
  { name: "dealerImage", maxCount: 1 }
]);

export { dealerImageUploadMiddleware };