
import jwt from "jsonwebtoken";
import { User } from "../../Schema/user.schema.js";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
// import { Admin } from "../../Schema/admin.schema.js";
import { SubAdminActivity } from "../../Schema/subadmin-activity.schema.js";
import { SubAdmin } from "../../Schema/subadmin.schema.js";
import { StaffUser, STAFF_ROLES } from "../../Schema/RolesAndPermissions/Staffuser.schema.js";

import { Role } from "../../Schema/RolesAndPermissions/Role.schema.js";
import { buildAllTruePermissions } from "../../constants/permissionModules.js";
// Allowed roles from user.schema.js (see enum in file_context_2 line 8)
const ALLOWED_ROLES = ["patient", "therapist", "admin", "carowner", "autoshopowner"];

class AuthController {

  // ... [user-flows, unchanged] ...

  signupAndLogin = async (req, res) => {
    // [Unchanged logic]
    try {
      let { countryCode, phone, email } = req.body;
      // ... as before ...
      // ... no changes needed in user portions ...
      // ... 
      let user = await User.findOne({ countryCode, phone }).select("_id otp otpExpiresAt otpGeneratedAt otpAttempts");
      if (!user) {
        return res.status(404).json({ message: "User with this phone does not exist." });
      }
      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
      const otpGeneratedAt = new Date();

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            otp: otp,
            otpExpiresAt: otpExpiresAt,
            otpGeneratedAt: otpGeneratedAt,
            otpAttempts: 0
          }
        }
      );
      return res.status(200).json({
        message: "OTP sent successfully for login",
        userId: user._id,
      });
    } catch (error) {
      console.error("Signup/Login Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  completeProfile = async (req, res) => {
    // [Unchanged logic]
    try {
      const { id } = req.user || {};
      const { name, email, pincode, role, address } = req.body;
      if (!name || !email || !pincode || !role || !address) {
        return res.status(400).json({
          message: "All fields (name, email, pincode, role, address) are required."
        });
      }
      const validRoles = ["carowner", "autoshopowner"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: "Invalid role provided. Allowed roles: carowner/autoshopowner"
        });
      }
      if (!id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      if (user.isProfileComplete) {
        return res.status(400).json({ message: "Profile already completed." });
      }
      const emailExists = await User.findOne({
        email: email,
        _id: { $ne: id }
      });
      if (emailExists) {
        return res.status(409).json({
          message: "Email is already in use by another account.",
          existingUserId: emailExists._id
        });
      }
      const profileUpdates = {
        name,
        email,
        pincode,
        role,
        address,
        isProfileComplete: true
      };
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $set: profileUpdates },
        { new: true }
      ).lean();

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update profile." });
      }
      return res.status(200).json({
        message: "Profile completed successfully.",
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          pincode: updatedUser.pincode,
          role: updatedUser.role,
          address: updatedUser.address,
          isProfileComplete: updatedUser.isProfileComplete,
        }
      });
    } catch (error) {
      console.error("[completeProfile] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  signUpLogInAndCompleteProfileAutoShopOwner = async (req, res) => {
    // [Unchanged logic same as before]
    try {
      let { countryCode, phone, email, name, pincode, address } = req.body;
      if (!countryCode || !phone || !email || !name || !pincode || !address) {
        return res.status(400).json({
          message: "All fields (countryCode, phone, email, name, pincode, address) are required."
        });
      }
      const role = "autoshopowner";
      countryCode = countryCode.trim();
      phone = phone.trim();
      email = email.trim().toLowerCase();
      name = name.trim();
      pincode = pincode.toString().trim();
      address = typeof address === "string" ? address.trim() : address;

      if (!/^\+?\d{1,4}$/.test(countryCode)) {
        return res.status(400).json({ message: "Invalid country code." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }
      if (!name) {
        return res.status(400).json({ message: "Name is required." });
      }
      if (!email || !/^[\w\-.]+@[\w\-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ message: "A valid email is required." });
      }
      if (!pincode) {
        return res.status(400).json({ message: "Pincode is required." });
      }
      if (!address) {
        return res.status(400).json({ message: "Address is required." });
      }

      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const otpGeneratedAt = new Date();

      let user = await User.findOne({ countryCode, phone });

      if (user) {
        if (user.role !== role) {
          return res.status(409).json({
            message: "User exists but is not an autoshopowner.",
            userId: user._id
          });
        }
        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.otpGeneratedAt = otpGeneratedAt;
        user.otpAttempts = 0;
        if (!user.isProfileComplete) {
          user.name = name;
          user.email = email;
          user.pincode = pincode;
          user.address = address;
          user.role = role;
        }
        await user.save();

        return res.status(200).json({
          message: user.isProfileComplete
            ? "OTP sent successfully for login"
            : "OTP sent and profile details updated.",
          userId: user._id
        });
      }

      const existingEmailUser = await User.findOne({ email: email });
      if (existingEmailUser) {
        return res.status(409).json({
          message: "User with this email already exists.",
          userId: existingEmailUser._id
        });
      }
      const existingPhoneUser = await User.findOne({ countryCode, phone });
      if (existingPhoneUser) {
        return res.status(409).json({
          message: "User with this phone already exists.",
          userId: existingPhoneUser._id
        });
      }

      user = await User.create({
        countryCode,
        phone,
        email,
        name,
        pincode,
        address,
        role,
        otp,
        otpExpiresAt,
        otpGeneratedAt,
        otpAttempts: 0,
        phoneVerified: false,
        emailVerified: false,
        isProfileComplete: true
      });

      return res.status(201).json({
        message: "Sign-up, OTP sent, and profile completed successfully",
        userId: user._id
      });

    } catch (error) {
      console.error("[signUpLogInAndCompleteProfile/autoshopowner] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  verifyAccount = async (req, res) => {
    // [Unchanged logic]
    try {
      let { countryCode, phone, otp, deviceId, fcmToken } = req.body;
      // ... [kept as before]
      countryCode = countryCode.trim();
      phone = phone.trim();

      if (!/^\+\d{1,4}$/.test(countryCode)) {
        return res.status(400).json({ message: "Invalid country code." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }

      let user = await User.findOne(
        { countryCode, phone },
        "_id otp otpExpiresAt otpGeneratedAt otpAttempts phoneVerified lastLogin role name profilePhoto isProfileComplete isAutoShopBusinessProfileComplete businessProfile fcmToken"
      );

      if (!user) {
        return res.status(401).json({ message: "Invalid phone or country code" });
      }
      if (!user.otp || !user.otpExpiresAt) {
        return res.status(401).json({ message: "OTP not sent, please request again." });
      }
      if (user.otp !== otp) {
        return res.status(401).json({ message: "Invalid OTP" });
      }
      if (user.otpExpiresAt < new Date()) {
        return res.status(401).json({ message: "OTP has expired. Please request a new OTP." });
      }
      const updateObj = {
        otp: null,
        otpExpiresAt: null,
        otpGeneratedAt: null,
        otpAttempts: 0,
        phoneVerified: true,
        lastLogin: new Date()
      };
      if (deviceId) updateObj.deviceId = deviceId;
      if (typeof fcmToken === "string" && fcmToken.trim().length > 0)
        updateObj.fcmToken = fcmToken.trim();
      await User.updateOne({ _id: user._id }, { $set: updateObj });

      const tokenPayload = { id: user._id, role: user.role };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);

      await ExpiredTokenModel.create({
        token,
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      let profilePhoto = user.profilePhoto || null;
      if (user.role === "autoshopowner" && user.businessProfile) {
        const businessProfileData = await User.findById(user._id)
          .select("businessProfile")
          .populate({ path: "businessProfile", select: "businessLogo" });

        if (businessProfileData && businessProfileData.businessProfile && businessProfileData.businessProfile.businessLogo) {
          profilePhoto = businessProfileData.businessProfile.businessLogo;
        }
      }

      return res.status(200).json({
        message: "Account verified successfully",
        token,
        isProfileComplete: user.isProfileComplete,
        isAutoShopBusinessProfileComplete: user.isAutoShopBusinessProfileComplete,
        role: user.role,
        name: user.name || null,
        profilePhoto: profilePhoto,
        fcmToken: (typeof fcmToken === "string" && fcmToken.trim().length > 0) ? fcmToken.trim() : user.fcmToken || null
      });

    } catch (error) {
      console.error("[verifyAccount] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  checkAuth = async (req, res) => {
    // [Unchanged logic]
    try {
      const { id } = req.user || {};
      const dbUser = await User.findOne({ _id: id });
      if (!dbUser) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }
      if (dbUser.status === "suspended") {
        return res.status(403).json({ message: "Your account has been suspended. Please contact support." });
      }
      if (dbUser.status === "deleted") {
        return res.status(403).json({ message: "Your account has been deleted. Please contact support." });
      }
      if (dbUser.isProfileComplete === false) {
        return res.status(428).json({
          message: "Your profile is incomplete. Please complete your profile to continue.",
          phone: dbUser.phone
        });
      }
      if (dbUser.role === "autoshopowner" && !dbUser.isAutoShopBusinessProfileComplete) {
        return res.status(428).json({
          message: "Your auto shop business profile is incomplete. Please complete your business profile to continue.",
          phone: dbUser.phone
        });
      }
      return res.status(200).json({ message: "Verified" });
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  };

  // --- STAFF USER REPLACEMENT CODE ---
  // All admin/subadmin routes use StaffUser, not Admin/SubAdmin schemas.

  // /**
  //  * Admin/Staff: Check Auth (admin dashboard)
  //  * req.user injected by permission middleware: { id, role }
  //  * Allows: Superadmin (`admin`) and all staff roles
  //  */
  // adminCheckAuth = async (req, res) => {
  //   try {
  //     const { id, role } = req.user || {};
  //     // Only allow staff-user roles
  //     if (!id || (typeof role !== "string") || !STAFF_ROLES.includes(role)) {
  //       return res.status(401).json({ message: "Unauthorized: Staff only" });
  //     }

  //     // Find staff user by ID and role
  //     const staffUser = await StaffUser.findOne({ _id: id, role })
  //       .select("-password");

  //     if (!staffUser) {
  //       return res.status(401).json({ message: "Staff user not found" });
  //     }

  //     // Compose base staff data for frontend, include role
  //     const result = {
  //       message: "Staff authorized",
  //       name: staffUser.name,
  //       email: staffUser.email,
  //       role: staffUser.role, // explicitly send role
  //     };

  //     // If superadmin ("admin" role), send all permissions true
  //     if (staffUser.role === "admin" || staffUser.isSuperAdmin?.()) {
  //       // Use the app's default permission tree but set every permission action to true
  //       const defaultPerms = StaffUser.defaultPermissions
  //         ? StaffUser.defaultPermissions()
  //         : {}; // fallback for older codebases

  //       function makeTrueTree(node) {
  //         if (Array.isArray(node)) {
  //           return node.map(makeTrueTree);
  //         }
  //         if (node && typeof node === "object") {
  //           const copy = { ...node };
  //           if ("view" in copy) copy.view = true;
  //           if ("create" in copy) copy.create = true;
  //           if ("update" in copy) copy.update = true;
  //           if ("delete" in copy) copy.delete = true;
  //           if (copy.subNav && typeof copy.subNav === "object") {
  //             copy.subNav = Object.fromEntries(
  //               Object.entries(copy.subNav).map(([key, val]) => [key, makeTrueTree(val)])
  //             );
  //           }
  //           return copy;
  //         }
  //         return node;
  //       }

  //       result.permissions = makeTrueTree(defaultPerms);
  //     } else if (typeof staffUser.permissions === "object" && !staffUser.isSuperAdmin?.()) {
  //       // Provide their real permissions
  //       result.permissions = staffUser.permissions;
  //     }
  //     // Always send the role field explicitly in the response
  //     result.role = staffUser.role;

  //     return res.status(200).json(result);
  //   } catch (error) {
  //     console.error("[adminCheckAuth] Error encountered:", error);
  //     return res.status(401).json({ message: "Unauthorized" });
  //   }
  // };



  
  adminCheckAuth = async (req, res) => {
    try {
      const { id, role } = req.user || {};
      if (!id || (typeof role !== "string") || !STAFF_ROLES.includes(role)) {
        return res.status(401).json({ message: "Unauthorized: Staff only" });
      }
  
      const staffUser = await StaffUser.findOne({ _id: id, role })
        .select("-password")
        .populate({ path: "roleRef", model: Role, select: "name type permissions isActive" });
  
      if (!staffUser) {
        return res.status(401).json({ message: "Staff user not found" });
      }
  
      const result = {
        message: "Staff authorized",
        name: staffUser.name,
        email: staffUser.email,
        role: staffUser.role, // keep as-is: "admin" | "role_admin" | "sub_admin" | "associates"
      };
  
      if (staffUser.role === "admin" || staffUser.isSuperAdmin?.()) {
        result.permissions = buildAllTruePermissions();
        result.roleName = "Super Admin"; // display name only — role stays "admin"
      } else if (staffUser.roleRef && staffUser.roleRef.isActive) {
        result.permissions = staffUser.roleRef.permissions;
        result.roleName = staffUser.roleRef.name; // e.g. "Sub Admin", "Regional Sub Admin"
      } else {
        console.warn(
          `[adminCheckAuth] StaffUser ${staffUser._id} has no active roleRef — denying all permissions.`
        );
        result.permissions = StaffUser.defaultPermissions();
        result.roleName = null;
      }
  
      return res.status(200).json(result);
    } catch (error) {
      console.error("[adminCheckAuth] Error encountered:", error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  };

  /**
   * Admin/Staff: Sign in (Send OTP/email login link)
   * Only allows "admin", "role_admin", "sub_admin", or "associates"
   * Used for login screen.
   */
  adminSignin = async (req, res) => {
    try {
      let { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }
      email = email.trim().toLowerCase();
      role = role.trim();

      if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({ message: `Role must be one of: ${STAFF_ROLES.join(", ")}` });
      }

      const staffUser = await StaffUser.findOne({ email }).lean();
      if (!staffUser) {
        return res.status(404).json({ message: "Staff user not found" });
      }

      // Set constant OTP for now
      const otp = "000000";
      await StaffUser.findByIdAndUpdate(
        staffUser._id,
        {
          otp,
          otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          otpGeneratedAt: new Date(),
          otpAttempts: 0
        },
        { new: true }
      );
      // Optionally: send OTP using email
      return res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("AdminSignin Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  /**
 * Admin/Staff: Verify OTP & Generate Token (POST /api/auth/admin/verify)
 */
// adminVerifyAccount = async (req, res) => {
//   try {
//     let { email, otp, role } = req.body;
//     if (!email || !otp || !role) {
//       console.log("Missing fields in adminVerifyAccount:", { email, otp, role });
//       return res.status(400).json({ message: "Email, OTP, and Role are required" });
//     }
//     email = email.trim().toLowerCase();
//     role = role.trim();

//     if (!STAFF_ROLES.includes(role)) {
//       console.log("Invalid user role in adminVerifyAccount:", role);
//       return res.status(400).json({ message: "Invalid user role." });
//     }

//     // Find staffUser by email, role and OTP
//     const staffUser = await StaffUser.findOneAndUpdate(
//       { email, otp },
//       { $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1, otpGeneratedAt: 1 }, lastLogin: new Date() },
//       { new: true }
//     ).populate("roleRef", "name type permissions isActive");

//     if (!staffUser) {
//       console.log("Invalid credentials or OTP in adminVerifyAccount for:", { email, role });
//       return res.status(401).json({ message: "Invalid credentials or OTP" });
//     }

//     // Prepare permission logic for admin role:
//     let returnedPermissions;
//     let roleName = null;

//     if (staffUser.role === "admin") {
//       // Use the application's buildDefaultPermissions and set all actions to true recursively.
//       const defaultPerms = StaffUser.defaultPermissions
//         ? StaffUser.defaultPermissions()
//         : {};

//       function makeTrueTree(obj) {
//         if (Array.isArray(obj)) {
//           return obj.map(makeTrueTree);
//         }
//         if (obj && typeof obj === "object") {
//           if (
//             Object.prototype.hasOwnProperty.call(obj, "view") &&
//             Object.prototype.hasOwnProperty.call(obj, "create") &&
//             Object.prototype.hasOwnProperty.call(obj, "update") &&
//             Object.prototype.hasOwnProperty.call(obj, "delete")
//           ) {
//             return { view: true, create: true, update: true, delete: true };
//           }
//           const copy = {};
//           for (const k of Object.keys(obj)) copy[k] = makeTrueTree(obj[k]);
//           return copy;
//         }
//         return obj;
//       }

//       returnedPermissions = makeTrueTree(defaultPerms);
//     } else {
//       // Non-superadmin: permissions live on the linked Role now.
//       if (staffUser.roleRef && staffUser.roleRef.isActive) {
//         returnedPermissions = staffUser.roleRef.permissions || {};
//         roleName = staffUser.roleRef.name;
//       } else {
//         console.warn(
//           `[adminVerifyAccount] StaffUser ${staffUser._id} has no active roleRef — denying all permissions.`
//         );
//         returnedPermissions = StaffUser.defaultPermissions ? StaffUser.defaultPermissions() : {};
//       }
//     }

//     const tokenPayload = {
//       id: staffUser._id,
//       email: staffUser.email,
//       role: staffUser.role,
//     };
//     // Only attach real permissions in token if NOT super admin (like checkAuth does)
//     if (staffUser.role !== "admin" && returnedPermissions) {
//       tokenPayload.permissions = returnedPermissions;
//     }
//     const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

//     // NOTE: do not log tokens into ExpiredTokenModel at creation, only mark as expired on signout.

//     return res
//       .status(200)
//       .json({
//         message: "Account verified successfully",
//         token,
//         permissions: returnedPermissions,
//         role: staffUser.role, // send role explicitly
//         roleName, // NEW: name of the assigned Role (null for SuperAdmin)
//       });
//   } catch (error) {
//     console.error("AdminVerifyAccount Error:", error);
//     return res.status(500).json({ message: "Internal Server Error" });
//   }
// };



adminVerifyAccount = async (req, res) => {
  try {
    let { email, otp, role } = req.body;
    if (!email || !otp || !role) {
      return res.status(400).json({ message: "Email, OTP, and Role are required" });
    }
    email = email.trim().toLowerCase();
    role = role.trim();

    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid user role." });
    }

    const staffUser = await StaffUser.findOneAndUpdate(
      { email, otp },
      { $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1, otpGeneratedAt: 1 }, lastLogin: new Date() },
      { new: true }
    ).populate({ path: "roleRef", model: Role, select: "name type permissions isActive" });

    if (!staffUser) {
      return res.status(401).json({ message: "Invalid credentials or OTP" });
    }

    let returnedPermissions;
    let roleName = null;

    if (staffUser.role === "admin") {
      returnedPermissions = buildAllTruePermissions();
      roleName = "Super Admin";
    } else if (staffUser.roleRef && staffUser.roleRef.isActive) {
      console.log(staffUser);
      returnedPermissions = staffUser.roleRef.permissions || {};
      roleName = staffUser.roleRef.name;
    } else {
      console.warn(
        `[adminVerifyAccount] StaffUser ${staffUser._id} has no active roleRef — denying all permissions.`
      );
      returnedPermissions = StaffUser.defaultPermissions();
    }

    const tokenPayload = {
      id: staffUser._id,
      email: staffUser.email,
      role: staffUser.role,
    };
    if (staffUser.role !== "admin" && returnedPermissions) {
      tokenPayload.permissions = returnedPermissions;
    }
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

    return res.status(200).json({
      message: "Account verified successfully",
      token,
      permissions: returnedPermissions,
      role: staffUser.role,   // "admin" | "role_admin" | "sub_admin" | "associates" — single key, no dupe
      roleName,                // display name, e.g. "Sub Admin" / "Super Admin" / null if unassigned
    });
  } catch (error) {
    console.error("AdminVerifyAccount Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

  // /**
  //  * Admin/Staff: Verify OTP & Generate Token (POST /api/auth/admin/verify)
  //  */
  // adminVerifyAccount = async (req, res) => {
  //   try {
  //     let { email, otp, role } = req.body;
  //     if (!email || !otp || !role) {
  //       console.log("Missing fields in adminVerifyAccount:", { email, otp, role });
  //       return res.status(400).json({ message: "Email, OTP, and Role are required" });
  //     }
  //     email = email.trim().toLowerCase();
  //     role = role.trim();

  //     if (!STAFF_ROLES.includes(role)) {
  //       console.log("Invalid user role in adminVerifyAccount:", role);
  //       return res.status(400).json({ message: "Invalid user role." });
  //     }

  //     // Find staffUser by email, role and OTP
  //     const staffUser = await StaffUser.findOneAndUpdate(
  //       { email, otp },
  //       { $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1, otpGeneratedAt: 1 }, lastLogin: new Date() },
  //       { new: true }
  //     ).lean();

  //     if (!staffUser) {
  //       console.log("Invalid credentials or OTP in adminVerifyAccount for:", { email, role });
  //       return res.status(401).json({ message: "Invalid credentials or OTP" });
  //     }

  //     // Prepare permission logic for admin role:
  //     let returnedPermissions;
  //     if (staffUser.role === "admin") {
  //       // Use the application's buildDefaultPermissions and set all actions to true recursively.
  //       const defaultPerms = StaffUser.defaultPermissions
  //         ? StaffUser.defaultPermissions()
  //         : {};

  //       function makeTrueTree(obj) {
  //         if (Array.isArray(obj)) {
  //           return obj.map(makeTrueTree);
  //         }
  //         if (obj && typeof obj === "object") {
  //           if (
  //             Object.prototype.hasOwnProperty.call(obj, "view") &&
  //             Object.prototype.hasOwnProperty.call(obj, "create") &&
  //             Object.prototype.hasOwnProperty.call(obj, "update") &&
  //             Object.prototype.hasOwnProperty.call(obj, "delete")
  //           ) {
  //             return { view: true, create: true, update: true, delete: true };
  //           }
  //           const copy = {};
  //           for (const k of Object.keys(obj)) copy[k] = makeTrueTree(obj[k]);
  //           return copy;
  //         }
  //         return obj;
  //       }

  //       returnedPermissions = makeTrueTree(defaultPerms);
  //     } else {
  //       returnedPermissions = staffUser.permissions || {};
  //     }

  //     const tokenPayload = {
  //       id: staffUser._id,
  //       email: staffUser.email,
  //       role: staffUser.role
  //     };
  //     // Only attach real permissions in token if NOT super admin (like checkAuth does)
  //     if (staffUser.role !== "admin" && returnedPermissions) {
  //       tokenPayload.permissions = returnedPermissions;
  //     }
  //     const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

  //     // NOTE: do not log tokens into ExpiredTokenModel at creation, only mark as expired on signout.

  //     return res
  //       .status(200)
  //       .json({ 
  //         message: "Account verified successfully", 
  //         token, 
  //         permissions: returnedPermissions, 
  //         role: staffUser.role // send role explicitly
  //       });
  //   } catch (error) {
  //     console.error("AdminVerifyAccount Error:", error);
  //     return res.status(500).json({ message: "Internal Server Error" });
  //   }
  // };

  // ---[ The rest (subAdminLogin, subAdminCheckAuth, loginAs) stays as legacy, requires upgrade to staffUser eventually. ]---

  subAdminLogin = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ success: false, message: "Email and password are required." });

      const subAdmin = await SubAdmin.findOne({ email: email.trim().toLowerCase() });
      if (!subAdmin)
        return res.status(401).json({ success: false, message: "Invalid credentials." });

      if (!subAdmin.isActive)
        return res.status(403).json({ success: false, message: "Account inactive. Contact the admin." });

      const valid = await subAdmin.comparePassword(password);
      if (!valid)
        return res.status(401).json({ success: false, message: "Invalid credentials." });

      subAdmin.lastLogin = new Date();
      await subAdmin.save();

      const token = jwt.sign(
        { id: subAdmin._id, role: "subadmin", permissions: subAdmin.permissions },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Log activity
      try {
        await SubAdminActivity.create({
          performedBy: subAdmin._id,
          performedByRole: "subadmin",
          performedByName: subAdmin.name,
          action: "LOGIN",
          description: "SubAdmin logged in",
          targetSubAdmin: subAdmin._id,
          ipAddress: req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "",
        });
      } catch { /* non-fatal */ }

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: subAdmin._id,
          name: subAdmin.name,
          email: subAdmin.email,
          role: "subadmin",
          permissions: subAdmin.permissions,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Login failed", error: err.message });
    }
  }

  subAdminCheckAuth = async (req, res) => {
    try {
      const subAdmin = await SubAdmin.findById(req.user.id).select("-password");
      if (!subAdmin || !subAdmin.isActive)
        return res.status(401).json({ success: false, message: "Unauthorized" });

      return res.status(200).json({
        success: true,
        name: subAdmin.name,
        email: subAdmin.email,
        permissions: subAdmin.permissions,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  loginAs = async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        console.log("Access denied: Not admin or no req.user:", req.user);
        return res.status(403).json({ success: false, message: "Forbidden: Only superadmin can login as another user." });
      }
      const { userId } = req.body;
      if (!userId) {
        console.log("loginAs - Missing userId in body:", req.body);
        return res.status(400).json({ success: false, message: "userId is required." });
      }
      const user = await User.findOne({
        _id: userId,
        role: { $in: ["carowner", "autoshopowner"] },
      }).select("-password");
      if (!user) {
        console.log(`loginAs - User not found or not allowed: userId=${userId}`);
        return res.status(404).json({ success: false, message: "User not found or not eligible for loginAs." });
      }
      if (["suspended", "deleted"].includes(user.status)) {
        console.log(`loginAs - User ${user._id} is ${user.status}; denied impersonation`);
        return res.status(403).json({
          success: false,
          message: `Cannot login as a ${user.status} user.`,
        });
      }
      const tokenPayload = {
        id: user._id,
        role: user.role,
        impersonatedBy: req.user.id,
        isImpersonation: true,
      };
      console.log(`loginAs - Creating impersonation token for user ${user._id} by ${req.user.id}`);
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );
      console.log(token);

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (err) {
      console.log("loginAs - Exception:", err);
      return res.status(500).json({ success: false, message: "loginAs failed", error: err.message });
    }
  };

}

export default AuthController;
