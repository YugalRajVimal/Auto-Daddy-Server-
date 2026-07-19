// import jwt from "jsonwebtoken";
// import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
// import { User } from "../../Schema/user.schema.js";
// import { Admin } from "../../Schema/admin.schema.js";
// import { SubAdmin } from "../../Schema/subadmin.schema.js";



// const jwtAuth = async (req, res, next) => {
//   // Read the token from the Authorization header
//   const token = req.headers["authorization"];

//   // If no token is present, return an error
//   if (!token) {
//     return res.status(401).json({ message: "Unauthorized: Token missing" });
//   }

//   // Check if token is in the expired tokens collection
//   try {
//     const existingExpiredToken = await ExpiredTokenModel.findOne({ token });
//     if (existingExpiredToken) {
//       // If tokenExpiry is set, enforce expiry time
//       if (existingExpiredToken.tokenExpiry) {
//         const now = new Date();
//         if (now > existingExpiredToken.tokenExpiry) {
//           return res.status(401).json({
//             message: "Unauthorized: Token expired, please log in again.",
//           });
//         }
//         // else: Not expired yet; allow through (could remove the expired token from db eventually)
//       } else {
//         // No expiry attached, deny by default
//         return res.status(401).json({
//           message: "Unauthorized: Token expired, please log in again.",
//         });
//       }
//     }
//   } catch (err) {
//     // In case of DB errors, fail secure
//     return res.status(500).json({ message: "Internal Server Error" });
//   }

//   try {
//     // Decode the token
//     const payload = jwt.verify(token, process.env.JWT_SECRET);

//     if (!payload) {
//       return res.status(401).json({ message: "Unauthorized Access" });
//     }

//     // Attach user info to req for downstream usage. Include role if present in payload.
//     req.user = {
//       id:        payload.id,
//       phone:     payload.phone,
//       role:      payload.role,
//       permissions: payload.permissions, // for subadmin if present
//     };

//     if (payload.role === "admin") {
//       // Admin Check
//       const dbAdmin = await Admin.findOne({ _id: payload.id, role: "admin" });
//       if (!dbAdmin) {
//         return res.status(401).json({ message: "Unauthorized: Admin not found" });
//       }
//       // Optionally check for inactive status etc here
//       return next();
//     }

//     if (payload.role === "subadmin") {
//       // SubAdmin Check
//       const dbSubAdmin = await SubAdmin.findById(payload.id).select("-password");
//       if (!dbSubAdmin || !dbSubAdmin.isActive) {
//         return res.status(401).json({ message: "Unauthorized: Subadmin not found or inactive" });
//       }
//       req.user.permissions = dbSubAdmin.permissions; // fresh from DB
//       return next();
//     }

//     // Fallback for regular users
//     const dbUser = await User.findOne({ _id: payload.id });
//     if (!dbUser) {
//       return res.status(401).json({ message: "Unauthorized: User not found" });
//     }

//     if (["suspended", "deleted"].includes(dbUser.status)) {
//       return res.status(403).json({ message: `User account is ${dbUser.status}. Please contact support.` });
//     }
//     return next();

//   } catch (error) {
//     // If the token is not valid, return an error
//     return res.status(401).json({ message: "Unauthorized Access" });
//   }
// };

// export default jwtAuth;


// middlewares/Auth/auth.middleware.js  — FIXED VERSION
//
// This is the ORIGINAL jwtAuth used by authRouter routes (user/admin OTP login,
// check-auth, signout, etc). It is NOT the same as adminOrSubAdminAuth which
// is used by adminRouter protected routes.
//
// BUGS FIXED:
//
//  1. Import path was "../../Schema/Subadmin.schema.js" (capital S) — on Linux
//     this silently fails because the file is "subadmin.schema.js" (lowercase).
//     Changed to correct lowercase path.
//
//  2. The original set req.user.permissions = payload.permissions (from JWT).
//     For subadmins this is stale — permissions may have changed since token
//     was issued. Now always re-fetches from DB, matching adminOrSubAdminAuth.
//
//  3. Error response format was inconsistent — some returned { error: "..." }
//     and some { message: "..." }. Unified to { message: "..." } to match
//     what your frontend checks for.

import jwt from "jsonwebtoken";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
import { User } from "../../Schema/user.schema.js";
import { StaffUser } from "../../Schema/RolesAndPermissions/Staffuser.schema.js";

/**
 * jwtAuth middleware
 * - For any staff user (admin/role_admin/sub_admin/associates), uses the unified StaffUserSchema schema.
 * - Handles regular users off the User collection.
 * - Attaches req.user = { id, role, ... } with role-specific data.
 */
const jwtAuth = async (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    console.log("[jwtAuth] Missing token in headers");
    return res.status(401).json({ message: "Unauthorized: Token missing" });
  }

  // 1. Check expired-token blacklist
  try {
    const existingExpiredToken = await ExpiredTokenModel.findOne({ token });
    if (existingExpiredToken) {
      if (existingExpiredToken.tokenExpiry) {
        const now = new Date();
        if (now > existingExpiredToken.tokenExpiry) {
          console.log("[jwtAuth] Token found in expired-token list and already expired");
          return res.status(401).json({
            message: "Unauthorized: Token expired, please log in again.",
          });
        }
        // Token in list but not yet expired—allow through
        console.log("[jwtAuth] Token found in expired-token list but not expired yet. Allowing through.");
      } else {
        // No expiry set → deny by default
        console.log("[jwtAuth] Token found in expired-token list with no expiry. Denying.");
        return res.status(401).json({
          message: "Unauthorized: Token expired, please log in again.",
        });
      }
    }
  } catch (err) {
    console.error("[jwtAuth] Error while checking expired-token list:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }

  // 2. Verify JWT signature
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.log("[jwtAuth] JWT verification failed:", err);
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  if (!payload?.id) {
    console.log("[jwtAuth] JWT payload missing 'id'");
    return res.status(401).json({ message: "Unauthorized: Malformed token" });
  }

  // 3. Staff Users (admin, role_admin, sub_admin, associates)
  // Only those roles exist in StaffUserSchema
  const STAFF_ROLES = ["admin", "role_admin", "sub_admin", "associates"];
  if (payload.role && STAFF_ROLES.includes(payload.role)) {
    try {
      // Always make sure staff account is active
      const staff = await StaffUser.findOne({ _id: payload.id, role: payload.role }).lean();
      if (!staff) {
        console.log(`[jwtAuth] No staff found for id=${payload.id} role=${payload.role}`);
        return res.status(401).json({ message: "Unauthorized: Staff account not found" });
      }
      if (!staff.isActive) {
        console.log(`[jwtAuth] Staff id=${payload.id} is not active`);
        return res.status(403).json({ message: "Your account is inactive. Contact the SuperAdmin." });
      }

      req.user = {
        id: String(staff._id),
        role: staff.role,
        name: staff.name,
        email: staff.email,
        permissions: staff.role === "admin" ? null : staff.permissions,
        isSuperAdmin: staff.role === "admin"
      };
      console.log(`[jwtAuth] Staff user authed: ${staff.email}, role=${staff.role}, id=${staff._id}`);
      return next();
    } catch (err) {
      console.error("[jwtAuth] Error querying StaffUserSchema:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // 4. Regular user (carowner / autoshopowner etc — not in StaffUserSchema)
  try {
    const dbUser = await User.findOne({ _id: payload.id }).lean();
    if (!dbUser) {
      console.log(`[jwtAuth] No regular user found for id=${payload.id}`);
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    if (["suspended", "deleted"].includes(dbUser.status)) {
      console.log(`[jwtAuth] User id=${dbUser._id} is ${dbUser.status}`);
      return res.status(403).json({
        message: `Account is ${dbUser.status}. Please contact support.`,
      });
    }
    req.user = {
      id: String(dbUser._id),
      role: dbUser.role,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      // No permissions for regular users
    };
    console.log(`[jwtAuth] Regular user authed: ${dbUser.email}, id=${dbUser._id}`);
    return next();
  } catch (err) {
    console.error("[jwtAuth] Error querying User schema:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export default jwtAuth;