import { upload } from "./fileUpload.middleware.js";


const expenseImageUploadMiddleware = upload.fields([
  { name: "expenseImage", maxCount: 1 },
]);

const incomeImageUploadMiddleware = upload.fields([
  { name: "incomeImage", maxCount: 1 },
]);

export { expenseImageUploadMiddleware, incomeImageUploadMiddleware };