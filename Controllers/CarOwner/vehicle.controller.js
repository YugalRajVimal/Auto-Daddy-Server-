import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import CarCompany from "../../Schema/car-company-schema.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";

/**
 * VehicleController
 * Handles: car companies lookup, vehicle CRUD, odometer readings
 */
class VehicleController {

    async fetchCarCompanies(req, res) {
        try {
            const { companyName } = req.query;
            let companies;
            if (companyName) {
                companies = await CarCompany.find({
                    companyName: { $regex: companyName, $options: "i" }
                });
            } else {
                companies = await CarCompany.find({});
            }
            return res.status(200).json({ success: true, data: companies });
        } catch (err) {
            console.error("[fetchCarCompanies] Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch car companies",
                error: err.message
            });
        }
    }

    // Add a new vehicle for the authenticated user (car owner)
    // Handles vehicleImage upload, deletes file on error
    addVehicle = async (req, res) => {
        const session = await VehicleModel.startSession();
        session.startTransaction();
        try {
            const userId = req.user?.id;
            if (!userId) {
                await session.abortTransaction();
                session.endSession();
                if (req.files?.vehicleImage) deleteUploadedFile(req.files.vehicleImage[0]);
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Only the text fields for vehicle info
            const { licensePlateNo, vinNo, name, model, year, odometerReading, dueOdometerReading } = req.body;

            // Check mandatory fields
            if (!licensePlateNo || !vinNo || !name || !model || !year) {
                await session.abortTransaction();
                session.endSession();
                if (req.files?.vehicleImage) deleteUploadedFile(req.files.vehicleImage[0]);
                return res.status(400).json({ message: "Required vehicle fields missing." });
            }

            // Only allow adding if NO non-disabled (i.e. enabled) vehicle exists with the same licensePlateNo
            // Treat missing 'disabled' field as disabled: false (i.e., enabled)
            const enabledVehicle = await VehicleModel.findOne({
                licensePlateNo: licensePlateNo,
                $or: [
                    { disabled: false },
                    { disabled: { $exists: false } }
                ]
            }).session(session);

            if (enabledVehicle) {
                await session.abortTransaction();
                session.endSession();
                if (req.files?.vehicleImage) deleteUploadedFile(req.files.vehicleImage[0]);
                return res.status(409).json({
                    success: false,
                    message: "A vehicle with this license plate already exists and is not disabled."
                });
            }

            // Prepare new vehicle payload with only required fields + dueOdometerReading support
            const vehicleData = {
                licensePlateNo,
                vinNo,
                make: { name, model },
                year,
                odometerReading: odometerReading || 0,
                dueOdometerReading: typeof dueOdometerReading !== "undefined" ? dueOdometerReading : null,
                disabled: false,
            };

            // Attach vehicleImage (file path), if uploaded
            if (req.files && req.files.vehicleImage && req.files.vehicleImage[0]) {
                vehicleData.vehicleImage = req.files.vehicleImage[0].path;
            } else {
                vehicleData.vehicleImage = null;
            }

            let newVehicle;
            try {
                const created = await VehicleModel.create([vehicleData], { session });
                newVehicle = created[0];
            } catch (creationError) {
                await session.abortTransaction();
                session.endSession();
                // Delete uploaded file if vehicle creation fails
                if (vehicleData.vehicleImage) deleteUploadedFile(vehicleData.vehicleImage);
                console.error("[addVehicle][VehicleModel.create] Error:", creationError);
                return res.status(500).json({ message: "Failed to add vehicle." });
            }

            try {
                await User.findByIdAndUpdate(
                    userId,
                    { $push: { myVehicles: newVehicle._id } },
                    { session }
                );
                await session.commitTransaction();
                session.endSession();
            } catch (linkError) {
                await session.abortTransaction();
                session.endSession();
                // Delete uploaded file if user update fails
                if (vehicleData.vehicleImage) deleteUploadedFile(vehicleData.vehicleImage);
                console.error("[addVehicle][User.findByIdAndUpdate] Error:", linkError);
                return res.status(500).json({ message: "Failed to add vehicle to user." });
            }

            const updatedUser = await User.findById(userId)
                .populate("myVehicles")
                .lean();

            return res.status(201).json({
                success: true,
                message: "Vehicle added successfully.",
                vehicle: newVehicle,
                myVehicles: updatedUser?.myVehicles || [],
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            // Defensive file cleanup on uncaught error
            if (req.files?.vehicleImage && req.files.vehicleImage[0])
                deleteUploadedFile(req.files.vehicleImage[0]);
            console.error("[addVehicle] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Edit/update an existing vehicle
    editVehicle = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const { vehicleId } = req.params;
            if (!vehicleId) {
                return res.status(400).json({ message: "Vehicle ID is required." });
            }

            // Find user and check if the vehicleId is in their myVehicles array
            const user = await User.findById(userId).lean();
            if (!user || !Array.isArray(user.myVehicles) || !user.myVehicles.some(v => v.toString() === vehicleId)) {
                return res.status(403).json({ message: "You can only edit your own vehicles." });
            }

            // Include dueOdometerReading as a field that can be updated
            const updateFields = {};
            [
                "licensePlateNo",
                "vinNo",
                "make",
                "year",
                "odometerReading",
                "dueOdometerReading",
                "disabled"
            ].forEach(field => {
                if (req.body[field] !== undefined) updateFields[field] = req.body[field];
            });

            // Optionally handle uploaded vehicleImage (update/replace file path)
            if (req.files && req.files.vehicleImage && req.files.vehicleImage[0]) {
                updateFields.vehicleImage = req.files.vehicleImage[0].path;
            }

            // Fetch current state of the vehicle
            const existingVehicle = await VehicleModel.findById(vehicleId).lean();
            if (!existingVehicle) {
                // If uploaded new image, delete it because vehicle doesn't exist
                if (updateFields.vehicleImage) deleteUploadedFile(updateFields.vehicleImage);
                return res.status(404).json({ message: "Vehicle not found." });
            }

            // Determine upcoming disabled status
            let willBeDisabled;
            if (updateFields.hasOwnProperty('disabled')) {
                willBeDisabled = !!updateFields.disabled;
            } else if (existingVehicle.hasOwnProperty('disabled')) {
                willBeDisabled = !!existingVehicle.disabled;
            } else {
                willBeDisabled = false;
            }
            let willUseNumberPlate = updateFields.hasOwnProperty('licensePlateNo')
                ? updateFields.licensePlateNo
                : existingVehicle.licensePlateNo;

            // If NOT disabling, check that there are no other (not self) enabled vehicles with the same licensePlateNo
            if (!willBeDisabled && willUseNumberPlate) {
                const enabledVehicle = await VehicleModel.findOne({
                    _id: { $ne: vehicleId },
                    licensePlateNo: willUseNumberPlate,
                    $or: [
                        { disabled: false },
                        { disabled: { $exists: false } }
                    ]
                });
                if (enabledVehicle) {
                    // If uploaded new image, delete it because it won't be used
                    if (updateFields.vehicleImage) deleteUploadedFile(updateFields.vehicleImage);
                    return res.status(409).json({
                        success: false,
                        message: "A vehicle with this license plate already exists and is not disabled."
                    });
                }
            }

            // If disabling is not set nor in DB, set explicitly to false
            if (
                !updateFields.hasOwnProperty('disabled') &&
                (!existingVehicle.hasOwnProperty('disabled') || typeof existingVehicle.disabled === 'undefined')
            ) {
                updateFields.disabled = false;
            }

            // If updating vehicleImage: delete previous image file if there was one
            if (updateFields.vehicleImage && existingVehicle.vehicleImage) {
                try {
                    deleteUploadedFile(existingVehicle.vehicleImage);
                } catch (delErr) {
                    console.error("[editVehicle] Failed removing old vehicleImage:", delErr);
                }
            }

            let updatedVehicle;
            try {
                updatedVehicle = await VehicleModel.findByIdAndUpdate(
                    vehicleId,
                    { $set: updateFields },
                    { new: true }
                );
            } catch (updateError) {
                // On update error, delete new uploaded vehicleImage if present
                if (updateFields.vehicleImage) deleteUploadedFile(updateFields.vehicleImage);
                console.error("[editVehicle] Error updating vehicle:", updateError);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            if (!updatedVehicle) {
                // Defensive: cleanup new image if update failed and result not found
                if (updateFields.vehicleImage) deleteUploadedFile(updateFields.vehicleImage);
                return res.status(404).json({ message: "Vehicle not found." });
            }
            return res.status(200).json({
                success: true,
                message: "Vehicle updated successfully.",
                vehicle: updatedVehicle
            });
        } catch (error) {
            // Defensive cleanup on uncaught error and uploaded new file
            if (req.files?.vehicleImage && req.files.vehicleImage[0])
                deleteUploadedFile(req.files.vehicleImage[0]);
            console.error("[editVehicle] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Fetch all vehicles (optionally belonging to the current user)
    fetchAllVehicles = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            // Fetch user's vehicles via their myVehicles array
            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            // If there are no vehicles, return an empty array
            if (!user.myVehicles || !Array.isArray(user.myVehicles) || user.myVehicles.length === 0) {
                return res.status(200).json({ vehicles: [] });
            }

            // Find all vehicles whose IDs are in user.myVehicles
            const vehicles = await VehicleModel.find({ _id: { $in: user.myVehicles } }).lean();

            // Attach `carImage` for each vehicle from the user's documents array (see user.schema.js)
            // Each user.documents item has: { vehicleId, carImage, ... }
            const vehicleImagesMap = {};
            if (Array.isArray(user.documents)) {
                for (const doc of user.documents) {
                    if (doc && doc.vehicleId && doc.carImage)
                        vehicleImagesMap[String(doc.vehicleId)] = doc.carImage;
                }
            }
            const vehiclesWithCarImage = vehicles.map(vehicle => {
                const v = { ...vehicle };
                v.carImage = vehicleImagesMap[String(vehicle._id)] || null;
                return v;
            });

            return res.status(200).json({
                vehicles: vehiclesWithCarImage
            });
        } catch (error) {
            console.error("[fetchAllVehicles] Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };

    // Delete a vehicle for the authenticated user (remove from vehicles collection and user's myVehicles array)
    deleteVehicle = async (req, res) => {
        try {
            const userId = req.user?.id;
            const { vehicleId } = req.body;

            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            if (!vehicleId) {
                return res.status(400).json({ success: false, message: "Vehicle ID is required." });
            }

            // Find the user first
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            // Check if this vehicle is present in user's myVehicles
            const index = user.myVehicles.findIndex(
                id => String(id) === String(vehicleId)
            );
            if (index === -1) {
                return res.status(404).json({ success: false, message: "Vehicle not found in user's vehicles." });
            }

            // Remove the vehicle from VehicleModel (delete from database)
            const deletedVehicle = await VehicleModel.findByIdAndDelete(vehicleId);
            if (!deletedVehicle) {
                return res.status(404).json({ success: false, message: "Vehicle not found in database." });
            }

            // Remove from user's myVehicles array
            user.myVehicles.splice(index, 1);
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Vehicle deleted successfully.",
                deletedVehicleId: vehicleId
            });
        } catch (error) {
            console.error("[deleteVehicle] Error:", error);
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    };

    // Get odometerReading from user profile's myVehicles[] and dueOdometerReading from latest JobCard for this user for every vehicle (with vehicle number)
    getVehiclesOdometerReadings = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            // Get user and their vehicles, include required fields from Vehicle
            const user = await User.findById(userId)
                .populate({
                    path: "myVehicles",
                    select: "number odometerReading licensePlateNo make year carOwnershipCertificate insuranceCertificate vehicleImage disabled",
                    model: "Vehicle"
                })
                .lean();
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            // Filter out disabled vehicles
            const vehicles = Array.isArray(user.myVehicles)
                ? user.myVehicles.filter(v => !v.disabled)
                : [];

            // Import JobCard dynamically
            let JobCard;
            try {
                JobCard = (await import("../../Schema/jobCard.schema.js")).default;
            } catch (e) {
                return res.status(500).json({ success: false, message: "Server config error: JobCard model not found" });
            }

            // Prepare result array
            const results = await Promise.all(
                vehicles.map(async (veh) => {
                    // Find the latest JobCard for this user & this vehicle (by createdAt descending)
                    const jobCard = await JobCard.findOne({
                        customerId: userId,
                        vehicleId: veh._id
                    })
                        .sort({ createdAt: -1 })
                        .select("dueOdometerReading createdAt")
                        .lean();

                    return {
                        _id: veh._id, // Add vehicle _id
                        vehicleNumber: veh.number,
                        licensePlateNo: veh.licensePlateNo || null,
                        odometerReading: veh.odometerReading || null,
                        make: veh.make || null,
                        year: veh.year || null,
                        carOwnershipCertificate: veh.carOwnershipCertificate || null,
                        insuranceCertificate: veh.insuranceCertificate || null,
                        vehicleImage: veh.vehicleImage || null,
                        dueOdometerReading: jobCard?.dueOdometerReading || null,
                        latestJobCardAt: jobCard?.createdAt || null
                    };
                })
            );

            return res.status(200).json({
                success: true,
                vehicles: results
            });
        } catch (err) {
            console.error("[getVehiclesOdometerReadings]", err);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    };

    /**
     * Edit/update odometerReading using vehicleId and trigger FCM to shop if service due.
     * Expected request body: { vehicleId: String, odometerReading: Number }
     * Returns updated vehicle document or error
     */
    editOdometerById = async (req, res) => {
        try {
            const { vehicleId, odometerReading } = req.body;
            const currentUserId = req.user?.id;

            console.log("[editOdometerById] Input - vehicleId:", vehicleId, "odometerReading:", odometerReading);

            // Validate input
            if (
                !vehicleId ||
                odometerReading === undefined ||
                odometerReading === null ||
                typeof odometerReading !== "number" ||
                !Number.isFinite(odometerReading)
            ) {
                console.log("[editOdometerById] Invalid input:", req.body);
                return res.status(400).json({
                    success: false,
                    message: "vehicleId and valid odometerReading are required",
                });
            }

            // Fetch vehicle
            const vehicle = await VehicleModel.findById(vehicleId).lean();
            if (!vehicle) {
                console.log("[editOdometerById] Vehicle not found for vehicleId:", vehicleId);
                return res.status(404).json({
                    success: false,
                    message: "Vehicle not found with provided vehicle ID",
                });
            }

            // Validate odometer progression
            const prevOdometer = vehicle.odometerReading || 0;
            if (odometerReading <= prevOdometer) {
                console.log("[editOdometerById] New odometer reading must be greater than the previous value");
                return res.status(400).json({
                    success: false,
                    message: `New odometer reading (${odometerReading}) must be greater than previous value (${prevOdometer})`,
                });
            }

            let JobCard, BusinessProfileModel, firebaseAdmin, UserModel;
            try {
                JobCard = (await import("../../Schema/jobCard.schema.js")).default;
                BusinessProfileModel = (await import("../../Schema/bussiness-profile.js")).default;
                firebaseAdmin = (await import("../../config/firebase.js")).default;
                UserModel = (await import("../../Schema/user.schema.js")).User;
            } catch (e) {
                console.error("[editOdometerById] Error loading dependencies:", e);
            }

            let notified = false;
            let notificationError = null;

            if (JobCard && BusinessProfileModel && firebaseAdmin && UserModel) {
                try {
                    // Find the latest JobCard for this vehicle/user
                    const latestJobCard = await JobCard.findOne({
                        customerId: currentUserId,
                        vehicleId: vehicleId
                    })
                        .sort({ createdAt: -1 })
                        .select("dueOdometerReading business _id")
                        .lean();

                    const dueOdometerReading = latestJobCard?.dueOdometerReading;
                    if (
                        dueOdometerReading !== null &&
                        dueOdometerReading !== undefined &&
                        odometerReading > dueOdometerReading
                    ) {
                        const businessId = latestJobCard?.business;
                        if (businessId) {
                            const businessDoc = await BusinessProfileModel.findById(businessId)
                                .select("businessName businessPhone businessEmail teamMembers notifications")
                                .populate({
                                    path: "teamMembers",
                                    select: "phone isActive"
                                })
                                .lean();

                            let ownerUser = null;
                            if (businessDoc?.businessPhone) {
                                ownerUser = await UserModel.findOne({
                                    businessProfile: businessDoc._id,
                                    role: "autoshopowner"
                                }).lean();
                            }
                            if (!ownerUser && Array.isArray(businessDoc?.teamMembers)) {
                                const activeMemberWithPhone = businessDoc.teamMembers.find(
                                    (tm) => tm.isActive && tm.phone
                                );
                                if (activeMemberWithPhone?.phone) {
                                    ownerUser = await UserModel.findOne({
                                        phone: activeMemberWithPhone.phone,
                                        role: "autoshopowner"
                                    }).lean();
                                }
                            }

                            // Prepare notification message
                            const notificationTitle = "Service Due Alert";
                            const userName = req.user && req.user.name ? req.user.name : "N/A";
                            const userIdToNotify = currentUserId || req.user?._id;
                            const licensePlateNo = vehicle.licensePlateNo || "";
                            const messageBody =
                                `Car owner${userName !== "N/A" ? " " + userName : ""}'s vehicle (Plate: ${licensePlateNo}) has crossed the scheduled service odometer (${dueOdometerReading}). Current reading: ${odometerReading}. Please notify the customer.`;

                            // Save notification to businessProfile.notifications array
                            try {
                                await BusinessProfileModel.findByIdAndUpdate(
                                    businessDoc._id,
                                    {
                                        $push: {
                                            notifications: {
                                                user: userIdToNotify,
                                                message: messageBody,
                                                time: new Date()
                                            }
                                        }
                                    },
                                    { new: true, useFindAndModify: false }
                                );
                                // Notified via DB
                                notified = true;
                                console.log(`[editOdometerById] Notification saved in businessProfile DB for business: ${businessDoc._id}`);
                            } catch (nerr) {
                                notificationError = nerr;
                                console.error("[editOdometerById] Failed to save notification in businessProfile db:", nerr);
                            }

                            // Try FCM push too (optional, as before)
                            if (ownerUser && ownerUser.fcmToken) {
                                const fcmMessage = {
                                    notification: {
                                        title: notificationTitle,
                                        body: messageBody
                                    },
                                    token: ownerUser.fcmToken
                                };
                                try {
                                    await firebaseAdmin.messaging().send(fcmMessage);
                                    notified = true;
                                    console.log(
                                        `[editOdometerById] FCM notification sent to business owner fcmToken (${ownerUser.fcmToken}): `,
                                        fcmMessage
                                    );
                                } catch (notifyErr) {
                                    notificationError = notifyErr;
                                    console.error("[editOdometerById] Failed to send FCM notification:", notifyErr);
                                }
                            } else {
                                if (!ownerUser) {
                                    console.warn("[editOdometerById] Business owner not found for notification.");
                                } else {
                                    console.warn("[editOdometerById] Business owner fcmToken not found for notification.");
                                }
                            }
                        }
                    }
                } catch (jobCardErr) {
                    notificationError = jobCardErr;
                    console.error("[editOdometerById] Error in JobCard/Notification logic:", jobCardErr);
                }
            }

            // Update the odometer reading in the vehicle
            const updatedVehicle = await VehicleModel.findByIdAndUpdate(
                vehicleId,
                { $set: { odometerReading } },
                { new: true }
            ).lean();

            console.log("[editOdometerById] Update successful for vehicle:", updatedVehicle);

            return res.status(200).json({
                success: true,
                message: "Odometer reading updated successfully" +
                    (notified ? " (service due notification saved in business profile" + (notificationError ? ", notification error: " + notificationError.message + ")" : ")") :
                    "") +
                    (notificationError && !notified ? " (notification error: " + notificationError.message + ")" : ""),
                vehicle: updatedVehicle,
            });
        } catch (err) {
            console.error("[editOdometerById] Unexpected error:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    };
}

export default VehicleController;
