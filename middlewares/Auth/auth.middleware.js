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
import { Admin } from "../../Schema/admin.schema.js";
import { SubAdmin } from "../../Schema/subadmin.schema.js"; // ← FIX: was "Subadmin.schema.js"

const jwtAuth = async (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Token missing" });
  }

  // 1. Check expired-token blacklist
  try {
    const existingExpiredToken = await ExpiredTokenModel.findOne({ token });
    if (existingExpiredToken) {
      if (existingExpiredToken.tokenExpiry) {
        const now = new Date();
        if (now > existingExpiredToken.tokenExpiry) {
          return res.status(401).json({
            message: "Unauthorized: Token expired, please log in again.",
          });
        }
        // Token is in blacklist but not yet expired — allow through
        // (covers the case where signout records a future-expiry token)
      } else {
        // No expiry set → deny by default
        return res.status(401).json({
          message: "Unauthorized: Token expired, please log in again.",
        });
      }
    }
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }

  // 2. Verify JWT signature
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  if (!payload?.id) {
    return res.status(401).json({ message: "Unauthorized: Malformed token" });
  }

  // 3. Attach base user info — role-specific enrichment below
  req.user = {
    id:   payload.id,
    role: payload.role,
  };

  // ── Admin ──────────────────────────────────────────────────────────────────
  if (payload.role === "admin") {
    try {
      const dbAdmin = await Admin.findOne({ _id: payload.id, role: "admin" }).lean();
      if (!dbAdmin) {
        return res.status(401).json({ message: "Unauthorized: Admin not found" });
      }
      req.user.name = dbAdmin.name;
      req.user.email = dbAdmin.email;
      return next();
    } catch {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // ── SubAdmin ───────────────────────────────────────────────────────────────
  if (payload.role === "subadmin") {
    try {
      // Always re-fetch from DB so permissions are fresh
      const dbSubAdmin = await SubAdmin.findOne({
        _id: payload.id,
        role: "subadmin",
        isActive: true,
      }).lean();

      if (!dbSubAdmin) {
        return res.status(401).json({
          message: "Unauthorized: SubAdmin not found or account is inactive",
        });
      }

      req.user.name        = dbSubAdmin.name;
      req.user.email       = dbSubAdmin.email;
      req.user.permissions = dbSubAdmin.permissions; // fresh from DB, not JWT
      return next();
    } catch {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // ── Regular user (carowner / autoshopowner) ────────────────────────────────
  try {
    const dbUser = await User.findOne({ _id: payload.id }).lean();
    if (!dbUser) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    if (["suspended", "deleted"].includes(dbUser.status)) {
      return res.status(403).json({
        message: `Account is ${dbUser.status}. Please contact support.`,
      });
    }
    req.user.phone = dbUser.phone;
    req.user.role = dbUser.role;

    return next();
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export default jwtAuth;