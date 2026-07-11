import { deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";

/**
 * DocumentController
 * Handles: car owner document uploads/edits (legacy base64 flow, currently unused/commented
 * in routes) and vehicle-linked document uploads (active flow).
 */
class DocumentController {

    /**
     * Upload one or more car owner documents (images as base64 text, not path), saving them to the User's documents array (up to 5 allowed total).
     * Uses field: 'carOwnerDocuments' with "fileUpload" middleware.
     * Expects:
     *   - files: req.files["carOwnerDocuments"] (array of images, buffered by multer)
     *   - body: { names: string[] } or names as part of fields for each file (see below)
     *   - Each document must have a name value. Names may be provided as:
     *        1. names[] array in req.body
     *        2. name property on each file object (req.files[i].originalname can be fallback)
     */
    async addCarOwnerDocument(req, res) {
        try {
            const userId = req.user.id;

            // upload.fields puts files under req.files[fieldname]
            let files = req.files && (req.files.carOwnerDocuments || req.files["carOwnerDocuments"]);
            if (!files && req.file) files = [req.file];
            if (!Array.isArray(files)) files = files ? [files] : [];

            console.log("[addCarOwnerDocument] Received files:", files.map(f => f.originalname));

            // Parse names — accept JSON array string, CSV string, or real array
            let namesRaw = req.body.names || req.body["names"];
            let names;
            if (typeof namesRaw === "string") {
                const trimmed = namesRaw.trim();
                if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                    try {
                        names = JSON.parse(trimmed);
                    } catch {
                        names = trimmed.slice(1, -1).split(",").map(s => s.trim().replace(/^"|"$/g, ""));
                    }
                } else {
                    names = trimmed.split(",").map(s => s.trim());
                }
            } else if (Array.isArray(namesRaw)) {
                names = namesRaw;
            } else {
                names = [];
            }

            console.log("[addCarOwnerDocument] Provided names (parsed):", names);

            if (!files.length) {
                return res.status(400).json({ success: false, message: "No document files uploaded." });
            }

            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            const currentCount = (user.documents || []).length;
            if (currentCount >= 5) {
                return res.status(400).json({ success: false, message: "Maximum of 5 documents allowed." });
            }

            const allowedCount = Math.min(5 - currentCount, files.length);

            const docsToAdd = [];
            for (let i = 0; i < allowedCount; i++) {
                const file = files[i];

                // With memory storage, buffer is always populated — if missing, something is misconfigured
                if (!file || !file.buffer) {
                    console.log(`[addCarOwnerDocument] Skipping file (missing buffer):`, file?.originalname);
                    continue;
                }
                if (!file.mimetype || !file.mimetype.startsWith("image/")) {
                    console.log(`[addCarOwnerDocument] Skipping file (invalid mimetype):`, file?.originalname);
                    continue;
                }

                let name;
                if (Array.isArray(names) && typeof names[i] === "string" && names[i].trim()) {
                    name = names[i].trim();
                } else if (file.originalname?.trim()) {
                    name = file.originalname.trim();
                } else {
                    name = `Document ${currentCount + i + 1}`;
                }

                docsToAdd.push({
                    name,
                    imageData: file.buffer.toString("base64"),
                });
                console.log(`[addCarOwnerDocument] Prepared document:`, name);
            }

            if (docsToAdd.length === 0) {
                return res.status(400).json({ success: false, message: "No valid image files were uploaded." });
            }

            await User.findByIdAndUpdate(userId, {
                $push: { documents: { $each: docsToAdd } }
            });

            console.log(`[addCarOwnerDocument] Uploaded ${docsToAdd.length} document(s) for user:`, userId);
            return res.status(200).json({
                success: true,
                message: `${docsToAdd.length} document(s) uploaded successfully.`
            });

        } catch (error) {
            console.error("addCarOwnerDocument error:", error);
            return res.status(500).json({ success: false, message: "Failed to add document(s)", error: error.message });
        }
    }

    /**
     * Edit an uploaded car owner document name.
     * Expects: { name: string } in body; :docIdx as index in documents array.
     */
    async editCarOwnerDocument(req, res) {
        try {
            const userId = req.user._id;
            const { docIdx } = req.params;
            const { name } = req.body;

            const idx = parseInt(docIdx, 10);
            if (isNaN(idx) || idx < 0) {
                return res.status(400).json({ success: false, message: "Invalid document index." });
            }
            if (!name || typeof name !== "string") {
                return res.status(400).json({ success: false, message: "Document name required." });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }
            if (!user.documents || !user.documents[idx]) {
                return res.status(404).json({ success: false, message: "Document not found." });
            }

            user.documents[idx].name = name;
            await user.save();

            return res.status(200).json({ success: true, message: "Document updated successfully." });
        } catch (error) {
            console.error("editCarOwnerDocument error:", error);
            return res.status(500).json({ success: false, message: "Failed to edit document", error: error.message });
        }
    }

    /**
     * Delete a car owner document by index.
     * Params: :docIdx (index in documents array)
     * No need to delete image file on disk (image is saved as base64 text).
     */
    async deleteCarOwnerDocument(req, res) {
        try {
            const userId = req.user.id;
            const { docIdx } = req.params;

            const idx = parseInt(docIdx, 10);
            if (isNaN(idx) || idx < 0) {
                return res.status(400).json({ success: false, message: "Invalid document index." });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }
            if (!user.documents || !user.documents[idx]) {
                return res.status(404).json({ success: false, message: "Document not found." });
            }

            user.documents.splice(idx, 1);
            await user.save();

            return res.status(200).json({ success: true, message: "Document deleted successfully." });
        } catch (error) {
            console.error("deleteCarOwnerDocument error:", error);
            return res.status(500).json({ success: false, message: "Failed to delete document", error: error.message });
        }
    }

    /**
     * Get (list) all car owner documents (name and image base64).
     * Returns: [{ name, imageData }]
     */
    async getCarOwnerDocuments(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId, "documents");
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }
            // Documents: [{ name, imageData }]
            return res.status(200).json({ success: true, data: user.documents || [] });
        } catch (error) {
            console.error("getCarOwnerDocuments error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch documents", error: error.message });
        }
    }

    /**
     * Expects body: vehicleId
     * Expects images as multer fields/files:
     *   - carOwnershipCertificate: [file]
     *   - insuranceCertificate: [file]
     *   - carImage: [file]
     *   - DrivingLicenseFront: [file]
     *   - DrivingLicenseBack: [file]
     *
     * Max doc count per user: 5 (enforced by schema)
     */
    async uploadDocuments(req, res) {
        const userId = req.user.id;
        const { vehicleId } = req.body;

        try {
            // Validate vehicleId
            if (!vehicleId) {
                console.log("[uploadDocuments] No vehicleId provided in request body");
                deleteUploadedFiles(req.files);
                return res.status(400).json({ success: false, message: "vehicleId is required" });
            }

            // Validate user
            const user = await User.findById(userId);
            if (!user) {
                console.log(`[uploadDocuments] User not found: ${userId}`);
                deleteUploadedFiles(req.files);
                return res.status(404).json({ success: false, message: "User not found" });
            }

            // Make sure this vehicle belongs to the user and is not disabled
            if (!user.myVehicles || !user.myVehicles.some(vId => vId.toString() === vehicleId)) {
                console.log("[uploadDocuments] Vehicle does not belong to user", { userId, vehicleId });
                deleteUploadedFiles(req.files);
                return res.status(403).json({ success: false, message: "Vehicle does not belong to user." });
            }

            // Validate vehicle existence and disabled flag
            const vehicle = await VehicleModel.findById(vehicleId);
            if (!vehicle) {
                console.log(`[uploadDocuments] Vehicle not found: ${vehicleId}`);
                deleteUploadedFiles(req.files);
                return res.status(404).json({ success: false, message: "Vehicle not found" });
            }
            if (vehicle.disabled) {
                console.log(`[uploadDocuments] Vehicle is disabled: ${vehicleId}`);
                deleteUploadedFiles(req.files);
                return res.status(400).json({ success: false, message: "Vehicle is disabled and cannot be used." });
            }

            // Find if a document for this vehicle already exists
            const existingDocIdx = user.documents.findIndex(
                doc => doc.vehicleId && doc.vehicleId.toString() === vehicleId
            );

            // If it's a new document, enforce 5-document limit
            if (existingDocIdx === -1 && user.documents && user.documents.length >= 5) {
                console.log(`[uploadDocuments] Document limit reached (5) for user: ${userId}`);
                deleteUploadedFiles(req.files);
                return res.status(400).json({ success: false, message: "Document limit reached (max 5 vehicles per user)." });
            }

            // Prepare document fields (always based on uploaded files)
            const docFields = {
                vehicleId: vehicleId,
                carOwnershipCertificate: req.files.carOwnershipCertificate && req.files.carOwnershipCertificate[0]?.path || null,
                insuranceCertificate: req.files.insuranceCertificate && req.files.insuranceCertificate[0]?.path || null,
                carImage: req.files.carImage && req.files.carImage[0]?.path || null,
                drivingLicenseFront: req.files.drivingLicenseFront && req.files.drivingLicenseFront[0]?.path || null,
                drivingLicenseBack: req.files.drivingLicenseBack && req.files.drivingLicenseBack[0]?.path || null,
            };

            let oldPathsToDelete = [];

            if (existingDocIdx !== -1) {
                // Document exists, update the fields for this vehicleId
                const doc = user.documents[existingDocIdx];

                // Only update fields with new uploads, keep existing otherwise
                const fields = [
                    "carOwnershipCertificate",
                    "insuranceCertificate",
                    "carImage",
                    "drivingLicenseFront",
                    "drivingLicenseBack"
                ];

                fields.forEach(field => {
                    if (docFields[field]) {
                        // Save path to old file so we can delete it if it's overwritten
                        if (doc[field]) oldPathsToDelete.push(doc[field]);
                        doc[field] = docFields[field];
                    }
                });

                // If vehicleId field changed (shouldn't happen), ensure it's correct
                doc.vehicleId = vehicleId;

                await user.save();

                // Delete any replaced image files
                if (oldPathsToDelete.length) {
                    console.log("[uploadDocuments] Deleting replaced files:", oldPathsToDelete);
                    deleteUploadedFiles(oldPathsToDelete);
                } else {
                    console.log("[uploadDocuments] No files replaced, nothing to delete");
                }

                console.log(`[uploadDocuments] Document updated for vehicleId: ${vehicleId} (user: ${userId})`);
                return res.status(200).json({ success: true, message: "Document updated for this vehicle.", document: doc });
            } else {
                // No existing document for this vehicle, so create a new one as before
                user.documents.push(docFields);
                await user.save();
                console.log(`[uploadDocuments] Document uploaded for new vehicleId: ${vehicleId} (user: ${userId})`);
                return res.status(201).json({ success: true, message: "Document uploaded successfully", document: docFields });
            }
        } catch (error) {
            // Delete any uploaded files on error
            deleteUploadedFiles(req.files);
            console.error("[uploadDocuments] error:", error);
            return res.status(500).json({ success: false, message: "Failed to upload document", error: error.message });
        }
    }

    /**
     * Get all uploaded vehicle documents for the authenticated user.
     * Responds with an array of documents (max 5), or empty array if none.
     */
    async getUploadedDocuments(req, res) {
        const userId = req.user.id;

        try {
            // Validate user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            // We'll populate vehicle details for each document (if possible, otherwise null)
            // Limit fields as in vehicles.schema.js
            const documents = user.documents || [];
            const result = [];

            for (const doc of documents) {
                let vehicleData = null;
                if (doc.vehicleId) {
                    vehicleData = await VehicleModel.findById(doc.vehicleId).select(
                        "licensePlateNo vinNo make year odometerReading disabled"
                    ).lean();
                }
                result.push({
                    ...doc.toObject ? doc.toObject() : doc,
                    vehicle: vehicleData
                });
            }

            return res.status(200).json({ success: true, documents: result });
        } catch (error) {
            console.error("[getUploadedDocuments] error:", error);
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch documents", error: error.message });
        }
    }

    /**
     * Edit vehicle document(s) for a user based on vehicleId.
     * For the given vehicleId (in body), update any document image fields present in req.files.
     * Only the relevant document entry is updated; files not provided are untouched.
     * Clean up old image files if replaced; clean up new uploads if error.
     *
     * Expects: body.vehicleId, and optionally req.files with fields among allowed vehicle fields.
     */
    async editDocument(req, res) {
        const userId = req.user.id;
        const { vehicleId } = req.body;

        // List of valid document image fields, as per VehicleDocumentSchema
        const imageFields = [
            "carOwnershipCertificate",
            "insuranceCertificate",
            "carImage",
            "drivingLicenseFront",
            "drivingLicenseBack"
        ];

        try {
            // Validate vehicleId
            if (
                !vehicleId ||
                typeof vehicleId !== 'string' ||
                vehicleId.trim().length !== 24 // ObjectId length
            ) {
                deleteUploadedFiles(req.files);
                return res.status(400).json({ success: false, message: "Invalid or missing vehicleId." });
            }

            // Validate user
            const user = await User.findById(userId);
            if (!user) {
                deleteUploadedFiles(req.files);
                return res.status(404).json({ success: false, message: "User not found." });
            }

            // Find the document for the given vehicleId
            const doc = user.documents.find(
                d => d.vehicleId && d.vehicleId.toString() === vehicleId
            );
            if (!doc) {
                deleteUploadedFiles(req.files);
                return res.status(404).json({ success: false, message: "Vehicle document not found." });
            }

            // Verify user owns this vehicle and it is not disabled
            if (
                !user.myVehicles.some(vId => vId.toString() === vehicleId)
            ) {
                deleteUploadedFiles(req.files);
                return res.status(403).json({ success: false, message: "Vehicle does not belong to user." });
            }
            const vehicle = await VehicleModel.findById(vehicleId);
            if (!vehicle) {
                deleteUploadedFiles(req.files);
                return res.status(404).json({ success: false, message: "Vehicle not found." });
            }
            if (vehicle.disabled) {
                deleteUploadedFiles(req.files);
                return res.status(400).json({ success: false, message: "Vehicle is disabled and cannot be used." });
            }

            // Track old paths for deletion if overwritten
            const oldPathsToDelete = [];

            // Only update image fields present in req.files
            for (const field of imageFields) {
                if (req.files && req.files[field] && req.files[field][0]?.path) {
                    if (doc[field]) {
                        oldPathsToDelete.push(doc[field]);
                    }
                    doc[field] = req.files[field][0].path;
                }
            }

            await user.save();

            // Clean up replaced old files
            if (oldPathsToDelete.length > 0) {
                deleteUploadedFiles(oldPathsToDelete);
            }

            return res.status(200).json({
                success: true,
                message: "Document(s) updated successfully.",
                document: doc
            });
        } catch (error) {
            // Clean up any newly uploaded files if error occurred
            deleteUploadedFiles(req.files);
            console.error("[editDocument] error:", error);
            return res.status(500).json({ success: false, message: "Failed to update document", error: error.message });
        }
    }
}

export default DocumentController;
