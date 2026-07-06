import mongoose from "mongoose";
import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";

import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";

import { VehicleModel } from "../../Schema/vehicles.schema.js";


class CarOwnerController {



async getAllCarOwners(req, res) {
  try {
    console.log("[getAllCarOwners] Step 1: Fetching car owners from User collection...");
    let carOwners = await User.find(
      { role: "carowner" },
      {
        name: 1,
        email: 1,
        countryCode: 1,
        phone: 1,
        pincode: 1,
        address: 1,
        isDisabled: 1,
        isProfileComplete: 1,
        favoriteAutoShops: 1,
        myVehicles: 1,
        onboardedBy: 1,
        status:1,
        city:1,
        createdAt:1
      }
    )
      .populate({
        path: 'myVehicles',
        model: 'Vehicle',
      })
      .populate({
        path: 'favoriteAutoShops',
        model: 'BusinessProfile',
      })
      .populate({
        path: 'onboardedBy',
        model: 'User',
        select: 'name email',
      });

    // After populating favoriteAutoShops, add isFav: true to each favorite autoshop
    carOwners = carOwners.map(owner => {
      if (owner.favoriteAutoShops && Array.isArray(owner.favoriteAutoShops)) {
        owner.favoriteAutoShops = owner.favoriteAutoShops.map(shop => ({
          ...((typeof shop.toObject === 'function') ? shop.toObject() : shop),
          isFav: true
        }));
      }
      return owner;
    });

    // For lean() (which returns plain JS objects), and to keep the rest of logic, convert now to lean
    carOwners = JSON.parse(JSON.stringify(carOwners));

    console.log(`[getAllCarOwners] Step 1 result: Found ${carOwners.length} car owners`);

    // Gather all owner ids for job card lookup
    const ownerIds = carOwners.map(owner => owner._id);
    console.log(`[getAllCarOwners] Step 2: Owner IDs -`, ownerIds);

    // Get all JobCards for these car owners
    console.log("[getAllCarOwners] Step 3: Fetching all JobCards for car owners...");
    const allJobCards = await JobCard.find({ customerId: { $in: ownerIds } })
      .populate({
        path: 'business',
        model: 'BusinessProfile',
      })
      .populate({
        path: 'vehicleId',
        model: 'Vehicle',
      })
      .populate({
        path: 'customerId',
        model: 'User',
        select: 'name email'
      })
      .lean();

    console.log(`[getAllCarOwners] Step 3 result: Found ${allJobCards.length} job cards for given car owners`);

    // Helper: group job cards by car owner
    const jobCardsByOwner = {};
    for (const jobCard of allJobCards) {
      const ownerId = jobCard.customerId?._id
        ? jobCard.customerId._id.toString()
        : jobCard.customerId?.toString();
      if (!ownerId) continue;
      if (!jobCardsByOwner[ownerId]) {
        jobCardsByOwner[ownerId] = [];
      }
      jobCardsByOwner[ownerId].push(jobCard);
    }

    // For each owner, build list of all distinct autoshops they received service from,
    // and for each, also indicate isFav: true/false (present in favoriteAutoShops)
    carOwners = await Promise.all(
      carOwners.map(async owner => {
        const ownerId = owner._id.toString();
        const jobCards = jobCardsByOwner[ownerId] || [];

        // Get the set of unique autoshop IDs from jobCards
        const serviceAutoshopIds = new Set();
        const serviceAutoshopsMap = {};
        for (const jobCard of jobCards) {
          const business = jobCard.business;
          if (business && business._id) {
            const _idStr = business._id.toString();
            if (!serviceAutoshopsMap[_idStr]) {
              // --- POPULATE SERVICE NAMES FOR THIS BUSINESS PROFILE ---
              // Populate myServices for this shop with service names
              let newBusiness = { ...business };
              if (Array.isArray(newBusiness.myServices)) {
                // Fetch service names for all referenced service ids in myServices
                const serviceIds = newBusiness.myServices
                  .map(ms => (ms && ms.service ? ms.service.toString() : null))
                  .filter(Boolean);
                let serviceDocsMap = {};
                if (serviceIds.length > 0) {
                  const serviceDocs = await Services.find({ _id: { $in: serviceIds } }, { name: 1 });
                  serviceDocsMap = serviceDocs.reduce((acc, doc) => {
                    acc[doc._id.toString()] = doc.name;
                    return acc;
                  }, {});
                }
                newBusiness.myServices = newBusiness.myServices.map(ms => {
                  const msObj = (ms && typeof ms === "object") ? { ...ms } : {};
                  if (msObj.service && typeof msObj.service === "object" && msObj.service._id && msObj.service.name) {
                    // Already populated (unlikely, but preserve)
                    msObj.serviceName = msObj.service.name;
                  } else if (msObj.service && serviceDocsMap[msObj.service.toString()]) {
                    msObj.serviceName = serviceDocsMap[msObj.service.toString()];
                  }
                  // For convenience, still include the service id itself
                  msObj.serviceId = typeof msObj.service === "object" && msObj.service._id
                    ? msObj.service._id.toString()
                    : msObj.service?.toString?.() || '';
                  return msObj;
                });
              }
              serviceAutoshopsMap[_idStr] = newBusiness;
              serviceAutoshopIds.add(_idStr);
            }
          }
        }

        // For quicker lookup of "favorite" autoshop IDs
        const favShopIds = new Set(
          Array.isArray(owner.favoriteAutoShops)
            ? owner.favoriteAutoShops.map(fav =>
              typeof fav === "string" ? fav : fav?._id?.toString?.() || fav?.toString?.() || ''
            ).filter(Boolean)
            : []
        );

        // List all received-service autoshops with isFav property
        const autoshopsUsed = Array.from(serviceAutoshopIds).map(shopId => {
          const shop = serviceAutoshopsMap[shopId];
          return {
            ...shop,
            isFav: favShopIds.has(shopId),
          };
        });

        return {
          ...owner,
          jobCards,
          autoshopsReceivedServiceFrom: autoshopsUsed,
        };
      })
    );

    res.status(200).json({ success: true, data: carOwners });
  } catch (err) {
    console.log("[getAllCarOwners][Error]", err);
    res.status(500).json({ success: false, message: "Error fetching car owners", error: err.message });
  }
}


onboardCarOwner = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Cleanup all uploaded files on failure
  const cleanupUploads = async () => {
    const profilePhoto = req.files?.["profilePhoto"]?.[0]?.path;
    if (profilePhoto) await deleteUploadedFile(profilePhoto);

    // Clean up all carImage_i files
    for (let i = 0; i < 5; i++) {
      const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
      if (imgPath) await deleteUploadedFile(imgPath);
    }
  };

  try {
    const { name, email, phone, countryCode, pincode, role, address, vehicles } = req.body;

    let vehiclesArray = vehicles;
    if (typeof vehicles === "string") {
      try { vehiclesArray = JSON.parse(vehicles); }
      catch (e) { vehiclesArray = undefined; }
    }

    // ── Validation ──────────────────────────────────────────────────────────
    if (!name || !email || !phone || !countryCode || !pincode || !role || !address) {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "All owner fields (name, email, phone, countryCode, pincode, role, address) are required.",
      });
    }

    const allowedCountryCodes = ["+1", "+61", "+44", "+91"];
    if (!allowedCountryCodes.includes(countryCode)) {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Invalid country code. Allowed: +1, +61, +44, +91.",
      });
    }

    if (role !== "carowner") {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Only role 'carowner' is allowed for onboarding via this endpoint.",
      });
    }

    if (email) {
      const existingEmailUser = await User.findOne({ email }).session(session);
      if (existingEmailUser) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          message: "A user with this email already exists.",
          userId: existingEmailUser._id,
        });
      }
    }

    if (phone && countryCode) {
      const existingPhoneUser = await User.findOne({ phone, countryCode }).session(session);
      if (existingPhoneUser) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          message: "A user with this phone and country code already exists.",
          userId: existingPhoneUser._id,
          phone: existingPhoneUser.phone,
          countryCode: existingPhoneUser.countryCode,
          name: existingPhoneUser.name,
          email: existingPhoneUser.email,
        });
      }
    }

    // ── Create User ──────────────────────────────────────────────────────────
    // const otp = "000000";
    // const otpExpiresAt = new Date(Date.now() + 1000 * 600);
    const profilePhotoPath = req.files?.["profilePhoto"]?.[0]?.path || null;
    const onboardedBy = req.user?.id || null;

    const carOwnerPayload = {
      name, email, phone, countryCode, pincode, role, address,
      isProfileComplete: true, otpAttempts: 0,
      onboardedBy,
      ...(profilePhotoPath ? { profilePhoto: profilePhotoPath } : {}),
    };

    let newCarOwner;
    try {
      [newCarOwner] = await User.create([carOwnerPayload], { session });
    } catch (err) {
      await cleanupUploads();
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: "Failed to create car owner profile." });
    }

    // ── Process Vehicles ─────────────────────────────────────────────────────
    const newVehicles = [];

    async function isDuplicateNotDisabledPlate(licensePlateNo) {
      if (!licensePlateNo) return false;
      return !!(await VehicleModel.findOne({
        licensePlateNo,
        $or: [{ disabled: false }, { disabled: { $exists: false } }],
      }).session(session));
    }

    const inputVehiclesArray = Array.isArray(vehiclesArray)
      ? vehiclesArray
      : (req.body.licensePlateNo || req.body.vinNo || req.body.vehicleName
        ? [{
            licensePlateNo:  req.body.licensePlateNo,
            vinNo:           req.body.vinNo,
            vehicleName:     req.body.vehicleName,
            model:           req.body.model,
            year:            req.body.year,
            odometerReading: req.body.odometerReading,
            disabled:        req.body.disabled,
          }]
        : []);

    for (let i = 0; i < inputVehiclesArray.length; i++) {
      const veh = inputVehiclesArray[i] || {};
      const { licensePlateNo, vinNo, vehicleName, model, year, odometerReading, disabled } = veh;

      const vehiclePayload = {};
      if (licensePlateNo  !== undefined) vehiclePayload.licensePlateNo  = licensePlateNo;
      if (vinNo           !== undefined) vehiclePayload.vinNo           = vinNo;
      if (vehicleName     !== undefined) vehiclePayload.make            = { ...(vehiclePayload.make || {}), name: vehicleName };
      if (model           !== undefined) vehiclePayload.make            = { ...(vehiclePayload.make || {}), model };
      if (year            !== undefined) vehiclePayload.year            = year;
      if (odometerReading !== undefined) vehiclePayload.odometerReading = odometerReading;
      if (disabled        !== undefined) vehiclePayload.disabled        = disabled;

      // ✅ Pick carImage for THIS vehicle index: carImage_0, carImage_1, etc.
      const vehicleImagePath = req.files?.[`carImage_${i}`]?.[0]?.path || null;
      if (vehicleImagePath) {
        vehiclePayload.carImages = [vehicleImagePath];
      }

      const hasAllRequired =
        vehiclePayload.licensePlateNo &&
        vehiclePayload.vinNo &&
        vehiclePayload.make?.name &&
        vehiclePayload.make?.model &&
        vehiclePayload.year;

      if (!hasAllRequired) continue;

      if (!vehiclePayload.disabled) {
        const plateExists = await isDuplicateNotDisabledPlate(vehiclePayload.licensePlateNo);
        if (plateExists) {
          await cleanupUploads();
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            message: `A vehicle with license plate "${vehiclePayload.licensePlateNo}" already exists and is not disabled.`,
            licensePlateNo: vehiclePayload.licensePlateNo,
          });
        }
      }

      try {
        const [createdVehicle] = await VehicleModel.create([vehiclePayload], { session });

        newCarOwner.myVehicles.push(createdVehicle._id);

        // ✅ Save vehicleId + carImage into User.documents for this vehicle
        const vehicleDoc = { vehicleId: createdVehicle._id };
        if (vehicleImagePath) vehicleDoc.carImage = vehicleImagePath;
        newCarOwner.documents.push(vehicleDoc);

        newVehicles.push(createdVehicle);
      } catch (err) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: "Failed to create vehicle." });
      }
    }

    if (newVehicles.length > 0) {
      try {
        await newCarOwner.save({ session });
      } catch (saveErr) {
        await cleanupUploads();
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: "Failed to update car owner with vehicles." });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Car owner onboarded successfully.",
      carOwner: {
        id:                newCarOwner._id,
        name:              newCarOwner.name,
        email:             newCarOwner.email,
        phone:             newCarOwner.phone,
        countryCode:       newCarOwner.countryCode,
        pincode:           newCarOwner.pincode,
        role:              newCarOwner.role,
        address:           newCarOwner.address,
        isProfileComplete: newCarOwner.isProfileComplete,
        status:            newCarOwner.status,
        onboardedBy:       newCarOwner.onboardedBy,
        profilePhoto:      newCarOwner.profilePhoto,
        documents:         newCarOwner.documents, // vehicleId + carImage per vehicle
        vehicles: newVehicles.map(v => ({
          id:              v._id,
          licensePlateNo:  v.licensePlateNo,
          vinNo:           v.vinNo,
          name:            v.make?.name,
          model:           v.make?.model,
          year:            v.year,
          odometerReading: v.odometerReading,
          carImages:       v.carImages,
        })),
      },
    });

  } catch (error) {
    await cleanupUploads();
    try { await session.abortTransaction(); } catch (_) {}
    session.endSession();
    console.error("[onboardCarOwner] Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

editCustomer = async (req, res) => {
  try {
    const autoshopOwnerId = req.user?.id;
    const { carOwnerId } = req.body;

    // ── Cleanup helper ───────────────────────────────────────────────────────
    const cleanupUploads = async () => {
      if (req.files?.["profilePhoto"]?.[0]?.path) {
        await deleteUploadedFile(req.files["profilePhoto"][0].path);
      }
      for (let i = 0; i < 5; i++) {
        const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
        if (imgPath) await deleteUploadedFile(imgPath);
      }
    };

    // Parse vehicles JSON string if needed
    let vehiclesFromBody = req.body.vehicles;
    if (typeof vehiclesFromBody === "string") {
      try { vehiclesFromBody = JSON.parse(vehiclesFromBody); }
      catch (e) { vehiclesFromBody = undefined; }
    }


    if (!carOwnerId) {
      await cleanupUploads();
      return res.status(400).json({ message: "carOwnerId is required." });
    }



    // ── Fetch customer ───────────────────────────────────────────────────────
    // Use lean: false so we can mutate documents array below
    const customer = await User.findOne({ _id: carOwnerId, role: "carowner" });
    if (!customer) {
      await cleanupUploads();
      return res.status(404).json({ message: "Car owner not found." });
    }

    const existingVehicleIds = Array.isArray(customer.myVehicles)
      ? customer.myVehicles.map(id => id.toString())
      : [];

    // ── Build user update fields ─────────────────────────────────────────────
    const allowedUserFields = [
      "name", "email", "phone", "countryCode", "pincode", "address",
      "city", "isDisabled", "isProfileComplete", "favoriteAutoShops",
    ];
    let updateFields = {};
    for (const field of allowedUserFields) {
      if (field in req.body && req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    }

    // Profile photo upload
    const newProfilePhoto = req.files?.["profilePhoto"]?.[0]?.path;
    if (newProfilePhoto) {
      updateFields.profilePhoto = newProfilePhoto;
    }

    // ── Process vehicles ─────────────────────────────────────────────────────
    let updatedVehicleObjectIds = [...existingVehicleIds]; // preserve existing

    if (Array.isArray(vehiclesFromBody)) {
      for (let i = 0; i < vehiclesFromBody.length; i++) {
        const v = vehiclesFromBody[i];

        // ✅ carImage for this specific vehicle via carImage_0, carImage_1, etc.
        const vehicleImagePath = req.files?.[`carImage_${i}`]?.[0]?.path || null;

        // ── EDIT EXISTING VEHICLE ────────────────────────────────────────────
        if (v.vId && mongoose.Types.ObjectId.isValid(v.vId)) {
          const vehId = v.vId.toString();
          if (!existingVehicleIds.includes(vehId)) {
            await cleanupUploads();
            return res.status(400).json({
              message: `Invalid vehicle id (${vehId}) for this customer.`,
            });
          }

          const allowedVehicleFields = [
            "licensePlateNo", "licensePlateFrontImagePath", "licensePlateBackImagePath",
            "carOwnershipCertificate", "insuranceCertificate", "vinNo", "year",
            "odometerReading", "disabled",
          ];
          let vehicleUpdateFields = {};
          for (const field of allowedVehicleFields) {
            if (v[field] !== undefined) vehicleUpdateFields[field] = v[field];
          }
          if (v.vehicleName !== undefined) vehicleUpdateFields["make.name"] = v.vehicleName;
          if (v.model !== undefined) vehicleUpdateFields["make.model"] = v.model;

          // Handle carImages (uploaded file takes priority, then body value)
          if (vehicleImagePath) {
            vehicleUpdateFields.carImages = [vehicleImagePath];
          } else if (typeof v.carImages === "string") {
            try {
              const imgs = JSON.parse(v.carImages);
              if (Array.isArray(imgs)) vehicleUpdateFields.carImages = imgs;
            } catch (e) {}
          } else if (Array.isArray(v.carImages)) {
            vehicleUpdateFields.carImages = v.carImages;
          }

          try {
            if (Object.keys(vehicleUpdateFields).length > 0) {
              await VehicleModel.findOneAndUpdate(
                { _id: vehId },
                { $set: vehicleUpdateFields },
                { new: true }
              );
            }
          } catch (err) {
            await cleanupUploads();
            return res.status(500).json({ message: "Vehicle update failed." });
          }

          // ✅ Update User.documents entry for this vehicleId
          if (vehicleImagePath) {
            const docEntry = customer.documents.find(
              d => d.vehicleId?.toString() === vehId
            );
            if (docEntry) {
              docEntry.carImage = vehicleImagePath; // update existing
            } else {
              customer.documents.push({ vehicleId: vehId, carImage: vehicleImagePath });
            }
          }

        }
        // ── ADD NEW VEHICLE ──────────────────────────────────────────────────
        else if (!v.vId) {
          const requiredFields = ["licensePlateNo", "vehicleName", "model", "year", "vinNo", "odometerReading"];
          const hasAllRequired = requiredFields.every(
            field => v[field] !== undefined && v[field] !== null && v[field] !== ""
          );

          if (hasAllRequired) {
            let newCarImages = [];
            if (vehicleImagePath) {
              newCarImages = [vehicleImagePath];
            } else if (typeof v.carImages === "string") {
              try {
                const imgs = JSON.parse(v.carImages);
                if (Array.isArray(imgs)) newCarImages = imgs;
              } catch (e) {}
            } else if (Array.isArray(v.carImages)) {
              newCarImages = v.carImages;
            }

            const newVehicleData = {
              licensePlateNo:            v.licensePlateNo,
              year:                      v.year,
              "make.name":               v.vehicleName,
              "make.model":              v.model,
              vinNo:                     v.vinNo,
              odometerReading:           v.odometerReading,
              licensePlateFrontImagePath: v.licensePlateFrontImagePath,
              licensePlateBackImagePath:  v.licensePlateBackImagePath,
              carOwnershipCertificate:   v.carOwnershipCertificate,
              insuranceCertificate:      v.insuranceCertificate,
              carImages:                 newCarImages,
              disabled:                  v.disabled,
              owner:                     customer._id,
            };
            // Remove undefined keys
            Object.keys(newVehicleData).forEach(key => {
              if (newVehicleData[key] === undefined) delete newVehicleData[key];
            });

            try {
              const newVehicleDoc = await VehicleModel.create(newVehicleData);
              if (newVehicleDoc?._id) {
                updatedVehicleObjectIds.push(newVehicleDoc._id.toString());

                // ✅ Add new entry in User.documents for new vehicle
                const docEntry = {
                  vehicleId: newVehicleDoc._id,
                  ...(vehicleImagePath ? { carImage: vehicleImagePath } : {}),
                };
                customer.documents.push(docEntry);
              }
            } catch (err) {
              await cleanupUploads();
              return res.status(500).json({ message: "Failed to create vehicle." });
            }
          }
          // skip if required fields missing
        }
      }

      updateFields.myVehicles = updatedVehicleObjectIds;
    }

    if (Object.keys(updateFields).length === 0 && !vehiclesFromBody) {
      await cleanupUploads();
      return res.status(400).json({ message: "No update fields provided." });
    }

    // ✅ Persist documents mutations + other fields
    updateFields.documents = customer.documents;

    let customerDoc;
    try {
      customerDoc = await User.findOneAndUpdate(
        { _id: carOwnerId, role: "carowner" },
        { $set: updateFields },
        { new: true }
      )
      .select("name email phone countryCode status isDisabled myVehicles address pincode city profilePhoto isProfileComplete documents favoriteAutoShops onboardedBy")
      .populate({
        path: "myVehicles",
        model: "Vehicle",
        select: "-licensePlateFrontImagePath -licensePlateBackImagePath",
      })
      .lean();
    } catch (err) {
      await cleanupUploads();
      return res.status(500).json({ message: "Customer update failed." });
    }

    if (!customerDoc) {
      await cleanupUploads();
      return res.status(404).json({ message: "Car owner not found." });
    }

    return res.status(200).json({
      message: "Customer updated successfully.",
      customer: customerDoc,
    });

  } catch (error) {
    // best-effort cleanup
    try {
      if (req.files?.["profilePhoto"]?.[0]?.path) {
        await deleteUploadedFile(req.files["profilePhoto"][0].path);
      }
      for (let i = 0; i < 5; i++) {
        const imgPath = req.files?.[`carImage_${i}`]?.[0]?.path;
        if (imgPath) await deleteUploadedFile(imgPath);
      }
    } catch (_) {}
    console.error("[editCustomer] Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Set a car owner's status to "deleted" by userId
 * (Soft deletes a car owner account)
 */
toggleStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId parameter" });
  }

  if (!status || !["active", "suspended", "deleted"].includes(status)) {
    return res.status(400).json({ message: "Invalid or missing status. Status must be one of: active, suspended, deleted." });
  }

  try {
    // Fetch user first to check their current status
    const userDoc = await User.findOne({ _id: userId, role: "carowner" }).select(
      "name email phone countryCode status isDisabled myVehicles address pincode city profilePhoto isProfileComplete documents favoriteAutoShops onboardedBy"
    );

    if (!userDoc) {
      return res.status(404).json({ message: "Car owner not found." });
    }

    if (userDoc.status === status) {
      return res.status(200).json({
        message: `Car owner status is already '${status}'.`,
        customer: userDoc,
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, role: "carowner" },
      { $set: { status: status } },
      { new: true }
    ).select(
      "name email phone countryCode status isDisabled myVehicles address pincode city profilePhoto isProfileComplete documents favoriteAutoShops onboardedBy"
    );

    return res.status(200).json({
      message: `Car owner status updated to '${status}'.`,
      customer: updatedUser,
    });
  } catch (err) {
    console.error("[toggleStatus] Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


}

export default CarOwnerController;

