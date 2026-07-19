// // middlewares/Auth/permission.middleware.js
// //
// // Replaces the old adminOrSubAdminAuth / requirePermission pair.
// // Works against the single StaffUser collection (role: admin | role_admin |
// // sub_admin | associates) instead of separate Admin/SubAdmin models.

// import jwt from "jsonwebtoken";
// import ExpiredTokenModel from "../Schema/expired-token.schema.js";
// import { StaffUser, STAFF_ROLES } from "../Schema/RolesAndPermissions/Staffuser.schema.js";
// import { isValidNav, isValidSubNav } from "../constants/permissionModules.js";

// /**
//  * staffAuth
//  * Verifies the JWT, loads the StaffUser, and attaches req.user = {
//  *   id, role, name, permissions, isSuperAdmin
//  * }.
//  * Must run before requireNavPermission / requireSuperAdmin.
//  */
// export const staffAuth = async (req, res, next) => {
//   const token = req.headers["authorization"];
//   if (!token) {
//     return res.status(401).json({ success: false, message: "Unauthorized" });
//   }

//   try {
//     const expired = await ExpiredTokenModel.findOne({ token });
//     if (expired && (!expired.tokenExpiry || new Date() > expired.tokenExpiry)) {
//       return res.status(401).json({ success: false, message: "Token expired, please log in again." });
//     }
//   } catch (err) {
//     console.error("[Auth] Error during expired token check:", err);
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }

//   let payload;
//   try {
//     payload = jwt.verify(token, process.env.JWT_SECRET);
//   } catch (err) {
//     return res.status(401).json({ success: false, message: "Unauthorized" });
//   }

//   if (!payload?.id || !STAFF_ROLES.includes(payload.role)) {
//     return res.status(401).json({ success: false, message: "Unauthorized" });
//   }

//   const staff = await StaffUser.findOne({ _id: payload.id, role: payload.role });
//   if (!staff) {
//     return res.status(401).json({ success: false, message: "Account not found" });
//   }
//   if (!staff.isActive) {
//     return res.status(403).json({ success: false, message: "Your account is inactive. Contact the SuperAdmin." });
//   }

//   req.user = {
//     id: String(staff._id),
//     role: staff.role,
//     name: staff.name,
//     // If role is 'admin', user has all permissions, so we can set a marker
//     permissions: staff.role === "admin" ? null : staff.permissions,
//     isSuperAdmin: staff.role === "admin"
//   };

//   next();
// };

// /**
//  * requireNavPermission(navKey, subNavKey, action)
//  *
//  * - navKey alone (subNavKey omitted)      -> checks nav-level "view"
//  * - navKey + subNavKey, action="view"     -> checks sub-nav "view"
//  * - navKey + subNavKey + action           -> checks sub-nav action (create/update/delete)
//  *
//  * If role is 'admin', has all permissions and always passes.
//  * Every other role must have the explicit boolean set to true on its permissions document.
//  *
//  * Usage:
//  *   requireNavPermission("users")                              // nav view
//  *   requireNavPermission("users", "carOwners", "view")         // sub-nav view
//  *   requireNavPermission("users", "carOwners", "create")       // sub-nav create
//  */
// export const requireNavPermission = (navKey, subNavKey = null, action = "view") => {
//   if (!isValidNav(navKey)) {
//     throw new Error(`[Permission] Unknown nav module "${navKey}" — check constants/permissionModules.js`);
//   }
//   if (subNavKey && !isValidSubNav(navKey, subNavKey)) {
//     throw new Error(`[Permission] Unknown sub-nav "${navKey}.${subNavKey}" — check constants/permissionModules.js`);
//   }

//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }

//     // If role is 'admin', has all permissions
//     if (req.user.role === "admin") {
//       return next();
//     }

//     const perms = req.user.permissions;
//     if (!perms) {
//       return res.status(403).json({ success: false, message: "Permission denied" });
//     }

//     const navNode = perms[navKey];
//     if (!navNode) {
//       return res.status(403).json({ success: false, message: "Permission denied" });
//     }

//     // Nav-level check only.
//     if (!subNavKey) {
//       if (navNode.view === true) return next();
//       return res.status(403).json({ success: false, message: "Permission denied" });
//     }

//     // Sub-nav must be reachable AND the nav itself must be visible.
//     const subNode = navNode.subNav?.[subNavKey];
//     if (navNode.view === true && subNode && subNode[action] === true) {
//       return next();
//     }

//     return res.status(403).json({
//       success: false,
//       message: `You don't have permission to ${action} ${navKey}.${subNavKey}.`,
//     });
//   };
// };

// /** requireSuperAdmin — only role: "admin" (SuperAdmin) may pass. */
// export const requireSuperAdmin = (req, res, next) => {
//   if (!req.user || req.user.role !== "admin") {
//     return res.status(403).json({
//       success: false,
//       message: "Only the SuperAdmin can perform this action.",
//     });
//   }
//   return next();
// };

// middlewares/Permission.middleware.js

import jwt from "jsonwebtoken";
import { StaffUser } from "../Schema/RolesAndPermissions/Staffuser.schema.js";
import { canPerform } from "../constants/permissionModules.js";
// import { hasPermission } from "../constants/permissionModules.js";

export async function staffAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    if (!token) return res.status(401).json({ success: false, message: "No token provided." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const staff = await StaffUser.findById(decoded.id);
    if (!staff) return res.status(401).json({ success: false, message: "Invalid token." });
    if (!staff.isActive) return res.status(403).json({ success: false, message: "Account is inactive." });

    req.user = { id: staff._id, role: staff.role, name: staff.name, permissions: staff.permissions };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "SuperAdmin access required." });
  }
  next();
}
// middlewares/Permission.middleware.js — sketch of the needed change
// export function requireNavPermission(navKey, subKey, action) {
//     return async (req, res, next) => {
//       if (req.user.role === "admin") return next(); // SuperAdmin bypass, unchanged
  
//       // req.user.permissions used to come straight off the JWT/staff doc.
//       // Now fetch (or cache) it from the Role the user is currently assigned to,
//       // since a role's permissions can change after the user's token was issued.
//       const staff = await StaffUser.findById(req.user.id).populate("roleRef", "permissions");
//       const perms = staff?.roleRef?.permissions;
//       if (!canAccess(perms, subKey ? `${navKey}.${subKey}` : navKey) /* or per-action check */) {
//         return res.status(403).json({ success: false, message: "Permission denied." });
//       }
//       next();
//     };
//   }

export function requireNavPermission(navKey, subKey, action = "view") {
    return async (req, res, next) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        if (req.user.role === "admin") return next();
  
        const staff = await StaffUser.findById(req.user.id).populate("roleRef", "permissions isActive");
        if (!staff) {
          return res.status(401).json({ success: false, message: "Staff user not found." });
        }
        if (!staff.roleRef || !staff.roleRef.isActive) {
          return res.status(403).json({ success: false, message: "No active role assigned. Contact your SuperAdmin." });
        }
  
        const perms = staff.roleRef.permissions;
        const modulePath = subKey ? `${navKey}.${subKey}` : navKey;
  
        if (!canPerform(perms, modulePath, action)) {
          return res.status(403).json({ success: false, message: "Permission denied." });
        }
  
        next();
      } catch (err) {
        console.error("[requireNavPermission] Error:", err);
        return res.status(500).json({ success: false, message: "Permission check failed." });
      }
    };
  }

