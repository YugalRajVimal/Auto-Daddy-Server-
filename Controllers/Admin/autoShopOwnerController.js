import mongoose from "mongoose";
import { deleteUploadedFile, deleteUploadedFiles } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import adsSchema from "../../Schema/ads.schema.js";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import CarCompany from "../../Schema/car-company-schema.js";
import Province from "../../Schema/cities.schema.js";
import City from "../../Schema/cities.schema.js";
import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import DealModel from "../../Schema/deals.schema.js";
import InviteHelpSchema from "../../Schema/InviteHelp.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import Services from "../../Schema/services.schema.js";
import { User } from "../../Schema/user.schema.js";
import WebsiteTemplateSchema from "../../Schema/WebsiteTemplateSchema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";


class AutoShopOwnerController {

    async getAllAutoShopOwners(req, res) {
      try {
        // Find users with role 'autoshopowner', select specific fields only
        const autoShopOwnersRaw = await User.find(
          { role: "autoshopowner" },
          {
            name: 1,
            email: 1,
            countryCode: 1,
            phone: 1,
            pincode: 1,
            address: 1,
            isDisabled: 1,
            isProfileComplete: 1,
            isBusinessProfileCompleted: 1,
            businessProfile: 1,
            myCustomers: 1,
            createdAt: 1,
            status: 1,
            shopType: 1,
            city:1
          }
        )
          .populate({
            path: "businessProfile",
            model: "BusinessProfile",
            populate: [
              {
                path: "myServices.service",
                model: "Services",
              },
              {
                path: "myDeals",
                model: "Deal",
              },
            ],
          })
          .populate({
            path: "myCustomers",
            model: "User",
            select: "name email phone", // send main details only
          })
          .lean();

        // Helper function to populate valueId accordingly (unchanged)
        async function populateDealValueIds(deals) {
          if (!Array.isArray(deals)) return deals;
          return Promise.all(
            deals.map(async (deal) => {
              if (deal.type === "services" && deal.valueId) {
                const ServiceModel =
                  require("../../Schema/services.schema").default ||
                  require("../../Schema/services.schema");
                const service = await ServiceModel.findById(deal.valueId).lean();
                return { ...deal, value: service || null };
              } else if (deal.type === "subservices" && deal.valueId) {
                const ServiceModel =
                  require("../../Schema/services.schema").default ||
                  require("../../Schema/services.schema");
                const serviceDoc = await ServiceModel.findOne(
                  { "services._id": deal.valueId },
                  { "services.$": 1, name: 1 }
                ).lean();
                let subservice = null;
                if (
                  serviceDoc &&
                  serviceDoc.services &&
                  serviceDoc.services[0]
                ) {
                  subservice = {
                    ...serviceDoc.services[0],
                    parentServiceName: serviceDoc.name,
                  };
                }
                return { ...deal, value: subservice || null };
              }
              return deal;
            })
          );
        }

        // For each autoShopOwner, populate their businessProfile.myDeals accordingly (if exists)
        if (Array.isArray(autoShopOwnersRaw)) {
          for (const owner of autoShopOwnersRaw) {
            if (
              owner.businessProfile &&
              owner.businessProfile.myDeals &&
              Array.isArray(owner.businessProfile.myDeals)
            ) {
              owner.businessProfile.myDeals =
                await populateDealValueIds(owner.businessProfile.myDeals);
            }
          }
        }

        // Collect all businessProfile _ids to fetch JobCards in one go
        const businessProfileIds = autoShopOwnersRaw
          .map((o) =>
            o.businessProfile && o.businessProfile._id
              ? o.businessProfile._id.toString()
              : null
          )
          .filter((id) => !!id);

        // Bulk fetch all JobCards where 'business' matches any auto shop owner's businessProfile _id
        // Use .lean() for performance, unless you need Mongoose docs for virtuals etc.
        const allJobCards = await JobCard.find({
          business: { $in: businessProfileIds },
        }).lean();

        // Group JobCards by business (businessProfile _id)
        const jobCardsByBusiness = {};
        for (const jobCard of allJobCards) {
          const businessId = jobCard.business?.toString();
          if (!businessId) continue;
          if (!jobCardsByBusiness[businessId]) {
            jobCardsByBusiness[businessId] = [];
          }
          jobCardsByBusiness[businessId].push(jobCard);
        }

        // Prepare response with number of customers and their main details
        const autoShopOwners = await Promise.all(
          autoShopOwnersRaw.map(async (owner) => {
            let deals = [];
            if (owner.businessProfile?._id) {
              deals = await DealModel.find({
                createdBy: owner.businessProfile._id,
              }).lean();
            }
            // Gather jobCards for this owner (their businessProfile._id)
            const jobCards =
              owner.businessProfile && owner.businessProfile._id
                ? jobCardsByBusiness[owner.businessProfile._id.toString()] || []
                : [];

            // Customers main details and count
            const customers = Array.isArray(owner.myCustomers)
              ? owner.myCustomers.map((c) => ({
                  _id: c._id,
                  name: c.name,
                  email: c.email,
                  phone: c.phone,
                }))
              : [];
            const customerCount = customers.length;

            // console.log(owner);

            return {
              ...owner,
              deals,
              jobCards,
              customers,
              customerCount, // number of customers
            };
          })
        );

        res
          .status(200)
          .json({ success: true, data: autoShopOwners });
      } catch (err) {
        res
          .status(500)
          .json({
            success: false,
            message: "Error fetching auto shop owners",
            error: err.message,
          });
      }
    }


  // ─── CREATE AUTO SHOP OWNER ─────────────────────────────────────────────────
  /**
   * Create a new auto shop owner account.
   * POST /api/admin/autoshopowners
   *
   * Body: { name, email, phone, countryCode, pincode, address?, shopType }
   */
  createAutoShopOwner = async (req, res) => {
    try {
      let { name, email, phone, countryCode, pincode, address, shopType, city } = req.body;

      // Set default country code if not present
      if (!countryCode) {
        countryCode = "+1";
      }

      // ── Required field check ─────────────────────────────────────────────
      if (!name || !email || !phone || !pincode || !shopType || !city) {
        return res.status(400).json({
          success: false,
          message: "Fields name, email, phone, pincode, shopType, and city are required.",
        });
      }

      // ── Country code whitelist ───────────────────────────────────────────
      const allowedCountryCodes = ["+1", "+61", "+44", "+91"];
      if (!allowedCountryCodes.includes(countryCode)) {
        return res.status(400).json({
          success: false,
          message: `Invalid country code. Allowed values: ${allowedCountryCodes.join(", ")}.`,
        });
      }

      // ── ShopType code whitelist ──────────────────────────────────────────
      const allowedShopTypes = ["autoShop", "carWash", "tyreShop", "towTruck"];
      if (
        !Array.isArray(shopType) ||
        shopType.length === 0 ||
        !shopType.every((type) => allowedShopTypes.includes(type))
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid shopType. Must be a non-empty array with only allowed values: ${allowedShopTypes.join(", ")}.`,
        });
      }

      // ── Duplicate email check ────────────────────────────────────────────
      const existingEmail = await User.findOne({
        email: email.trim().toLowerCase(),
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "A user with this email already exists.",
        });
      }

      // ── Duplicate phone + countryCode check ──────────────────────────────
      const existingPhone = await User.findOne({ phone, countryCode });
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message:
            "A user with this phone number and country code already exists.",
        });
      }

      // ── Save ALL details to BusinessProfile schema ───────────────────────
      const businessProfileData = {
        businessName: String(name).trim(),
        businessAddress: address ? String(address).trim().slice(0, 100) : "",
        city: city ? String(city).trim() : "",
        pincode: pincode ? String(pincode).trim() : "",
        businessPhone: String(phone).trim(),
        businessEmail: email ? email.trim().toLowerCase() : "",
        // Optional: Add any other fields from req.body to businessProfileData as needed by schema
        // Other optional/default fields will be handled by the Mongoose schema
      };

      const newBusinessProfile = await BusinessProfileModel.create(businessProfileData);

      // ── Save User with minimal details, point to businessProfile ─────────
      const newOwner = await User.create({
        // name: String(name).trim(),
        email: email.trim().toLowerCase(),
        phone: String(phone).trim(),
        countryCode,
        // pincode: pincode ? String(pincode).trim() : "",
        // address: address ? String(address).trim().slice(0, 100) : "",
        // city: city ? String(city).trim() : "",
        role: "autoshopowner",
        shopType,
        isProfileComplete: false,
        isBusinessProfileCompleted: false,
        otpAttempts: 0,
        status: "active",
        isDisabled: false,
        businessProfile: newBusinessProfile._id,
      });

      // Optionally, link the owner back in BusinessProfile (one-way or two-way)
      // If needed:
      // newBusinessProfile.owner = newOwner._id;
      // await newBusinessProfile.save();

      return res.status(201).json({
        success: true,
        message: "Auto shop owner created successfully.",
        data: {
          _id: newOwner._id,
          name: newOwner.name,
          email: newOwner.email,
          phone: newOwner.phone,
          countryCode: newOwner.countryCode,
          pincode: newOwner.pincode,
          address: newOwner.address,
          city: newOwner.city,
          role: newOwner.role,
          shopType: newOwner.shopType,
          status: newOwner.status,
          isProfileComplete: newOwner.isProfileComplete,
          isBusinessProfileCompleted: newOwner.isBusinessProfileCompleted,
          businessProfile: newBusinessProfile, // return full business profile object
          createdAt: newOwner.createdAt,
        },
      });
    } catch (err) {
      console.error("[createAutoShopOwner] Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to create auto shop owner.",
        error: err.message,
      });
    }
  };

  // ─── UPDATE AUTO SHOP OWNER ─────────────────────────────────────────────────
  /**
   * Update basic profile fields of an existing auto shop owner.
   * PUT /api/admin/autoshopowners/:ownerId
   *
   * Body (all optional, send only what needs changing):
   *   { name, email, phone, countryCode, pincode, address, shopType }
   */
  // updateAutoShopOwner = async (req, res) => {

  //   try {
  //     const { ownerId } = req.params;

  //     if (!ownerId) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "ownerId param is required.",
  //       });
  //     }

  //     // ── Fetch owner ──────────────────────────────────────────────────────
  //     const owner = await User.findOne({ _id: ownerId, role: "autoshopowner" });
  //     if (!owner) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Auto shop owner not found.",
  //       });
  //     }

  //     const updateFields = {};

  //     // ── Scalar fields ────────────────────────────────────────────────────
  //     // Make shopType an array of multiple shopTypes
  //     const plainFields = ["name", "phone", "countryCode", "pincode", "address", "city"];
  //     for (const field of plainFields) {
  //       if (req.body[field] !== undefined && req.body[field] !== null) {
  //         let val = String(req.body[field]).trim();
  //         if (field === "address") {
  //           val = val.slice(0, 100);
  //         }
  //         updateFields[field] = val;
  //       }
  //     }

  //     // Process shopType as array
  //     if (req.body.shopType !== undefined && req.body.shopType !== null) {
  //       let shopTypeArray = req.body.shopType;
  //       if (!Array.isArray(shopTypeArray)) {
  //         // Try to coerce to array if it's not already
  //         if (typeof shopTypeArray === "string") {
  //           // Comma separated, or single value
  //           shopTypeArray = shopTypeArray.split(",").map(s => s.trim()).filter(Boolean);
  //         } else {
  //           shopTypeArray = [String(shopTypeArray).trim()];
  //         }
  //       }
  //       // Filter blanks, trim, dedupe
  //       shopTypeArray = [...new Set(shopTypeArray.map(s => String(s).trim()).filter(Boolean))];
  //       updateFields.shopType = shopTypeArray;
  //     }

  //     // ── Validate countryCode if changed ──────────────────────────────────
  //     if (updateFields.countryCode) {
  //       const allowedCountryCodes = ["+1", "+61", "+44", "+91"];
  //       if (!allowedCountryCodes.includes(updateFields.countryCode)) {
  //         return res.status(400).json({
  //           success: false,
  //           message: `Invalid country code. Allowed: ${allowedCountryCodes.join(", ")}.`,
  //         });
  //       }
  //     }

  //     // ── Validate shopType if changed ─────────────────────────────────────
  //     if (updateFields.shopType) {
  //       const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
  //       const invalidTypes = updateFields.shopType.filter(
  //         (type) => !allowedShopTypes.includes(type)
  //       );
  //       if (invalidTypes.length > 0) {
  //         return res.status(400).json({
  //           success: false,
  //           message: `Invalid shopType(s): ${invalidTypes.join(", ")}. Allowed: ${allowedShopTypes.join(", ")}.`,
  //         });
  //       }
  //     }

  //     // ── Email — check uniqueness if being changed ─────────────────────────
  //     if (
  //       req.body.email !== undefined &&
  //       req.body.email.trim().toLowerCase() !== owner.email
  //     ) {
  //       const newEmail = req.body.email.trim().toLowerCase();
  //       const emailTaken = await User.findOne({
  //         email: newEmail,
  //         _id: { $ne: ownerId },
  //       });
  //       if (emailTaken) {
  //         return res.status(409).json({
  //           success: false,
  //           message: "Another user with this email already exists.",
  //         });
  //       }
  //       updateFields.email = newEmail;
  //     }

  //     if (Object.keys(updateFields).length === 0) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "No valid fields provided to update.",
  //       });
  //     }

  //     const updatedOwner = await User.findByIdAndUpdate(
  //       ownerId,
  //       { $set: updateFields },
  //       { new: true }
  //     ).select(
  //       "name email phone countryCode pincode address city shopType role status " +
  //       "isProfileComplete isBusinessProfileCompleted isDisabled createdAt updatedAt"
  //     );

  //     return res.status(200).json({
  //       success: true,
  //       message: "Auto shop owner updated successfully.",
  //       data: updatedOwner,
  //     });
  //   } catch (err) {
  //     console.error("[updateAutoShopOwner] Error:", err);
  //     return res.status(500).json({
  //       success: false,
  //       message: "Failed to update auto shop owner.",
  //       error: err.message,
  //     });
  //   }
  // };

  // ─── DELETE AUTO SHOP OWNER (SOFT DELETE) ───────────────────────────────────
  
  updateAutoShopOwner = async (req, res) => {
    try {
      const { ownerId } = req.params;

      if (!ownerId) {
        return res.status(400).json({
          success: false,
          message: "ownerId param is required.",
        });
      }

      // ── Fetch owner ──────────────────────────────────────────────────────
      const owner = await User.findOne({ _id: ownerId, role: "autoshopowner" });
      if (!owner) {
        return res.status(404).json({
          success: false,
          message: "Auto shop owner not found.",
        });
      }

      const userUpdateFields = {};
      const businessUpdateFields = {};

      // ── Fields that live on User ────────────────────────────────────────
      // phone and countryCode should NOT be updated anymore as per instruction
      // const userPlainFields = ["phone", "countryCode"];
      // for (const field of userPlainFields) {
      //   if (req.body[field] !== undefined && req.body[field] !== null) {
      //     userUpdateFields[field] = String(req.body[field]).trim();
      //   }
      // }

      // ── Fields that live on BusinessProfile ─────────────────────────────
      // name -> businessName, phone -> businessPhone, email -> businessEmail
      console.log(req.body);
      if (req.body.name !== undefined && req.body.name !== null) {
        businessUpdateFields.businessName = String(req.body.name).trim();
      }
      if (req.body.address !== undefined && req.body.address !== null) {
        businessUpdateFields.businessAddress = String(req.body.address).trim().slice(0, 100);
      }
      if (req.body.city !== undefined && req.body.city !== null) {
        businessUpdateFields.city = String(req.body.city).trim();
      }
      if (req.body.pincode !== undefined && req.body.pincode !== null) {
        businessUpdateFields.pincode = String(req.body.pincode).trim();
      }
      if (req.body.phone !== undefined && req.body.phone !== null) {
        businessUpdateFields.businessPhone = String(req.body.phone).trim();
      }

      console.log(businessUpdateFields);


      // Process shopType as array (stays on User, same as before)
      if (req.body.shopType !== undefined && req.body.shopType !== null) {
        let shopTypeArray = req.body.shopType;
        if (!Array.isArray(shopTypeArray)) {
          if (typeof shopTypeArray === "string") {
            shopTypeArray = shopTypeArray.split(",").map(s => s.trim()).filter(Boolean);
          } else {
            shopTypeArray = [String(shopTypeArray).trim()];
          }
        }
        shopTypeArray = [...new Set(shopTypeArray.map(s => String(s).trim()).filter(Boolean))];
        userUpdateFields.shopType = shopTypeArray;
      }

      // ── NO countryCode validation ───────────────────────────────────────
      // (Do not validate countryCode since we no longer update it)

      // ── Validate shopType if changed ─────────────────────────────────────
      if (userUpdateFields.shopType) {
        const allowedShopTypes = ["autoShop", "tyreShop", "carWash", "towTruck"];
        const invalidTypes = userUpdateFields.shopType.filter(
          (type) => !allowedShopTypes.includes(type)
        );
        if (invalidTypes.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid shopType(s): ${invalidTypes.join(", ")}. Allowed: ${allowedShopTypes.join(", ")}.`,
          });
        }
      }

      // ── Email — check uniqueness if being changed ─────────────────────────
      if (
        req.body.email !== undefined &&
        req.body.email.trim().toLowerCase() !== owner.email
      ) {
        const newEmail = req.body.email.trim().toLowerCase();
        const emailTaken = await User.findOne({
          email: newEmail,
          _id: { $ne: ownerId },
        });
        if (emailTaken) {
          return res.status(409).json({
            success: false,
            message: "Another user with this email already exists.",
          });
        }
        userUpdateFields.email = newEmail;
        businessUpdateFields.businessEmail = newEmail;
      }

      if (
        Object.keys(userUpdateFields).length === 0 &&
        Object.keys(businessUpdateFields).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "No valid fields provided to update.",
        });
      }

      // ── Apply updates ────────────────────────────────────────────────────
      let updatedOwner = owner;
      if (Object.keys(userUpdateFields).length > 0) {
        updatedOwner = await User.findByIdAndUpdate(
          ownerId,
          { $set: userUpdateFields },
          { new: true }
        );
      }

      let updatedBusinessProfile = null;
      if (Object.keys(businessUpdateFields).length > 0 && owner.businessProfile) {
        updatedBusinessProfile = await BusinessProfileModel.findByIdAndUpdate(
          owner.businessProfile,
          { $set: businessUpdateFields },
          { new: true }
        );
      }

      // ── Re-fetch owner with fields + populated business profile ──────────
      const finalOwner = await User.findById(ownerId)
        .select(
          "name email phone countryCode role status shopType " +
          "isProfileComplete isBusinessProfileCompleted isDisabled createdAt updatedAt businessProfile"
        )
        .populate("businessProfile");

      return res.status(200).json({
        success: true,
        message: "Auto shop owner updated successfully.",
        data: finalOwner,
      });
    } catch (err) {
      console.error("[updateAutoShopOwner] Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to update auto shop owner.",
        error: err.message,
      });
    }
  };
  
  /**
   * 
   
   * Soft-delete an auto shop owner.
   * Sets status = "deleted" and isDisabled = true.
   * Also deactivates their linked business profile.
   *
   * DELETE /api/admin/autoshopowners/:ownerId
   */
  deleteAutoShopOwner = async (req, res) => {
    try {
      const { ownerId } = req.params;

      if (!ownerId) {
        return res.status(400).json({
          success: false,
          message: "ownerId param is required.",
        });
      }

      const owner = await User.findOne({ _id: ownerId, role: "autoshopowner" });
      if (!owner) {
        return res.status(404).json({
          success: false,
          message: "Auto shop owner not found.",
        });
      }

      // Idempotent — already deleted
      if (owner.status === "deleted") {
        return res.status(200).json({
          success: true,
          message: "Auto shop owner is already deleted.",
        });
      }

      // ── Soft-delete the user ─────────────────────────────────────────────
      const updated = await User.findByIdAndUpdate(
        ownerId,
        { $set: { status: "deleted", isDisabled: true } },
        { new: true }
      ).select("name email phone status isDisabled");

      // ── Deactivate business profile ──────────────────────────────────────
      if (owner.businessProfile) {
        try {
          await BusinessProfileModel.findByIdAndUpdate(owner.businessProfile, {
            $set: { isBusinessActive: false },
          });
          console.log(
            `[deleteAutoShopOwner] Business profile ${owner.businessProfile} deactivated.`
          );
        } catch (bpErr) {
          // Non-fatal: log and continue
          console.warn(
            "[deleteAutoShopOwner] Could not deactivate business profile:",
            bpErr.message
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Auto shop owner has been soft-deleted.",
        data: updated,
      });
    } catch (err) {
      console.error("[deleteAutoShopOwner] Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to delete auto shop owner.",
        error: err.message,
      });
    }
  };

  // ─── REVIVE AUTO SHOP OWNER ─────────────────────────────────────────────────
  /**
   * Restore a soft-deleted auto shop owner to active.
   * Sets status = "active" and isDisabled = false.
   * Also re-activates their linked business profile.
   *
   * PUT /api/admin/autoshopowners/:ownerId/revive
   */
  reviveAutoShopOwner = async (req, res) => {
    try {
      const { ownerId } = req.params;

      if (!ownerId) {
        return res.status(400).json({
          success: false,
          message: "ownerId param is required.",
        });
      }

      const owner = await User.findOne({ _id: ownerId, role: "autoshopowner" });
      if (!owner) {
        return res.status(404).json({
          success: false,
          message: "Auto shop owner not found.",
        });
      }

      // Idempotent — already active
      if (owner.status === "active" && !owner.isDisabled) {
        return res.status(200).json({
          success: true,
          message: "Auto shop owner is already active.",
        });
      }

      // ── Restore the user ─────────────────────────────────────────────────
      const updated = await User.findByIdAndUpdate(
        ownerId,
        { $set: { status: "active", isDisabled: false } },
        { new: true }
      ).select("name email phone status isDisabled");

      // ── Re-activate business profile ─────────────────────────────────────
      if (owner.businessProfile) {
        try {
          await BusinessProfileModel.findByIdAndUpdate(owner.businessProfile, {
            $set: { isBusinessActive: true },
          });
          console.log(
            `[reviveAutoShopOwner] Business profile ${owner.businessProfile} reactivated.`
          );
        } catch (bpErr) {
          console.warn(
            "[reviveAutoShopOwner] Could not reactivate business profile:",
            bpErr.message
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Auto shop owner has been restored to active.",
        data: updated,
      });
    } catch (err) {
      console.error("[reviveAutoShopOwner] Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to revive auto shop owner.",
        error: err.message,
      });
    }
  };

  async toggleAutoShopOwnerStatus(req, res) {
  let session = null;
  try {
    const { userId, disable } = req.body;
    if (!userId || typeof disable !== 'boolean') {
      return res.status(400).json({ success: false, message: "userId and disable (boolean) are required." });
    }

    // Dynamic import for User and BusinessProfile models
    const { User } = await import('../../Schema/user.schema.js');
    const BusinessProfileModel = (await import('../../Schema/bussiness-profile.js')).default;

    // Start transaction session
    session = await User.startSession();
    session.startTransaction();

    // 1. Find and update User (must be autoshopowner)
    const user = await User.findOne({ _id: userId, role: 'autoshopowner' }).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "AutoShopOwner not found." });
    }

    user.isDisabled = disable;
    await user.save({ session });

    // 2. Update associated BusinessProfile (if any)
    let businessUpdated = null;
    if (user.businessProfile) {
      businessUpdated = await BusinessProfileModel.findByIdAndUpdate(
        user.businessProfile,
        { isBusinessActive: !disable },
        { new: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `AutoShopOwner ${disable ? "disabled" : "enabled"} successfully.`,
      updated: {
        user: {
          _id: user._id,
          isDisabled: user.isDisabled,
        },
        businessProfile: businessUpdated ? {
          _id: businessUpdated._id,
          isBusinessActive: businessUpdated.isBusinessActive
        } : null
      }
    });
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); session.endSession(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: "Error toggling auto shop owner status",
      error: err.message
    });
  }
}


}

export default AutoShopOwnerController;

