// middlewares/Auth/permission.middleware.js
import jwt from "jsonwebtoken";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
import { Admin } from "../../Schema/admin.schema.js";
import { SubAdmin } from "../../Schema/subadmin.schema.js";

/**
 * Unified auth middleware that handles both Admin and SubAdmin tokens.
 * Attaches req.user = { id, role, permissions? }
 */
export const adminOrSubAdminAuth = async (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    console.log("[Auth] No token present in headers");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check expired token list
  try {
    const expired = await ExpiredTokenModel.findOne({ token });
    if (expired) {
      console.log("[Auth] Token is found in expired token list:", token);
      if (!expired.tokenExpiry || new Date() > expired.tokenExpiry) {
        console.log("[Auth] Expired token used. tokenExpiry:", expired.tokenExpiry);
        return res.status(401).json({ message: "Token expired, please log in again." });
      }
    }
  } catch (err) {
    console.error("[Auth] Error during expired token check:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload) {
      console.log("[Auth] JWT did not yield a payload");
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("[Auth] JWT payload decoded:", payload);

    if (payload.role === "admin") {
      const admin = await Admin.findOne({ _id: payload.id, role: "admin" });
      if (!admin) {
        console.log(`[Auth] Admin not found for id: ${payload.id}`);
        return res.status(401).json({ error: "Admin not found" });
      }
      req.user = { id: payload.id, role: "admin", permissions: null };
      console.log("[Auth] Admin access granted for:", req.user);
      return next();
    }

    if (payload.role === "subadmin") {
      const subAdmin = await SubAdmin.findOne({ _id: payload.id, role: "subadmin", isActive: true });
      if (!subAdmin) {
        console.log(`[Auth] SubAdmin not found or inactive for id: ${payload.id}`);
        return res.status(401).json({ error: "SubAdmin not found or inactive" });
      }
      req.user = {
        id: payload.id,
        role: "subadmin",
        permissions: subAdmin.permissions,
        name: subAdmin.name,
      };
      console.log("[Auth] SubAdmin access granted for:", req.user);
      return next();
    }

    console.log("[Auth] Unknown role in payload:", payload.role);
    return res.status(401).json({ error: "Unknown role" });
  } catch (err) {
    console.error("[Auth] JWT verification failed:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

/**
 * requirePermission(module, action)
 * Usage: requirePermission("services", "view")
 * Must be used AFTER adminOrSubAdminAuth middleware.
 * Main admin passes always. SubAdmin must have explicit permission.
 */
export const requirePermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log(`[Permission] No req.user. Blocked access to ${module}:${action}`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Main admin always has access
    if (req.user.role === "admin") {
      console.log(`[Permission] Admin bypass for module:${module}, action:${action}`);
      return next();
    }

    // SubAdmin — check permissions
    const perms = req.user.permissions;
    if (!perms || !perms[module] || !perms[module][action]) {
      console.log(`[Permission] SubAdmin (${req.user.id}) denied for ${module}:${action}. Permissions:`, perms);
      return res.status(403).json({
        error: "Forbidden",
        message: `You don't have permission to ${action} ${module}.`,
      });
    }
    console.log(`[Permission] SubAdmin (${req.user.id}) allowed for ${module}:${action}`);
    return next();
  };
};

/**
 * requireAdmin — only main admin can access this route
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    console.log("[RequireAdmin] Access forbidden. User:", req.user);
    return res.status(403).json({
      error: "Forbidden",
      message: "Only the main admin can perform this action.",
    });
  }
  console.log("[RequireAdmin] Admin access granted for:", req.user);
  return next();
};