import fs from "fs";

/**
 * Deletes a single uploaded file based on provided argument, which can be:
 * - Multer file object: { path: string }
 * - String path (direct file path)
 * Ignores undefined, null, or values not string or object with 'path'.
 */
function deleteUploadedFile(file) {
  let filePath;

  if (!file) return;

  // Handle both "Multer file object" or "string path"
  if (typeof file === "string") {
    filePath = file;
  } else if (file && typeof file.path === "string" && file.path.trim() !== "") {
    filePath = file.path;
  } else {
    // Invalid input, do nothing
    return;
  }

  if (!filePath || typeof filePath !== "string" || filePath.trim() === "") {
    // Don't attempt to unlink undefined or empty string
    return;
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      // File might not exist or path is not found - don't crash, just log.
      console.error(`Failed to delete file: ${filePath}`, err);
    } else {
      console.log(`Deleted file: ${filePath}`);
    }
  });
}

/**
 * Deletes one or more uploaded files.
 * Accepts:
 * - Single file (object or string path)
 * - Array of file objects/paths
 * - Multer "fields" object: { field1: [files...], field2: [files...] }
 */
function deleteUploadedFiles(files) {
  if (!files) return;

  // If input is array (from upload.array or [paths]), delete each
  if (Array.isArray(files)) {
    files.forEach((file) => deleteUploadedFile(file));
    return;
  }

  // If input is a single file object or string, handle it directly
  if (typeof files === "string" || (typeof files === "object" && files !== null && files.path)) {
    deleteUploadedFile(files);
    return;
  }

  // Multer upload.fields: object with arrays of files per key
  Object.keys(files).forEach((key) => {
    const arr = files[key];
    if (Array.isArray(arr)) {
      arr.forEach((file) => deleteUploadedFile(file));
    } else {
      // Defensive: just in case, if not array, try passing to deleteUploadedFile
      deleteUploadedFile(arr);
    }
  });
}

export { deleteUploadedFile, deleteUploadedFiles };
