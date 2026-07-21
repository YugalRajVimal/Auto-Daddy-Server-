// // Onboard Customers  ( Name,Phone,City,Email )
// // getMyOnboardedCustomers with there vehicles
// // editMyOnboardedCustomers(name , phone, email, city) ( not other customers are allowed to be edited by shopowner only there onboarded customers)
// //addVehiclesToMyOnboardedCustomers ( carCompanyId, make, model, year,  License Plate, VIN,Current odo)
// // SearchForAlreadyExsitingCustomers ( which are not onbparded by this shopowner and sent there (id, name, email, city and phone and vehicles))
// // AddToMyCustomers( default status -> pending ) with/without edited details ( if edited details ( email, name , city)) it will not get updated until customer approve this Add request ), once approved two thing will get done once status updates to approved and edited details will apply to customer profile
// // getAllAddedCustomers list with status ( pending / approved)
// // Delete from Added Customers List

// import mongoose from "mongoose";
// import { User } from "../../Schema/user.schema.js";
// import BusinessProfileModel from "../../Schema/bussiness-profile.js";
// import { VehicleModel } from "../../Schema/vehicles.schema.js";
// import CarCompany from "../../Schema/car-company-schema.js";


// /* Helper: resolve the caller's businessProfile id from DB (req.user only
//    ever has { id, role, ... } from jwtAuth — never businessProfile). */
// async function getBusinessId(userId) {
//   const user = await User.findById(userId).select("businessProfile");
//   return user?.businessProfile || null;
// }

// /* =========================================================
//    1. ONBOARD CUSTOMER (no User account — lives fully in
//       BusinessProfile.myOnboardedCustomers)
//       Body: { name, phone, city, email }
//    ========================================================= */
// export const onboardCustomer = async (req, res) => {
//   try {
//     const { name, phone, city, email } = req.body;

//     if (!name || !phone) {
//       return res
//         .status(400)
//         .json({ success: false, message: "name and phone are required" });
//     }

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const duplicate = business.myOnboardedCustomers.find((c) => c.phone === phone);
//     if (duplicate) {
//       return res.status(409).json({
//         success: false,
//         message: "A customer with this phone number is already onboarded",
//       });
//     }

//     business.myOnboardedCustomers.push({ name, phone, city, email });
//     await business.save();

//     const created = business.myOnboardedCustomers[business.myOnboardedCustomers.length - 1];

//     return res.status(201).json({
//       success: true,
//       message: "Customer onboarded successfully",
//       data: created,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to onboard customer",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    2. GET MY ONBOARDED CUSTOMERS (with their vehicles)
//    ========================================================= */
// export const getMyOnboardedCustomers = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId)
//       .select("myOnboardedCustomers")
//       .populate({
//         path: "myOnboardedCustomers.vehicles",
//         populate: { path: "carCompany" },
//       });

//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     return res.status(200).json({ success: true, data: business.myOnboardedCustomers });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch onboarded customers",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    3. EDIT MY ONBOARDED CUSTOMER (name, phone, email, city)
//       Route param: customerId (the subdocument _id)
//       Scoping to "only your own onboarded customers" is
//       automatic here — we only ever look inside this shop's
//       own business.myOnboardedCustomers array.
//    ========================================================= */
// export const editMyOnboardedCustomer = async (req, res) => {
//   try {
//     const { customerId } = req.params;
//     const { name, phone, email, city } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(customerId)) {
//       return res.status(400).json({ success: false, message: "Invalid customerId" });
//     }

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const customer = business.myOnboardedCustomers.id(customerId);
//     if (!customer) {
//       return res.status(404).json({
//         success: false,
//         message: "Onboarded customer not found (or does not belong to your shop)",
//       });
//     }

//     if (phone && phone !== customer.phone) {
//       const duplicate = business.myOnboardedCustomers.find(
//         (c) => c.phone === phone && c._id.toString() !== customerId
//       );
//       if (duplicate) {
//         return res.status(409).json({
//           success: false,
//           message: "Another onboarded customer already uses this phone number",
//         });
//       }
//     }

//     if (name !== undefined) customer.name = name;
//     if (phone !== undefined) customer.phone = phone;
//     if (email !== undefined) customer.email = email;
//     if (city !== undefined) customer.city = city;

//     await business.save();

//     return res.status(200).json({
//       success: true,
//       message: "Onboarded customer updated successfully",
//       data: customer,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update onboarded customer",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    4. ADD VEHICLE TO MY ONBOARDED CUSTOMER
//       Route param: customerId
//       Body: { carCompanyId, make, model, year, licensePlateNo, vinNo, odometerReading }
//       Creates a real Vehicle document, then references its
//       _id from the onboarded customer's `vehicles` array —
//       same pattern as User.myVehicles.
//    ========================================================= */
// export const addVehicleToMyOnboardedCustomer = async (req, res) => {
//   try {
//     const { customerId } = req.params;
//     const {
//       carCompanyId,
//       make,
//       model,
//       year,
//       licensePlateNo,
//       vinNo,
//       odometerReading,
//     } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(customerId)) {
//       return res.status(400).json({ success: false, message: "Invalid customerId" });
//     }

//     if (!carCompanyId || !mongoose.Types.ObjectId.isValid(carCompanyId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Valid carCompanyId is required",
//       });
//     }

//     if (!make || !model || !year || !licensePlateNo || !vinNo) {
//       return res.status(400).json({
//         success: false,
//         message: "make, model, year, licensePlateNo and vinNo are required",
//       });
//     }

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const customer = business.myOnboardedCustomers.id(customerId);
//     if (!customer) {
//       return res.status(404).json({
//         success: false,
//         message: "Onboarded customer not found (or does not belong to your shop)",
//       });
//     }

//     // Make sure carCompany exists in DB (enforce referential integrity)

//     const carCompanyExists = await CarCompany.exists({ _id: carCompanyId });
//     if (!carCompanyExists) {
//       return res.status(400).json({
//         success: false,
//         message: "carCompanyId does not reference an existing car company",
//       });
//     }

//     const vehicle = await VehicleModel.create({
//       carCompany: carCompanyId,
//       licensePlateNo,
//       vinNo,
//       make: { name: make, model },
//       year,
//       odometerReading: odometerReading || 0,
//     });

//     customer.vehicles.push(vehicle._id);
//     await business.save();

//     return res.status(201).json({
//       success: true,
//       message: "Vehicle added successfully",
//       data: vehicle,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to add vehicle",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    5. SEARCH EXISTING CUSTOMERS (carowner role only, not
//       already in this shop's myCustomers)
//       Query: ?search=<name|phone|email>
//    ========================================================= */
// export const searchExistingCustomers = async (req, res) => {
//   try {
//     const { search } = req.query;

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId).select("myCustomers._id");
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const alreadyAddedIds = business.myCustomers.map((c) => c._id);

//     const filter = {
//       role: "carowner",
//       _id: { $nin: alreadyAddedIds },
//     };

//     if (search) {
//       filter.$or = [
//         { name: { $regex: search, $options: "i" } },
//         { phone: { $regex: search, $options: "i" } },
//         { email: { $regex: search, $options: "i" } },
//       ];
//     }

//     const users = await User.find(filter)
//       .select("name email city phone myVehicles")
//       .populate("myVehicles")
//       .limit(50);

//     const data = users.map((u) => ({
//       id: u._id,
//       name: u.name,
//       email: u.email,
//       city: u.city,
//       phone: u.phone,
//       vehicles: u.myVehicles,
//     }));

//     return res.status(200).json({ success: true, data });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to search customers",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    6. ADD TO MY CUSTOMERS (status defaults to "pending")
//       Body: { customerId, edits?: { name, email, city } }
//       If `edits` is provided, those go into `pendingEdit` and
//       are NOT applied to the customer's real profile, and
//       `status` stays "pending" until the customer approves
//       (approval endpoint lives on the carowner side — not
//       built here per your earlier answer).
//    ========================================================= */
// export const addToMyCustomers = async (req, res) => {
//   try {
//     const { customerId, edits } = req.body;

//     if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
//       return res.status(400).json({ success: false, message: "Valid customerId is required" });
//     }

//     const targetUser = await User.findOne({ _id: customerId, role: "carowner" }).select(
//       "name email city phone"
//     );
//     if (!targetUser) {
//       return res.status(404).json({ success: false, message: "Customer not found" });
//     }

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const alreadyAdded = business.myCustomers.id(customerId);
//     if (alreadyAdded) {
//       return res.status(409).json({
//         success: false,
//         message: "Customer already added (or add request already pending)",
//       });
//     }

//     let pendingEdit;
//     if (edits && (edits.name || edits.email || edits.city)) {
//       pendingEdit = {
//         name: edits.name,
//         email: edits.email,
//         city: edits.city,
//       };
//     }

//     business.myCustomers.push({
//       _id: targetUser._id,
//       name: targetUser.name,
//       phone: targetUser.phone,
//       email: targetUser.email,
//       city: targetUser.city,
//       status: "pending",
//       pendingEdit,
//     });

//     await business.save();

//     return res.status(201).json({
//       success: true,
//       message: "Add request sent — waiting for customer approval",
//       data: business.myCustomers[business.myCustomers.length - 1],
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to add customer",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    7. GET ALL ADDED CUSTOMERS (optionally filter by status)
//       Query: ?status=pending|approved
//    ========================================================= */
// export const getAllAddedCustomers = async (req, res) => {
//   try {
//     const { status } = req.query;

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId).select("myCustomers");
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     let customers = business.myCustomers;
//     if (status && ["pending", "approved"].includes(status)) {
//       customers = customers.filter((c) => c.status === status);
//     }

//     return res.status(200).json({ success: true, data: customers });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch added customers",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    8. DELETE FROM ADDED CUSTOMERS LIST
//       Route param: customerId
//    ========================================================= */
// export const deleteAddedCustomer = async (req, res) => {
//   try {
//     const { customerId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(customerId)) {
//       return res.status(400).json({ success: false, message: "Invalid customerId" });
//     }

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const customer = business.myCustomers.id(customerId);
//     if (!customer) {
//       return res.status(404).json({ success: false, message: "Customer not found in your list" });
//     }

//     customer.deleteOne(); // removes the subdocument
//     await business.save();

//     return res.status(200).json({ success: true, message: "Customer removed from your list" });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete customer",
//       error: error.message,
//     });
//   }
// };


import mongoose from "mongoose";
import { User } from "../../Schema/user.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import CarCompany from "../../Schema/car-company-schema.js";

/* Helper: resolve the caller's businessProfile id from DB (req.user only
   ever has { id, role, ... } from jwtAuth — never businessProfile). */
async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

/* =========================================================
   1. ONBOARD CUSTOMER
      Creates a REAL User account (role: carowner) so the
      customer can log in via phone OTP later and approve
      job cards / edits themselves. Rejects if the phone is
      already registered to any existing User.
      Body: { name, phone, city, email }
      ALSO: Add this customer to myCustomers with status: "pending"
   ========================================================= */
export const onboardCustomer = async (req, res) => {
  let session;
  try {
    const { name, phone, city, email, countrycode } = req.body;
    console.log("[onboardCustomer] Request body:", req.body);

    if (!name || !phone) {
      console.log("[onboardCustomer] Missing name or phone");
      return res
        .status(400)
        .json({ success: false, message: "name and phone are required" });
    }

    const shopOwnerId = req.user.id;
    console.log("[onboardCustomer] shopOwnerId:", shopOwnerId);

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    const businessId = await getBusinessId(shopOwnerId);
    console.log("[onboardCustomer] businessId:", businessId);
    if (!businessId) {
      console.log("[onboardCustomer] Business profile not found for user:", shopOwnerId);
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId).session(session);
    if (!business) {
      console.log("[onboardCustomer] Business not found for businessId:", businessId);
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    // Grab the business owner's countrycode as default if not provided in body
    let ownerUser = await User.findById(shopOwnerId).session(session);
    const usedCountryCode = countrycode || ownerUser?.countryCode || "+91";

    const existingUser = await User.findOne({ phone, countryCode: usedCountryCode }).session(session);
    console.log(
      "[onboardCustomer] Check if user exists for phone+countrycode:",
      phone, usedCountryCode,
      "Result:",
      Boolean(existingUser)
    );
    if (existingUser) {
      console.log("[onboardCustomer] Phone already registered (with countrycode):", phone, usedCountryCode);
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered to an existing account",
      });
    }

    // 1. Create new customer User
    const newCustomer = await User.create(
      [{
        role: "carowner",
        name,
        phone,
        email,
        city,
        countryCode: usedCountryCode,
        onboardedBy: shopOwnerId,
        phoneVerified: false,
        status: "active",
      }],
      { session }
    ).then(arr => arr[0]);
    console.log("[onboardCustomer] New customer created:", newCustomer._id);

    // 2. Add to myOnboardedCustomers
    business.myOnboardedCustomers.push({ user: newCustomer._id });

    // 3. Also add to myCustomers with status: "pending"
    // (Only add if not already present in myCustomers)
    const alreadyInMyCustomers = business.myCustomers.find((c) =>
      c._id && c._id.toString() === newCustomer._id.toString()
    );
    if (!alreadyInMyCustomers) {
      business.myCustomers.push({
        _id: newCustomer._id,
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        city: newCustomer.city,
        status: "pending",
        pendingEdit: null,
      });
      console.log("[onboardCustomer] Added to myCustomers with pending status:", newCustomer._id);
    } else {
      console.log("[onboardCustomer] Customer already in myCustomers, skipping add.");
    }

    await business.save({ session });
    console.log("[onboardCustomer] Added customer to business and saved:", business._id);

    await session.commitTransaction();
    session.endSession();

    // Find the new myCustomers entry for response
    const myCustomerEntry = business.myCustomers.find((c) =>
      c._id && c._id.toString() === newCustomer._id.toString()
    );

    return res.status(201).json({
      success: true,
      message: "Customer onboarded successfully (add request is pending approval)",
      data: {
        customerId: business.myOnboardedCustomers[business.myOnboardedCustomers.length - 1]._id,
        user: {
          _id: newCustomer._id,
          name: newCustomer.name,
          phone: newCustomer.phone,
          countryCode: newCustomer.countryCode,
          email: newCustomer.email,
          city: newCustomer.city,
          phoneVerified: newCustomer.phoneVerified,
        },
        myCustomer: myCustomerEntry
          ? {
              _id: myCustomerEntry._id,
              name: myCustomerEntry.name,
              phone: myCustomerEntry.phone,
              email: myCustomerEntry.email,
              city: myCustomerEntry.city,
              status: myCustomerEntry.status,
              pendingEdit: myCustomerEntry.pendingEdit,
            }
          : null,
      },
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.log("[onboardCustomer] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to onboard customer",
      error: error.message,
    });
  }
};

/* =========================================================
   2. GET MY ONBOARDED CUSTOMERS (with their vehicles)
      Vehicles now live on User.myVehicles, not on this list.
   ========================================================= */
export const getMyOnboardedCustomers = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId)
      .select("myOnboardedCustomers")
      .populate({
        path: "myOnboardedCustomers.user",
        select: "name phone email city profilePhoto phoneVerified myVehicles",
        populate: {
          path: "myVehicles",
          populate: { path: "carCompany" },
        },
      });

    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const data = business.myOnboardedCustomers.map((entry) => ({
      customerId: entry._id,
      addedAt: entry.addedAt,
      name: entry.user?.name,
      phone: entry.user?.phone,
      email: entry.user?.email,
      city: entry.user?.city,
      profilePhoto: entry.user?.profilePhoto,
      phoneVerified: entry.user?.phoneVerified,
      vehicles: entry.user?.myVehicles || [],
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch onboarded customers",
      error: error.message,
    });
  }
};

/* =========================================================
   3. EDIT MY ONBOARDED CUSTOMER (name, email, city)
      Route param: customerId (the myOnboardedCustomers subdoc _id)
      Phone can NEVER be edited here — it's the login
      credential for the customer's real account.
      Scoping to "only your own onboarded customers" is
      automatic — we only ever look inside this shop's own
      business.myOnboardedCustomers array.
   ========================================================= */
export const editMyOnboardedCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { name, email, city, phone } = req.body;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid customerId" });
    }

    if (phone !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Phone number cannot be edited — it's the customer's login credential",
      });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId).select(
      "myOnboardedCustomers"
    );
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const entry = business.myOnboardedCustomers.id(customerId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Onboarded customer not found (or does not belong to your shop)",
      });
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (city !== undefined) update.city = city;

    const updatedUser = await User.findByIdAndUpdate(entry.user, { $set: update }, { new: true }).select(
      "name phone email city"
    );

    return res.status(200).json({
      success: true,
      message: "Onboarded customer updated successfully",
      data: { customerId: entry._id, ...updatedUser.toObject() },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update onboarded customer",
      error: error.message,
    });
  }
};

/* =========================================================
   4. ADD VEHICLE TO MY ONBOARDED CUSTOMER
      Route param: customerId
      Body: { carCompanyId, make, model, year, licensePlateNo, vinNo, odometerReading }
      Creates a real Vehicle document, then pushes its _id
      onto the customer's real User.myVehicles.
   ========================================================= */
export const addVehicleToMyOnboardedCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const {
      carCompanyId,
      make,
      model,
      year,
      licensePlateNo,
      vinNo,
      odometerReading,
    } = req.body;

    // LOG: Request received with data
    console.log('[addVehicleToMyOnboardedCustomer] Request data:', {
      customerId,
      carCompanyId,
      make,
      model,
      year,
      licensePlateNo,
      vinNo,
      odometerReading,
    });

    // Validate customerId
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      console.log('[addVehicleToMyOnboardedCustomer] Invalid customerId:', customerId);
      return res.status(400).json({ success: false, message: "Invalid customerId" });
    }

    // Validate carCompanyId
    if (!carCompanyId || !mongoose.Types.ObjectId.isValid(carCompanyId)) {
      console.log('[addVehicleToMyOnboardedCustomer] Invalid or missing carCompanyId:', carCompanyId);
      return res.status(400).json({
        success: false,
        message: "Valid carCompanyId is required",
      });
    }

    // Basic required fields
    if (!make || !model || !year || !licensePlateNo || !vinNo) {
      console.log('[addVehicleToMyOnboardedCustomer] Missing required fields:', { make, model, year, licensePlateNo, vinNo });
      return res.status(400).json({
        success: false,
        message: "make, model, year, licensePlateNo and vinNo are required",
      });
    }

    // Get businessId for this autoshop owner
    const businessId = await getBusinessId(req.user.id);
    console.log('[addVehicleToMyOnboardedCustomer] Fetched businessId:', businessId);
    if (!businessId) {
      console.log('[addVehicleToMyOnboardedCustomer] Business profile not found for user:', req.user.id);
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    // Find business profile, get myCustomers and myOnboardedCustomers
    const business = await BusinessProfileModel.findById(businessId).select("myCustomers myOnboardedCustomers");
    if (!business) {
      console.log('[addVehicleToMyOnboardedCustomer] Business not found for businessId:', businessId);
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    // Check: customer is in myCustomers
    const customerInMyCustomers = business.myCustomers.find(
      (cust) =>
        cust._id &&
        cust._id.toString() === customerId
    );
    if (!customerInMyCustomers) {
      console.log('[addVehicleToMyOnboardedCustomer] CustomerId not found in myCustomers. Requested:', customerId, 'Existing:', business.myCustomers && business.myCustomers.length > 0
          ? business.myCustomers.map(e => e._id && e._id.toString())
          : business.myCustomers
      );
      return res.status(404).json({
        success: false,
        message: "Customer not found in your shop's customer list",
      });
    }

    // Check: customer is approved
    const approvedCustomer = business.myCustomers?.find(
      (customer) =>
        customer._id?.toString() === customerId &&
        customer.status === "approved"
    );
    if (!approvedCustomer) {
      console.log(
        '[addVehicleToMyOnboardedCustomer] Approved customer not found in myCustomers.',
        'Requested:', customerId,
        'Customers:', business.myCustomers?.map(c => ({ id: c._id?.toString(), status: c.status }))
      );
      return res.status(404).json({
        success: false,
        message: "Customer not found or not approved (does not belong to your shop)",
      });
    }

    // Validate car company exists
    const carCompanyExists = await CarCompany.exists({ _id: carCompanyId });
    console.log('[addVehicleToMyOnboardedCustomer] Car company exists:', !!carCompanyExists);
    if (!carCompanyExists) {
      console.log('[addVehicleToMyOnboardedCustomer] carCompanyId does not reference an existing car company:', carCompanyId);
      return res.status(400).json({
        success: false,
        message: "carCompanyId does not reference an existing car company",
      });
    }

    // Create Vehicle
    const vehicle = await VehicleModel.create({
      carCompany: carCompanyId,
      licensePlateNo,
      vinNo,
      make: { name: make, model },
      year,
      odometerReading: odometerReading || 0,
    });

    console.log('[addVehicleToMyOnboardedCustomer] Created vehicle:', { 
      id: vehicle._id, 
      carCompany: vehicle.carCompany, 
      licensePlateNo: vehicle.licensePlateNo, 
      vinNo: vehicle.vinNo 
    });

    // Push vehicle._id to the user's myVehicles array
    await User.findByIdAndUpdate(customerId, { $push: { myVehicles: vehicle._id } });

    console.log('[addVehicleToMyOnboardedCustomer] Added vehicle._id to User.myVehicles', {
      userId: customerId,
      vehicleId: vehicle._id,
    });

    return res.status(201).json({
      success: true,
      message: "Vehicle added successfully",
      data: vehicle,
    });
  } catch (error) {
    console.log('[addVehicleToMyOnboardedCustomer] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to add vehicle",
      error: error.message,
    });
  }
};

/* =========================================================
   5. SEARCH EXISTING CUSTOMERS (carowner role only, not
      already in this shop's myCustomers)
      Query: ?search=<name|phone|email>
   ========================================================= */
export const searchExistingCustomers = async (req, res) => {
  try {
    const { search } = req.query;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId).select("myCustomers._id");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const alreadyAddedIds = business.myCustomers.map((c) => c._id);

    let filter = {
      role: "carowner",
      _id: { $nin: alreadyAddedIds },
    };

    // Build search logic for license plate or user fields
    if (search) {
      // To search vehicles by licensePlateNo, do an aggregate, or a two-step search.
      // Step 1: Find vehicleIds matching license plate search
      const vehicleMatch = await VehicleModel.find({
        licensePlateNo: { $regex: search, $options: "i" },
      }).select("_id");

      const vehicleIds = vehicleMatch.map(v => v._id);

      // $or will try user profile fields OR vehicles array contains a searched vehicle
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];

      if (vehicleIds.length > 0) {
        filter.$or.push({ myVehicles: { $in: vehicleIds } });
      }
    }

    const users = await User.find(filter)
      .select("name email city phone myVehicles")
      .populate("myVehicles")
      .limit(50);

    const data = users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      city: u.city,
      phone: u.phone,
      vehicles: u.myVehicles,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to search customers",
      error: error.message,
    });
  }
};

/* =========================================================
   6. ADD TO MY CUSTOMERS (status defaults to "pending")
      Body: { customerId, edits?: { name, email, city } }
      If `edits` is provided, those go into `pendingEdit` and
      are NOT applied to the customer's real profile, and
      `status` stays "pending" until the customer approves
      (approval endpoint lives on the carowner side — not
      built here per your earlier answer).
   ========================================================= */
export const addToMyCustomers = async (req, res) => {
  try {
    const { customerId, edits } = req.body;

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Valid customerId is required" });
    }

    const targetUser = await User.findOne({ _id: customerId, role: "carowner" }).select(
      "name email city phone"
    );
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const alreadyAdded = business.myCustomers.id(customerId);
    if (alreadyAdded) {
      return res.status(409).json({
        success: false,
        message: "Customer already added (or add request already pending)",
      });
    }

    let pendingEdit;
    if (edits && (edits.name || edits.email || edits.city)) {
      pendingEdit = {
        name: edits.name,
        email: edits.email,
        city: edits.city,
      };
    }

    business.myCustomers.push({
      _id: targetUser._id,
      name: targetUser.name,
      phone: targetUser.phone,
      email: targetUser.email,
      city: targetUser.city,
      status: "pending",
      pendingEdit,
    });

    await business.save();

    return res.status(201).json({
      success: true,
      message: "Add request sent — waiting for customer approval",
      data: business.myCustomers[business.myCustomers.length - 1],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add customer",
      error: error.message,
    });
  }
};

/* =========================================================
   7. GET ALL ADDED CUSTOMERS (optionally filter by status)
      Query: ?status=pending|approved
   ========================================================= */
export const getAllAddedCustomers = async (req, res) => {
  try {
    const { status } = req.query;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    // Get all myCustomers (no vehicles in subdoc - see @bussiness-profile.js for schema)
    const business = await BusinessProfileModel.findById(businessId).select("myCustomers");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    let customers = business.myCustomers;
    if (status && ["pending", "approved"].includes(status)) {
      customers = customers.filter((c) => c.status === status);
    }

    // For each customer, fetch vehicles from the real User.myVehicles list
    // This requires a single query for all user ids (for efficiency)
    const customerIds = customers.map(c => c._id);
    const users = await User.find({ _id: { $in: customerIds } })
      .select("_id myVehicles name phone email city")
      .populate({
        path: "myVehicles",
        select: "make model year number registrationVin insuranceRenewalDate", // add/change as required
      });

    // Map for quick lookup
    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = u;
    });

    // Prepare combined data, merging business.myCustomers fields with real User profile and vehicles
    const customersWithVehicles = customers.map(c => {
      const customerObj = c.toObject ? c.toObject() : c;
      const userDoc = userMap[c._id.toString()];
      return {
        ...customerObj,
        name: userDoc?.name ?? customerObj.name,
        phone: userDoc?.phone ?? customerObj.phone,
        email: userDoc?.email ?? customerObj.email,
        city: userDoc?.city ?? customerObj.city,
        vehicles: Array.isArray(userDoc?.myVehicles) ? userDoc.myVehicles : [],
      };
    });

    return res.status(200).json({ success: true, data: customersWithVehicles });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch added customers",
      error: error.message,
    });
  }
};

/* =========================================================
   8. DELETE FROM ADDED CUSTOMERS LIST
      Route param: customerId
   ========================================================= */
export const deleteAddedCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid customerId" });
    }

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const customer = business.myCustomers.id(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found in your list" });
    }

    customer.deleteOne(); // removes the subdocument
    await business.save();

    return res.status(200).json({ success: true, message: "Customer removed from your list" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};