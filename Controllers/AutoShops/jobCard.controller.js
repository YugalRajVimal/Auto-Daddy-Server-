// // GET->getJobCardPageDetails ( MyCustomers ( name, email, city, phone  ), nextJobCardNo, myAllSubServices, myAllBanks)
// // POST->CreateJobCard  (jobCardNo, customerId, vehicleId,licensePlateNo , customerName, phone, email, city,approvedByCustomer(boolean), approvalTime, Date, odoIn, services[{category, desc, unitCost, qty, amount(unitCost*qty)},{}], bankName, bankRefId, labourCharge, terms, sendForApproval(boolean),status(pending, autoRejected,convertedToInvoice,CashPaid ) )
// // PUT->editJobCardUsingjobCardNo 
// // GET->getAllJobCards with a search feature
// // GET->getAllJobCards using status ( convertedToInvoice / CashPaid)
// // DELETE->deleteJobCard
// // POST/PUT->markStatus ( convertedToInvoice / CashPaid)
// // after after days if not approved autoReject
// // POST ->send for approval to customer notification using fcm and save it in user schema , mark  send for approval true
// // GET -> fetch SendForApproval JobCards



// // jobCardNo for each AutoShop will be independent means each autoShop owner will have its job card no start with 1

// import mongoose from "mongoose";



// import Services from "../../Schema/services.schema.js";
// import AutoShopBank from "../../Schema/AutoShopAccounts/autoShopBank.schema.js";
// import JobCard from "../../Schema/jobCard.schema.js";
// import { getNextJobCardNo, peekNextJobCardNo } from "../../Schema/Jobcardcounter.schema.js";
// import BusinessProfileModel from "../../Schema/bussiness-profile.js";
// import { VehicleModel } from "../../Schema/vehicles.schema.js";
// import { User } from "../../Schema/user.schema.js";

// const AUTO_REJECT_AFTER_DAYS = 7;

// /* Helper: resolve the caller's businessProfile id from DB (req.user only
//    ever has { id, role, ... } from jwtAuth — never businessProfile). */
// async function getBusinessId(userId) {
//   const user = await User.findById(userId).select("businessProfile");
//   return user?.businessProfile || null;
// }

// /* Placeholder — plug in your actual firebase-admin messaging call here.
//    Kept as a stub since no FCM setup was provided. */
// async function sendFcmNotification(fcmToken, { title, message }) {
//   if (!fcmToken) return;
//   // Example real implementation:
//   // await admin.messaging().send({
//   //   token: fcmToken,
//   //   notification: { title, body: message },
//   // });
//   console.log("[FCM STUB] would send push:", { fcmToken, title, message });
// }

// /* Auto-rejects any pending job card for this business that was sent for
//    approval more than AUTO_REJECT_AFTER_DAYS ago and never approved.
//    Called lazily from the list/pending-approval endpoints below. For exact
//    timing regardless of traffic, also schedule this (e.g. node-cron) to run
//    across ALL businesses periodically — see note at bottom of this file. */
// async function autoRejectStaleForBusiness(businessId) {
//   const cutoff = new Date(Date.now() - AUTO_REJECT_AFTER_DAYS * 24 * 60 * 60 * 1000);
//   await JobCard.updateMany(
//     {
//       business: businessId,
//       status: "pending",
//       sendForApproval: true,
//       approvedByCustomer: false,
//       sendForApprovalAt: { $lte: cutoff },
//     },
//     { $set: { status: "autoRejected" } }
//   );
// }

// /* =========================================================
//    1. GET JOB CARD PAGE DETAILS
//       -> myCustomers (registered + onboarded), nextJobCardNo,
//          myAllSubServices (flattened), myAllBanks
//    ========================================================= */
// export const getJobCardPageDetails = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId)
//       .select("myCustomers myOnboardedCustomers myServices")
//       .populate("myServices.service", "name shopType odoOutRequired");

//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     // Combine both customer sources into one list for the picker
//     const registeredCustomers = business.myCustomers
//       .filter((c) => c.status === "approved")
//       .map((c) => ({
//         id: c._id,
//         type: "registered",
//         name: c.name,
//         email: c.email,
//         city: c.city,
//         phone: c.phone,
//       }));

//     const onboardedCustomers = business.myOnboardedCustomers.map((c) => ({
//       id: c._id,
//       type: "onboarded",
//       name: c.name,
//       email: c.email,
//       city: c.city,
//       phone: c.phone,
//     }));

//     // Flatten myServices -> individual subService rows for the line-item picker
//     const myAllSubServices = [];
//     business.myServices.forEach((ms) => {
//       const parent = ms.service; // populated Services doc (or null if deleted)
//       (ms.subServices || []).forEach((sub) => {
//         myAllSubServices.push({
//           serviceId: parent?._id || null,
//           category: parent?.name || sub.name,
//           subServiceName: sub.name,
//           desc: sub.desc,
//           price: sub.price,
//           quantity: sub.quantity,
//           tax: sub.tax,
//           odoOutRequired: parent?.odoOutRequired || false,
//         });
//       });
//     });

//     const [nextJobCardNo, myAllBanks] = await Promise.all([
//       peekNextJobCardNo(businessId),
//       AutoShopBank.find({ businessProfile: businessId }),
//     ]);

//     return res.status(200).json({
//       success: true,
//       data: {
//         myCustomers: [...registeredCustomers, ...onboardedCustomers],
//         nextJobCardNo,
//         myAllSubServices,
//         myAllBanks,
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch job card page details",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    Shared: validate + build the `services` array for create/edit.
//    Recomputes `amount` server-side and enforces odoOutReading
//    when the linked Services doc has odoOutRequired: true.
//    ========================================================= */
// async function buildServicesArray(rawServices) {
//   if (!Array.isArray(rawServices) || rawServices.length === 0) {
//     throw { status: 400, message: "At least one service line item is required" };
//   }

//   const serviceIds = rawServices.filter((s) => s.serviceId).map((s) => s.serviceId);
//   const serviceDocs = serviceIds.length
//     ? await Services.find({ _id: { $in: serviceIds } })
//     : [];
//   const serviceMap = new Map(serviceDocs.map((s) => [s._id.toString(), s]));

//   return rawServices.map((s) => {
//     if (s.unitCost === undefined || s.qty === undefined) {
//       throw { status: 400, message: "Each service line item needs unitCost and qty" };
//     }

//     let parentService = null;
//     if (s.serviceId) {
//       parentService = serviceMap.get(s.serviceId.toString());
//       if (!parentService) {
//         throw { status: 404, message: `Service ${s.serviceId} not found` };
//       }
//     }

//     if (parentService?.odoOutRequired && (s.odoOutReading === undefined || s.odoOutReading === null)) {
//       throw {
//         status: 400,
//         message: `odoOutReading is required for service "${parentService.name}"`,
//       };
//     }

//     return {
//       service: parentService?._id,
//       category: s.category || parentService?.name,
//       desc: s.desc,
//       unitCost: s.unitCost,
//       qty: s.qty,
//       amount: s.unitCost * s.qty, // server-computed, never trusted from client
//       odoOutReading: s.odoOutReading,
//     };
//   });
// }

// /* =========================================================
//    Shared: resolve customer snapshot (registered or onboarded)
//    ========================================================= */
// async function resolveCustomerSnapshot(business, body) {
//   const { customerType, customerId, onboardedCustomerId, customerName, phone, email, city } = body;

//   if (!["registered", "onboarded"].includes(customerType)) {
//     throw { status: 400, message: "customerType must be 'registered' or 'onboarded'" };
//   }

//   if (customerType === "registered") {
//     if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
//       throw { status: 400, message: "Valid customerId is required for a registered customer" };
//     }
//     const entry = business.myCustomers.id(customerId);
//     if (!entry) {
//       throw { status: 404, message: "Customer not found in your added customers list" };
//     }
//     return {
//       customerType,
//       customerId,
//       onboardedCustomerId: undefined,
//       customerName: customerName ?? entry.name,
//       phone: phone ?? entry.phone,
//       email: email ?? entry.email,
//       city: city ?? entry.city,
//     };
//   }

//   // onboarded
//   if (!onboardedCustomerId || !mongoose.Types.ObjectId.isValid(onboardedCustomerId)) {
//     throw { status: 400, message: "Valid onboardedCustomerId is required for an onboarded customer" };
//   }
//   const entry = business.myOnboardedCustomers.id(onboardedCustomerId);
//   if (!entry) {
//     throw { status: 404, message: "Onboarded customer not found" };
//   }
//   return {
//     customerType,
//     customerId: undefined,
//     onboardedCustomerId,
//     customerName: customerName ?? entry.name,
//     phone: phone ?? entry.phone,
//     email: email ?? entry.email,
//     city: city ?? entry.city,
//   };
// }

// /* =========================================================
//    2. CREATE JOB CARD
//    ========================================================= */
// export const createJobCard = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const business = await BusinessProfileModel.findById(businessId).select(
//       "myCustomers myOnboardedCustomers"
//     );
//     if (!business) {
//       return res.status(404).json({ success: false, message: "Business not found" });
//     }

//     const {
//       vehicleId,
//       licensePlateNo,
//       approvedByCustomer,
//       approvalTime,
//       date,
//       odoIn,
//       services,
//       bankId,
//       bankName,
//       bankRefId,
//       labourCharge,
//       terms,
//       sendForApproval,
//     } = req.body;

//     if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
//       return res.status(400).json({ success: false, message: "Valid vehicleId is required" });
//     }

//     const vehicle = await VehicleModel.findById(vehicleId);
//     if (!vehicle) {
//       return res.status(404).json({ success: false, message: "Vehicle not found" });
//     }

//     let customerSnapshot;
//     let builtServices;
//     try {
//       customerSnapshot = await resolveCustomerSnapshot(business, req.body);
//       builtServices = await buildServicesArray(services);
//     } catch (err) {
//       return res.status(err.status || 500).json({ success: false, message: err.message });
//     }

//     let bank = null;
//     if (bankId) {
//       if (!mongoose.Types.ObjectId.isValid(bankId)) {
//         return res.status(400).json({ success: false, message: "Invalid bankId" });
//       }
//       bank = await AutoShopBank.findOne({ _id: bankId, businessProfile: businessId });
//       if (!bank) {
//         return res.status(404).json({ success: false, message: "Bank account not found" });
//       }
//     }

//     const jobCardNo = await getNextJobCardNo(businessId);

//     const jobCard = new JobCard({
//       business: businessId,
//       jobCardNo,
//       ...customerSnapshot,
//       vehicleId,
//       licensePlateNo: licensePlateNo || vehicle.licensePlateNo,
//       approvedByCustomer: approvedByCustomer || false,
//       approvalTime,
//       date: date || Date.now(),
//       odoIn,
//       services: builtServices,
//       bank: bank?._id,
//       bankName: bank?.BankName || bankName,
//       bankRefId,
//       labourCharge: labourCharge || 0,
//       terms,
//       sendForApproval: false, // set via the dedicated endpoint / logic below
//       status: "pending",
//     });

//     if (sendForApproval) {
//       if (customerSnapshot.customerType === "onboarded") {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Cannot send for approval — this is an onboarded customer with no app account. Create the job card without sendForApproval, or add them via the customer add flow first.",
//         });
//       }
//       jobCard.sendForApproval = true;
//       jobCard.sendForApprovalAt = new Date();
//     }

//     await jobCard.save();

//     if (jobCard.sendForApproval) {
//       const customerUser = await User.findById(jobCard.customerId).select("notifications fcmToken");
//       if (customerUser) {
//         const message = `A new job card (#${jobCardNo}) is awaiting your approval.`;
//         customerUser.notifications.push({
//           business: businessId,
//           jobCard: jobCard._id,
//           type: "jobCardApproval",
//           title: "Job card approval needed",
//           message,
//         });
//         await customerUser.save();
//         await sendFcmNotification(customerUser.fcmToken, {
//           title: "Job card approval needed",
//           message,
//         });
//       }
//     }

//     return res.status(201).json({ success: true, message: "Job card created", data: jobCard });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to create job card",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    3. EDIT JOB CARD (by jobCardNo, scoped to this business)
//       Locked once status is convertedToInvoice or CashPaid.
//    ========================================================= */
// export const editJobCard = async (req, res) => {
//   try {
//     const { jobCardNo } = req.params;

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
//     if (!jobCard) {
//       return res.status(404).json({ success: false, message: "Job card not found" });
//     }

//     if (["convertedToInvoice", "CashPaid"].includes(jobCard.status)) {
//       return res.status(409).json({
//         success: false,
//         message: `Job card is locked (status: ${jobCard.status}) and can no longer be edited`,
//       });
//     }

//     const business = await BusinessProfileModel.findById(businessId).select(
//       "myCustomers myOnboardedCustomers"
//     );

//     const {
//       vehicleId,
//       licensePlateNo,
//       approvedByCustomer,
//       approvalTime,
//       date,
//       odoIn,
//       services,
//       bankId,
//       bankName,
//       bankRefId,
//       labourCharge,
//       terms,
//     } = req.body;

//     if (vehicleId) {
//       if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
//         return res.status(400).json({ success: false, message: "Invalid vehicleId" });
//       }
//       const vehicle = await VehicleModel.findById(vehicleId);
//       if (!vehicle) {
//         return res.status(404).json({ success: false, message: "Vehicle not found" });
//       }
//       jobCard.vehicleId = vehicleId;
//       jobCard.licensePlateNo = licensePlateNo || vehicle.licensePlateNo;
//     } else if (licensePlateNo !== undefined) {
//       jobCard.licensePlateNo = licensePlateNo;
//     }

//     // Only re-resolve customer snapshot if the caller is explicitly changing customer
//     if (req.body.customerType) {
//       try {
//         const snapshot = await resolveCustomerSnapshot(business, req.body);
//         Object.assign(jobCard, snapshot);
//       } catch (err) {
//         return res.status(err.status || 500).json({ success: false, message: err.message });
//       }
//     } else {
//       // Allow patching just the snapshot text fields without switching customer
//       const { customerName, phone, email, city } = req.body;
//       if (customerName !== undefined) jobCard.customerName = customerName;
//       if (phone !== undefined) jobCard.phone = phone;
//       if (email !== undefined) jobCard.email = email;
//       if (city !== undefined) jobCard.city = city;
//     }

//     if (services !== undefined) {
//       try {
//         jobCard.services = await buildServicesArray(services);
//       } catch (err) {
//         return res.status(err.status || 500).json({ success: false, message: err.message });
//       }
//     }

//     if (bankId !== undefined) {
//       if (bankId === null) {
//         jobCard.bank = undefined;
//         jobCard.bankName = bankName;
//       } else {
//         if (!mongoose.Types.ObjectId.isValid(bankId)) {
//           return res.status(400).json({ success: false, message: "Invalid bankId" });
//         }
//         const bank = await AutoShopBank.findOne({ _id: bankId, businessProfile: businessId });
//         if (!bank) {
//           return res.status(404).json({ success: false, message: "Bank account not found" });
//         }
//         jobCard.bank = bank._id;
//         jobCard.bankName = bank.BankName;
//       }
//     } else if (bankName !== undefined) {
//       jobCard.bankName = bankName;
//     }

//     if (approvedByCustomer !== undefined) jobCard.approvedByCustomer = approvedByCustomer;
//     if (approvalTime !== undefined) jobCard.approvalTime = approvalTime;
//     if (date !== undefined) jobCard.date = date;
//     if (odoIn !== undefined) jobCard.odoIn = odoIn;
//     if (bankRefId !== undefined) jobCard.bankRefId = bankRefId;
//     if (labourCharge !== undefined) jobCard.labourCharge = labourCharge;
//     if (terms !== undefined) jobCard.terms = terms;

//     await jobCard.save();

//     return res.status(200).json({ success: true, message: "Job card updated", data: jobCard });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update job card",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    4. GET ALL JOB CARDS — search + status filter + pagination
//       Query: ?search=&status=&page=&limit=
//    ========================================================= */
// export const getAllJobCards = async (req, res) => {
//   try {
//     const { search, status, page = 1, limit = 20 } = req.query;

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     await autoRejectStaleForBusiness(businessId);

//     const filter = { business: businessId };

//     if (status) {
//       const validStatuses = ["pending", "autoRejected", "convertedToInvoice", "CashPaid"];
//       if (!validStatuses.includes(status)) {
//         return res.status(400).json({ success: false, message: "Invalid status filter" });
//       }
//       filter.status = status;
//     }

//     if (search) {
//       const orClauses = [
//         { customerName: { $regex: search, $options: "i" } },
//         { phone: { $regex: search, $options: "i" } },
//         { licensePlateNo: { $regex: search, $options: "i" } },
//       ];
//       const asNumber = Number(search);
//       if (!Number.isNaN(asNumber)) {
//         orClauses.push({ jobCardNo: asNumber });
//       }
//       filter.$or = orClauses;
//     }

//     const skip = (Number(page) - 1) * Number(limit);

//     const [jobCards, total] = await Promise.all([
//       JobCard.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
//       JobCard.countDocuments(filter),
//     ]);

//     return res.status(200).json({
//       success: true,
//       data: jobCards,
//       pagination: { total, page: Number(page), limit: Number(limit) },
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch job cards",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    5. DELETE JOB CARD
//    ========================================================= */
// export const deleteJobCard = async (req, res) => {
//   try {
//     const { jobCardNo } = req.params;

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const deleted = await JobCard.findOneAndDelete({
//       business: businessId,
//       jobCardNo: Number(jobCardNo),
//     });

//     if (!deleted) {
//       return res.status(404).json({ success: false, message: "Job card not found" });
//     }

//     return res.status(200).json({ success: true, message: "Job card deleted" });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete job card",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    6. MARK STATUS (convertedToInvoice / CashPaid)
//    ========================================================= */
// export const markStatus = async (req, res) => {
//   try {
//     const { jobCardNo } = req.params;
//     const { status } = req.body;

//     if (!["convertedToInvoice", "CashPaid"].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "status must be 'convertedToInvoice' or 'CashPaid'",
//       });
//     }

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
//     if (!jobCard) {
//       return res.status(404).json({ success: false, message: "Job card not found" });
//     }

//     if (["convertedToInvoice", "CashPaid"].includes(jobCard.status)) {
//       return res.status(409).json({
//         success: false,
//         message: `Job card is already ${jobCard.status}`,
//       });
//     }

//     jobCard.status = status;
//     await jobCard.save();

//     return res.status(200).json({ success: true, message: `Job card marked ${status}`, data: jobCard });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update job card status",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    7. SEND FOR APPROVAL
//       Notifies the customer (registered users only — onboarded
//       customers have no account to notify) via an in-app
//       notification (saved on User) + FCM push.
//    ========================================================= */
// export const sendForApproval = async (req, res) => {
//   try {
//     const { jobCardNo } = req.params;

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
//     if (!jobCard) {
//       return res.status(404).json({ success: false, message: "Job card not found" });
//     }

//     if (jobCard.status !== "pending") {
//       return res.status(409).json({
//         success: false,
//         message: `Job card status is ${jobCard.status}, cannot send for approval`,
//       });
//     }

//     if (jobCard.customerType === "onboarded") {
//       return res.status(400).json({
//         success: false,
//         message: "Cannot send for approval — this customer has no app account to notify",
//       });
//     }

//     const customerUser = await User.findById(jobCard.customerId).select("notifications fcmToken");
//     if (!customerUser) {
//       return res.status(404).json({ success: false, message: "Customer account not found" });
//     }

//     jobCard.sendForApproval = true;
//     jobCard.sendForApprovalAt = new Date();
//     await jobCard.save();

//     const message = `A new job card (#${jobCard.jobCardNo}) is awaiting your approval.`;
//     customerUser.notifications.push({
//       business: businessId,
//       jobCard: jobCard._id,
//       type: "jobCardApproval",
//       title: "Job card approval needed",
//       message,
//     });
//     await customerUser.save();

//     await sendFcmNotification(customerUser.fcmToken, {
//       title: "Job card approval needed",
//       message,
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Job card sent to customer for approval",
//       data: jobCard,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to send job card for approval",
//       error: error.message,
//     });
//   }
// };

// /* =========================================================
//    8. GET JOB CARDS AWAITING CUSTOMER APPROVAL
//    ========================================================= */
// export const getSendForApprovalJobCards = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     await autoRejectStaleForBusiness(businessId);

//     const jobCards = await JobCard.find({
//       business: businessId,
//       sendForApproval: true,
//       status: "pending",
//     }).sort({ sendForApprovalAt: -1 });

//     return res.status(200).json({ success: true, data: jobCards });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch pending-approval job cards",
//       error: error.message,
//     });
//   }
// };

// /*
//  * SCHEDULING NOTE: autoRejectStaleForBusiness() above only runs lazily,
//  * scoped to one business, when that business's owner hits getAllJobCards
//  * or getSendForApprovalJobCards. A job card in a shop that nobody checks
//  * won't flip to "autoRejected" exactly at the 7-day mark. For accurate,
//  * shop-independent timing, add a scheduled task (e.g. node-cron) that
//  * runs across ALL businesses periodically, e.g.:
//  *
//  *   import cron from "node-cron";
//  *   cron.schedule("0 * * * *", async () => { // hourly
//  *     const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
//  *     await JobCard.updateMany(
//  *       { status: "pending", sendForApproval: true, approvedByCustomer: false,
//  *         sendForApprovalAt: { $lte: cutoff } },
//  *       { $set: { status: "autoRejected" } }
//  *     );
//  *   });
//  */




import mongoose from "mongoose";



import Services from "../../Schema/services.schema.js";
import AutoShopBank from "../../Schema/AutoShopAccounts/autoShopBank.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
// import { getNextJobCardNo, peekNextJobCardNo } from "../../Schema/Jobcardcounter.schema.js";
// import { getNextJobCardIdentifiers,peekNextJobCardIdentifiers } from "./jobCardIdentifier.helper.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import { User } from "../../Schema/user.schema.js";
import { getNextJobCardIdentifiers, peekNextJobCardIdentifiers } from "./Jobcardidentifier.helper.js";
import { generateInvoiceId } from "./invoiceIdentifier.helper.js";



const AUTO_REJECT_AFTER_DAYS = 7;

/* Helper: resolve the caller's businessProfile id from DB (req.user only
   ever has { id, role, ... } from jwtAuth — never businessProfile). */
async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

/* Placeholder — plug in your actual firebase-admin messaging call here.
   Kept as a stub since no FCM setup was provided. */
async function sendFcmNotification(fcmToken, { title, message }) {
  if (!fcmToken) return;
  // Example real implementation:
  // await admin.messaging().send({
  //   token: fcmToken,
  //   notification: { title, body: message },
  // });
  console.log("[FCM STUB] would send push:", { fcmToken, title, message });
}

/* Auto-rejects any pending job card for this business that was sent for
   approval more than AUTO_REJECT_AFTER_DAYS ago and never approved.
   Called lazily from the list/pending-approval endpoints below. For exact
   timing regardless of traffic, also schedule this (e.g. node-cron) to run
   across ALL businesses periodically — see note at bottom of this file. */
async function autoRejectStaleForBusiness(businessId) {
  const cutoff = new Date(Date.now() - AUTO_REJECT_AFTER_DAYS * 24 * 60 * 60 * 1000);
  await JobCard.updateMany(
    {
      business: businessId,
      status: "pending",
      sendForApproval: true,
      approvedByCustomer: false,
      sendForApprovalAt: { $lte: cutoff },
    },
    { $set: { status: "autoRejected" } }
  );
}

/* =========================================================
   1. GET JOB CARD PAGE DETAILS
      -> myCustomers (registered + onboarded), nextJobCardNo,
         myAllSubServices (flattened), myAllBanks
   ========================================================= */
export const getJobCardPageDetails = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    // Fetch business customers and services only
    const business = await BusinessProfileModel.findById(businessId)
      .select("myCustomers myServices")
      .populate("myServices.service", "name shopType odoOutRequired");

    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    // For each approved customer, fetch their user and vehicles (if linked to a user account)
    const registeredCustomers = await Promise.all(
      business.myCustomers
        .filter(customer => customer.status === "approved")
        .map(async customer => {
          let vehicles = [];
          let userId = customer._id;
          if (userId) {
            const userDoc = await User.findById(userId).select("myVehicles");
            if (userDoc && userDoc.myVehicles && userDoc.myVehicles.length > 0) {
              vehicles = await VehicleModel.find({ _id: { $in: userDoc.myVehicles } });
            }
          }
          return {
            _id: customer._id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            city: customer.city,
            status: customer.status,
            addedAt: customer.addedAt,
            myVehicles: vehicles
          };
        })
    );

    // Flatten myServices -> individual subService rows for the line-item picker
    const myAllSubServices = [];
    business.myServices.forEach((ms) => {
      const parent = ms.service; // populated Services doc (or null if deleted)
      (ms.subServices || []).forEach((sub) => {
        myAllSubServices.push({
          serviceId: parent?._id || null,
          category: parent?.name || sub.name,
          subServiceName: sub.name,
          desc: sub.desc,
          price: sub.price,
          quantity: sub.quantity,
          tax: sub.tax,
          make:sub.make,
          model:sub.model,
          odoOutRequired: parent?.odoOutRequired || false,
        });
      });
    });

    // const [nextJobCardNo, myAllBanks] = await Promise.all([
    //   peekNextJobCardNo(businessId),
    //   AutoShopBank.find({ businessProfile: businessId }),
    // ]);

    const [nextJobCard, myAllBanks] = await Promise.all([
      peekNextJobCardIdentifiers(businessId), // import from jobCardIdentifier.helper.js
      AutoShopBank.find({ businessProfile: businessId }),
    ]);
    

    return res.status(200).json({
      success: true,
      data: {
        myCustomers: registeredCustomers,
        nextJobCard,
        nextJobCardNo:nextJobCard.jobCardId,
        myAllSubServices,
        myAllBanks,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job card page details",
      error: error.message,
    });
  }
};

/* =========================================================
   Shared: validate + build the `services` array for create/edit.
   Recomputes `amount` server-side and enforces odoOutReading
   when the linked Services doc has odoOutRequired: true.
   ========================================================= */
async function buildServicesArray(rawServices) {
  if (!Array.isArray(rawServices) || rawServices.length === 0) {
    throw { status: 400, message: "At least one service line item is required" };
  }

  const serviceIds = rawServices.filter((s) => s.serviceId).map((s) => s.serviceId);
  const serviceDocs = serviceIds.length
    ? await Services.find({ _id: { $in: serviceIds } })
    : [];
  const serviceMap = new Map(serviceDocs.map((s) => [s._id.toString(), s]));

  return rawServices.map((s) => {
    if (s.unitCost === undefined || s.qty === undefined) {
      throw { status: 400, message: "Each service line item needs unitCost and qty" };
    }

    let parentService = null;
    if (s.serviceId) {
      parentService = serviceMap.get(s.serviceId.toString());
      if (!parentService) {
        throw { status: 404, message: `Service ${s.serviceId} not found` };
      }
    }

    if (parentService?.odoOutRequired && (s.odoOutReading === undefined || s.odoOutReading === null)) {
      throw {
        status: 400,
        message: `odoOutReading is required for service "${parentService.name}"`,
      };
    }

    return {
      service: parentService?._id,
      category: s.category || parentService?.name,
      desc: s.desc,
      unitCost: s.unitCost,
      qty: s.qty,
      amount: s.unitCost * s.qty, // server-computed, never trusted from client
      odoOutReading: s.odoOutReading,
    };
  });
}

/* =========================================================
   Shared: resolve customer snapshot (registered or onboarded)
   Both types now resolve to a real User — onboarded customers
   have a real account too (see customer.controller.js), so
   jobCard.customerId is always set, and notifications work
   for both types.
   ========================================================= */
async function resolveCustomerSnapshot(business, body) {
  const { customerType, customerId, onboardedCustomerId, customerName, phone, email, city } = body;

  if (!["registered", "onboarded"].includes(customerType)) {
    throw { status: 400, message: "customerType must be 'registered' or 'onboarded'" };
  }

  if (customerType === "registered") {
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      throw { status: 400, message: "Valid customerId is required for a registered customer" };
    }
    const entry = business.myCustomers.id(customerId);
    if (!entry) {
      throw { status: 404, message: "Customer not found in your added customers list" };
    }
    return {
      customerType,
      customerId,
      onboardedCustomerId: undefined,
      customerName: customerName ?? entry.name,
      phone: phone ?? entry.phone,
      email: email ?? entry.email,
      city: city ?? entry.city,
    };
  }

  // onboarded — resolve the real User behind this onboarding record
  if (!onboardedCustomerId || !mongoose.Types.ObjectId.isValid(onboardedCustomerId)) {
    throw { status: 400, message: "Valid onboardedCustomerId is required for an onboarded customer" };
  }
  const entry = business.myOnboardedCustomers.id(onboardedCustomerId);
  if (!entry) {
    throw { status: 404, message: "Onboarded customer not found" };
  }
  const onboardedUser = await User.findById(entry.user).select("name phone email city");
  if (!onboardedUser) {
    throw { status: 404, message: "Onboarded customer's account no longer exists" };
  }
  return {
    customerType,
    customerId: onboardedUser._id, // real User _id — notifications work the same as registered customers
    onboardedCustomerId,
    customerName: customerName ?? onboardedUser.name,
    phone: phone ?? onboardedUser.phone,
    email: email ?? onboardedUser.email,
    city: city ?? onboardedUser.city,
  };
}

/* =========================================================
   2. CREATE JOB CARD
   ========================================================= */
export const createJobCard = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId).select(
      "myCustomers myOnboardedCustomers"
    );
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const {
      vehicleId,
      licensePlateNo,
      approvedByCustomer,
      approvalTime,
      date,
      odoIn,
      services,
      bankId,
      bankName,
      // bankRefId,
      labourCharge,
      terms,
      sendForApproval,
    } = req.body;

    if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ success: false, message: "Valid vehicleId is required" });
    }

    const vehicle = await VehicleModel.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    // Validate that each service has a serviceId
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success: false, message: "At least one service is required" });
    }
    for (let i = 0; i < services.length; i++) {
      if (!services[i].serviceId || !mongoose.Types.ObjectId.isValid(services[i].serviceId)) {
        return res.status(400).json({ 
          success: false, 
          message: `serviceId is required and must be a valid ObjectId for each service (index ${i})` 
        });
      }
    }

    let customerSnapshot;
    let builtServices;
    try {
      customerSnapshot = await resolveCustomerSnapshot(business, req.body);
      builtServices = await buildServicesArray(services);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }

    let bank = null;
    console.log(bankId);
    if (bankId) {
      if (!mongoose.Types.ObjectId.isValid(bankId)) {
        return res.status(400).json({ success: false, message: "Invalid bankId" });
      }
      bank = await AutoShopBank.findOne({ _id: bankId, businessProfile: businessId });
      if (!bank) {
        return res.status(404).json({ success: false, message: "Bank account not found" });
      }
    }

    // const jobCardNo = await getNextJobCardNo(businessId);

    // const jobCard = new JobCard({
    //   business: businessId,
    //   jobCardNo,
    let jobCardNo, jobCardId;
try {
  ({ jobCardNo, jobCardId } = await getNextJobCardIdentifiers(businessId));
} catch (err) {
  return res.status(err.status || 500).json({ success: false, message: err.message });
}

const jobCard = new JobCard({
  business: businessId,
  jobCardNo,
  jobCardId, // NEW — e.g. "ABC-137"
      ...customerSnapshot,
      vehicleId,
      licensePlateNo: licensePlateNo || vehicle.licensePlateNo,
      approvedByCustomer: approvedByCustomer || false,
      approvalTime,
      date: date || Date.now(),
      odoIn,
      services: builtServices,
      bank: bank?._id,
      bankName: bank?.BankName || bankName,
      // bankRefId,
      labourCharge: labourCharge || 0,
      terms,
      sendForApproval: false, // set via the dedicated endpoint / logic below
      status: "pending",
    });

    if (sendForApproval) {
      jobCard.sendForApproval = true;
      jobCard.sendForApprovalAt = new Date();
    }

    await jobCard.save();

    if (jobCard.sendForApproval) {
      const customerUser = await User.findById(jobCard.customerId).select("notifications fcmToken");
      if (customerUser) {
        const message = `A new job card (#${jobCardNo}) is awaiting your approval.`;
        customerUser.notifications.push({
          business: businessId,
          jobCard: jobCard._id,
          type: "jobCardApproval",
          title: "Job card approval needed",
          message,
        });
        await customerUser.save();
        await sendFcmNotification(customerUser.fcmToken, {
          title: "Job card approval needed",
          message,
        });
      }
    }

    return res.status(201).json({ success: true, message: "Job card created", data: jobCard });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create job card",
      error: error.message,
    });
  }
};

/* =========================================================
   3. EDIT JOB CARD (by jobCardNo, scoped to this business)
      Locked once status is convertedToInvoice or CashPaid.
   ========================================================= */
export const editJobCard = async (req, res) => {
  try {
    const { jobCardNo } = req.params;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
    if (!jobCard) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    if (["convertedToInvoice", "CashPaid"].includes(jobCard.status)) {
      return res.status(409).json({
        success: false,
        message: `Job card is locked (status: ${jobCard.status}) and can no longer be edited`,
      });
    }

    const business = await BusinessProfileModel.findById(businessId).select(
      "myCustomers myOnboardedCustomers"
    );

    const {
      vehicleId,
      licensePlateNo,
      approvedByCustomer,
      approvalTime,
      date,
      odoIn,
      services,
      bankId,
      bankName,
      // bankRefId,
      labourCharge,
      terms,
    } = req.body;

    if (vehicleId) {
      if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
        return res.status(400).json({ success: false, message: "Invalid vehicleId" });
      }
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: "Vehicle not found" });
      }
      jobCard.vehicleId = vehicleId;
      jobCard.licensePlateNo = licensePlateNo || vehicle.licensePlateNo;
    } else if (licensePlateNo !== undefined) {
      jobCard.licensePlateNo = licensePlateNo;
    }

    // Only re-resolve customer snapshot if the caller is explicitly changing customer
    if (req.body.customerType) {
      try {
        const snapshot = await resolveCustomerSnapshot(business, req.body);
        Object.assign(jobCard, snapshot);
      } catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
      }
    } else {
      // Allow patching just the snapshot text fields without switching customer
      const { customerName, phone, email, city } = req.body;
      if (customerName !== undefined) jobCard.customerName = customerName;
      if (phone !== undefined) jobCard.phone = phone;
      if (email !== undefined) jobCard.email = email;
      if (city !== undefined) jobCard.city = city;
    }

    if (services !== undefined) {
      // Validate serviceId for each service
      if (!Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ success: false, message: "At least one service is required" });
      }
      for (let i = 0; i < services.length; i++) {
        if (!services[i].serviceId || !mongoose.Types.ObjectId.isValid(services[i].serviceId)) {
          return res.status(400).json({ 
            success: false, 
            message: `serviceId is required and must be a valid ObjectId for each service (index ${i})` 
          });
        }
      }

      try {
        jobCard.services = await buildServicesArray(services);
      } catch (err) {
        return res.status(err.status || 500).json({ success: false, message: err.message });
      }
    }

    if (bankId !== undefined) {
      if (bankId === null) {
        jobCard.bank = undefined;
        jobCard.bankName = bankName;
      } else {
        if (!mongoose.Types.ObjectId.isValid(bankId)) {
          return res.status(400).json({ success: false, message: "Invalid bankId" });
        }
        const bank = await AutoShopBank.findOne({ _id: bankId, businessProfile: businessId });
        if (!bank) {
          return res.status(404).json({ success: false, message: "Bank account not found" });
        }
        jobCard.bank = bank._id;
        jobCard.bankName = bank.BankName;
      }
    } else if (bankName !== undefined) {
      jobCard.bankName = bankName;
    }

    if (approvedByCustomer !== undefined) jobCard.approvedByCustomer = approvedByCustomer;
    if (approvalTime !== undefined) jobCard.approvalTime = approvalTime;
    if (date !== undefined) jobCard.date = date;
    if (odoIn !== undefined) jobCard.odoIn = odoIn;
    // if (bankRefId !== undefined) jobCard.bankRefId = bankRefId;
    if (labourCharge !== undefined) jobCard.labourCharge = labourCharge;
    if (terms !== undefined) jobCard.terms = terms;

    await jobCard.save();

    return res.status(200).json({ success: true, message: "Job card updated", data: jobCard });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update job card",
      error: error.message,
    });
  }
};

/* =========================================================
   4. GET ALL JOB CARDS — search + status filter + pagination
      Query: ?search=&status=&page=&limit=
   ========================================================= */
export const getAllJobCards = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    await autoRejectStaleForBusiness(businessId);

    const filter = { business: businessId };

    if (status) {
      const validStatuses = ["pending", "autoRejected", "convertedToInvoice", "CashPaid"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter" });
      }
      filter.status = status;
    }

    if (search) {
      const orClauses = [
        { customerName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { licensePlateNo: { $regex: search, $options: "i" } },
      ];
      const asNumber = Number(search);
      if (!Number.isNaN(asNumber)) {
        orClauses.push({ jobCardNo: asNumber });
      }
      filter.$or = orClauses;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [jobCards, total] = await Promise.all([
      JobCard.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      JobCard.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: jobCards,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job cards",
      error: error.message,
    });
  }
};

/* =========================================================
   5. DELETE JOB CARD
   ========================================================= */
export const deleteJobCard = async (req, res) => {
  try {
    const { jobCardNo } = req.params;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const deleted = await JobCard.findOneAndDelete({
      business: businessId,
      jobCardNo: Number(jobCardNo),
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    return res.status(200).json({ success: true, message: "Job card deleted" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete job card",
      error: error.message,
    });
  }
};

/* =========================================================
   6. MARK STATUS (convertedToInvoice / CashPaid)
   ========================================================= */
// export const markStatus = async (req, res) => {
//   try {
//     const { jobCardNo } = req.params;
//     const { status } = req.body;

//     if (!["convertedToInvoice", "CashPaid"].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "status must be 'convertedToInvoice' or 'CashPaid'",
//       });
//     }

//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
//     if (!jobCard) {
//       return res.status(404).json({ success: false, message: "Job card not found" });
//     }

//     if (["convertedToInvoice", "CashPaid"].includes(jobCard.status)) {
//       return res.status(409).json({
//         success: false,
//         message: `Job card is already ${jobCard.status}`,
//       });
//     }

//     jobCard.status = status;
//     await jobCard.save();

//     return res.status(200).json({ success: true, message: `Job card marked ${status}`, data: jobCard });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update job card status",
//       error: error.message,
//     });
//   }
// };


export const markStatus = async (req, res) => {
  try {
    const { jobCardNo } = req.params;
    const { status } = req.body;
 
    if (!["convertedToInvoice", "CashPaid"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be 'convertedToInvoice' or 'CashPaid'",
      });
    }
 
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }
 
    const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
    if (!jobCard) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }
 
    if (["convertedToInvoice", "CashPaid"].includes(jobCard.status)) {
      return res.status(409).json({
        success: false,
        message: `Job card is already ${jobCard.status}`,
      });
    }
 
    // Generate the invoice ID ONLY the first time this job card gets
    // converted — invoiceId is set once and never regenerated, even if
    // status somehow gets flipped between convertedToInvoice/CashPaid later.
    if (!jobCard.invoiceId) {
      try {
        jobCard.invoiceId = await generateInvoiceId(businessId);
      } catch (err) {
        if (err.code === "INVOICE_PREFIX_NOT_SET") {
          return res.status(409).json({ success: false, message: err.message });
        }
        throw err;
      }
    }
 
    jobCard.status = status;
    await jobCard.save();
 
    return res.status(200).json({ success: true, message: `Job card marked ${status}`, data: jobCard });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update job card status",
      error: error.message,
    });
  }
};
 


/* =========================================================
   MARK INVOICE AS PAID
   Sets invoicePaid to true for a given jobCardNo if eligible.
   Only allowed if status is convertedToInvoice.
   Route: POST /jobCards/:jobCardNo/markInvoicePaid
========================================================= */
export const markInvoicePaid = async (req, res) => {
  try {
    const { jobCardNo } = req.params;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
    if (!jobCard) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    if (jobCard.invoicePaid) {
      return res.status(409).json({
        success: false,
        message: "Job card invoice already marked as paid",
      });
    }

    // Only allow if jobCard.status is exactly convertedToInvoice
    if (jobCard.status !== "convertedToInvoice") {
      return res.status(409).json({
        success: false,
        message: "Job card status must be 'convertedToInvoice' to mark invoice as paid",
      });
    }

    jobCard.invoicePaid = true;
    await jobCard.save();

    return res.status(200).json({ 
      success: true, 
      message: "Job card invoice marked as paid", 
      data: jobCard 
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark job card invoice as paid",
      error: error.message,
    });
  }
};



/* =========================================================
   7. SEND FOR APPROVAL
      Notifies the customer (registered users only — onboarded
      customers have no account to notify) via an in-app
      notification (saved on User) + FCM push.
   ========================================================= */
export const sendForApproval = async (req, res) => {
  try {
    const { jobCardNo } = req.params;

    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const jobCard = await JobCard.findOne({ business: businessId, jobCardNo: Number(jobCardNo) });
    if (!jobCard) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    if (jobCard.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Job card status is ${jobCard.status}, cannot send for approval`,
      });
    }

    const customerUser = await User.findById(jobCard.customerId).select("notifications fcmToken");
    if (!customerUser) {
      return res.status(404).json({ success: false, message: "Customer account not found" });
    }

    jobCard.sendForApproval = true;
    jobCard.sendForApprovalAt = new Date();
    await jobCard.save();

    const message = `A new job card (#${jobCard.jobCardNo}) is awaiting your approval.`;
    customerUser.notifications.push({
      business: businessId,
      jobCard: jobCard._id,
      type: "jobCardApproval",
      title: "Job card approval needed",
      message,
    });
    await customerUser.save();

    await sendFcmNotification(customerUser.fcmToken, {
      title: "Job card approval needed",
      message,
    });

    return res.status(200).json({
      success: true,
      message: "Job card sent to customer for approval",
      data: jobCard,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send job card for approval",
      error: error.message,
    });
  }
};

/* =========================================================
   8. GET JOB CARDS AWAITING CUSTOMER APPROVAL
   ========================================================= */
export const getSendForApprovalJobCards = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    await autoRejectStaleForBusiness(businessId);

    const jobCards = await JobCard.find({
      business: businessId,
      sendForApproval: true,
      status: "pending",
    }).sort({ sendForApprovalAt: -1 });

    return res.status(200).json({ success: true, data: jobCards });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending-approval job cards",
      error: error.message,
    });
  }
};


// // Get all paid invoices for GST reports (status: "convertedToInvoice")
// export const getGSTReports = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     // status MUST MATCH enum: 'convertedToInvoice'
//     const invoices = await JobCard.find({
//       business: businessId,
//       status: "convertedToInvoice",
//       invoicePaid: true,
//     }).sort({ updatedAt: -1 });

//     return res.status(200).json({
//       success: true,
//       data: invoices,
//       message: "Paid invoices (convertedToInvoice) fetched for GST reports",
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch paid invoices for GST reports",
//       error: error.message,
//     });
//   }
// };

// // Get total income: All paid invoices with status "convertedToInvoice" OR status "CashPaid"
// export const getIncome = async (req, res) => {
//   try {
//     const businessId = await getBusinessId(req.user.id);
//     if (!businessId) {
//       return res.status(404).json({ success: false, message: "Business profile not found" });
//     }

//     // Query both 'convertedToInvoice' (with invoicePaid: true) and 'CashPaid' (considered paid in cash)
//     const paidInvoices = await JobCard.find({
//       business: businessId,
//       $or: [
//         { status: "convertedToInvoice", invoicePaid: true },
//         { status: "CashPaid" }
//       ]
//     }).sort({ updatedAt: -1 });

//     // If you want just the total sum, compute it
//     const totalIncome = paidInvoices.reduce((sum, jc) => sum + (jc.totalAmount || 0), 0);

//     return res.status(200).json({
//       success: true,
//       data: paidInvoices,
//       totalIncome,
//       message: "Total income (Paid invoices + CashPaid) fetched",
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch income details",
//       error: error.message,
//     });
//   }
// };

// async function getBusinessId(userId) {
//   const user = await User.findById(userId).select("businessProfile");
//   if (!user || !user.businessProfile) return null;
//   return user.businessProfile;
// }
 
/**
 * Build a Mongoose date-range filter object from optional
 * startDate / endDate query params, applied to a given field.
 * Returns undefined if neither param is present, so callers can
 * safely spread/assign without adding an empty filter key.
 *
 * Accepts ISO strings or any Date-parseable string (e.g. "2026-04-01").
 * endDate is treated as inclusive through the end of that day.
 */
function buildDateRangeFilter(startDate, endDate) {
  if (!startDate && !endDate) return undefined;
 
  const range = {};
 
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new Error(`Invalid startDate: ${startDate}`);
    }
    range.$gte = start;
  }
 
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      throw new Error(`Invalid endDate: ${endDate}`);
    }
    // Push to the end of the given day so the range is inclusive
    // (e.g. endDate=2026-06-30 should include invoices updated at
    // any time ON 2026-06-30, not just at 00:00:00).
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
 
  return range;
}
 

 
/* =========================================================
   GST REPORTS
   All paid invoices (status: "convertedToInvoice", invoicePaid: true),
   optionally filtered by updatedAt date range.
   Route: GET /jobCards/gst-reports?startDate=&endDate=
========================================================= */
export const getGSTReports = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }
 
    const { startDate, endDate } = req.query;
 
    let dateRange;
    try {
      dateRange = buildDateRangeFilter(startDate, endDate);
    } catch (dateErr) {
      return res.status(400).json({ success: false, message: dateErr.message });
    }
 
    // status MUST MATCH enum: 'convertedToInvoice'
    const query = {
      business: businessId,
      status: "convertedToInvoice",
      invoicePaid: true,
    };
    if (dateRange) query.updatedAt = dateRange;
 
    const invoices = await JobCard.find(query).sort({ updatedAt: -1 });
 
    return res.status(200).json({
      success: true,
      data: invoices,
      message: "Paid invoices (convertedToInvoice) fetched for GST reports",
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch paid invoices for GST reports",
      error: error.message,
    });
  }
};
 
/* =========================================================
   INCOME REPORT
   All paid invoices with status "convertedToInvoice" (invoicePaid: true)
   OR status "CashPaid", optionally filtered by updatedAt date range.
   Route: GET /jobCards/income?startDate=&endDate=
========================================================= */
export const getIncome = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }
 
    const { startDate, endDate } = req.query;
 
    let dateRange;
    try {
      dateRange = buildDateRangeFilter(startDate, endDate);
    } catch (dateErr) {
      return res.status(400).json({ success: false, message: dateErr.message });
    }
 
    // Query both 'convertedToInvoice' (with invoicePaid: true) and 'CashPaid' (considered paid in cash)
    const query = {
      business: businessId,
      $or: [
        { status: "convertedToInvoice", invoicePaid: true },
        { status: "CashPaid" }
      ]
    };
    if (dateRange) query.updatedAt = dateRange;
 
    const paidInvoices = await JobCard.find(query).sort({ updatedAt: -1 });
 
    // If you want just the total sum, compute it
    const totalIncome = paidInvoices.reduce((sum, jc) => sum + (jc.totalAmount || 0), 0);
 
    return res.status(200).json({
      success: true,
      data: paidInvoices,
      totalIncome,
      message: "Total income (Paid invoices + CashPaid) fetched",
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch income details",
      error: error.message,
    });
  }
};
 



/*
 * SCHEDULING NOTE: autoRejectStaleForBusiness() above only runs lazily,
 * scoped to one business, when that business's owner hits getAllJobCards
 * or getSendForApprovalJobCards. A job card in a shop that nobody checks
 * won't flip to "autoRejected" exactly at the 7-day mark. For accurate,
 * shop-independent timing, add a scheduled task (e.g. node-cron) that
 * runs across ALL businesses periodically, e.g.:
 *
 *   import cron from "node-cron";
 *   cron.schedule("0 * * * *", async () => { // hourly
 *     const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
 *     await JobCard.updateMany(
 *       { status: "pending", sendForApproval: true, approvedByCustomer: false,
 *         sendForApprovalAt: { $lte: cutoff } },
 *       { $set: { status: "autoRejected" } }
 *     );
 *   });
 */