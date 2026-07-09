// Onboard Customers  ( Name,Phone,City,Email )
// getMyOnboardedCustomers with there vehicles
// editMyOnboardedCustomers(name , phone, email, city) ( not other customers are allowed to be edited by shopowner only there onboarded customers)
//addVehiclesToMyOnboardedCustomers ( carCompanyId, make, model, year,  License Plate, VIN,Current odo)
// SearchForAlreadyExsitingCustomers ( which are not onbparded by this shopowner and sent there (id, name, email, city and phone and vehicles))
// AddToMyCustomers( default status -> pending ) with/without edited details ( if edited details ( email, name , city)) it will not get updated until customer approve this Add request ), once approved two thing will get done once status updates to approved and edited details will apply to customer profile
// getAllAddedCustomers list with status ( pending / approved)
// Delete from Added Customers List

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
   1. ONBOARD CUSTOMER (no User account — lives fully in
      BusinessProfile.myOnboardedCustomers)
      Body: { name, phone, city, email }
   ========================================================= */
export const onboardCustomer = async (req, res) => {
  try {
    const { name, phone, city, email } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "name and phone are required" });
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

    const duplicate = business.myOnboardedCustomers.find((c) => c.phone === phone);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "A customer with this phone number is already onboarded",
      });
    }

    business.myOnboardedCustomers.push({ name, phone, city, email });
    await business.save();

    const created = business.myOnboardedCustomers[business.myOnboardedCustomers.length - 1];

    return res.status(201).json({
      success: true,
      message: "Customer onboarded successfully",
      data: created,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to onboard customer",
      error: error.message,
    });
  }
};

/* =========================================================
   2. GET MY ONBOARDED CUSTOMERS (with their vehicles)
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
        path: "myOnboardedCustomers.vehicles",
        populate: { path: "carCompany" },
      });

    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    return res.status(200).json({ success: true, data: business.myOnboardedCustomers });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch onboarded customers",
      error: error.message,
    });
  }
};

/* =========================================================
   3. EDIT MY ONBOARDED CUSTOMER (name, phone, email, city)
      Route param: customerId (the subdocument _id)
      Scoping to "only your own onboarded customers" is
      automatic here — we only ever look inside this shop's
      own business.myOnboardedCustomers array.
   ========================================================= */
export const editMyOnboardedCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { name, phone, email, city } = req.body;

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

    const customer = business.myOnboardedCustomers.id(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Onboarded customer not found (or does not belong to your shop)",
      });
    }

    if (phone && phone !== customer.phone) {
      const duplicate = business.myOnboardedCustomers.find(
        (c) => c.phone === phone && c._id.toString() !== customerId
      );
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Another onboarded customer already uses this phone number",
        });
      }
    }

    if (name !== undefined) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (email !== undefined) customer.email = email;
    if (city !== undefined) customer.city = city;

    await business.save();

    return res.status(200).json({
      success: true,
      message: "Onboarded customer updated successfully",
      data: customer,
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
      Creates a real Vehicle document, then references its
      _id from the onboarded customer's `vehicles` array —
      same pattern as User.myVehicles.
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

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid customerId" });
    }

    if (!carCompanyId || !mongoose.Types.ObjectId.isValid(carCompanyId)) {
      return res.status(400).json({
        success: false,
        message: "Valid carCompanyId is required",
      });
    }

    if (!make || !model || !year || !licensePlateNo || !vinNo) {
      return res.status(400).json({
        success: false,
        message: "make, model, year, licensePlateNo and vinNo are required",
      });
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

    const customer = business.myOnboardedCustomers.id(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Onboarded customer not found (or does not belong to your shop)",
      });
    }

    // Make sure carCompany exists in DB (enforce referential integrity)

    const carCompanyExists = await CarCompany.exists({ _id: carCompanyId });
    if (!carCompanyExists) {
      return res.status(400).json({
        success: false,
        message: "carCompanyId does not reference an existing car company",
      });
    }

    const vehicle = await VehicleModel.create({
      carCompany: carCompanyId,
      licensePlateNo,
      vinNo,
      make: { name: make, model },
      year,
      odometerReading: odometerReading || 0,
    });

    customer.vehicles.push(vehicle._id);
    await business.save();

    return res.status(201).json({
      success: true,
      message: "Vehicle added successfully",
      data: vehicle,
    });
  } catch (error) {
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

    const filter = {
      role: "carowner",
      _id: { $nin: alreadyAddedIds },
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
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
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId).select("myCustomers");
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    let customers = business.myCustomers;
    if (status && ["pending", "approved"].includes(status)) {
      customers = customers.filter((c) => c.status === status);
    }

    return res.status(200).json({ success: true, data: customers });
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