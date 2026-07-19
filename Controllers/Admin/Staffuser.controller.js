// Controllers/Admin/staffUser.controller.js
//
// Handles: staff login (all 4 roles, one endpoint), SuperAdmin onboarding
// of new staff, permission management, activation/deactivation, password
// reset, and activity history.

import jwt from "jsonwebtoken";
import { StaffUser, STAFF_ROLES } from "../../Schema/RolesAndPermissions/Staffuser.schema.js";
import { StaffActivity } from "../../Schema/RolesAndPermissions/Staffactivity.schema.js";
import {
  buildDefaultPermissions,
  isValidNav,
  isValidSubNav,
  BASE_ACTIONS,
} from "../../constants/permissionModules.js";
import { Role, ONBOARDABLE_ROLE_TYPES } from "../../Schema/RolesAndPermissions/Role.schema.js";

const ONBOARDABLE_ROLES = ["role_admin", "sub_admin", "associates"]; // SuperAdmin never re-created via onboarding

function getIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "";
}

async function logActivity(fields) {
  try {
    await StaffActivity.create(fields);
  } catch (e) {
    console.error("[StaffActivity] Failed to log:", e.message);
  }
}

/**
 * Validates an incoming (partial) permissions payload against the known
 * module tree so a bad module/subNav key or a non-boolean action can never
 * reach the database. Returns { valid, error }.
 */
function validatePermissionsPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "permissions must be an object" };
  }
  for (const [navKey, navVal] of Object.entries(payload)) {
    if (!isValidNav(navKey)) {
      return { valid: false, error: `Unknown module "${navKey}"` };
    }
    if (navVal.view !== undefined && typeof navVal.view !== "boolean") {
      return { valid: false, error: `${navKey}.view must be boolean` };
    }
    if (navVal.subNav) {
      for (const [subKey, subVal] of Object.entries(navVal.subNav)) {
        if (!isValidSubNav(navKey, subKey)) {
          return { valid: false, error: `Unknown sub-module "${navKey}.${subKey}"` };
        }
        for (const action of Object.keys(subVal)) {
          if (!BASE_ACTIONS.includes(action)) {
            return { valid: false, error: `Unknown action "${action}" on ${navKey}.${subKey}` };
          }
          if (typeof subVal[action] !== "boolean") {
            return { valid: false, error: `${navKey}.${subKey}.${action} must be boolean` };
          }
        }
      }
    }
  }
  return { valid: true };
}

/** Deep-merges a partial permissions payload into a full permissions object. */
function mergePermissions(base, patch) {
  const merged = JSON.parse(JSON.stringify(base));
  for (const [navKey, navVal] of Object.entries(patch)) {
    if (!merged[navKey]) continue;
    if (navVal.view !== undefined) merged[navKey].view = navVal.view;
    if (navVal.subNav) {
      for (const [subKey, subVal] of Object.entries(navVal.subNav)) {
        if (!merged[navKey].subNav[subKey]) continue;
        Object.assign(merged[navKey].subNav[subKey], subVal);
      }
    }
  }
  return merged;
}

// staffUser.controller.js — only the changed methods shown


// (remove the permission-payload validate/merge helpers — those now live in role.controller.js)

class StaffUserController {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });

      const staff = await StaffUser.findOne({ email: email.trim().toLowerCase() }).populate("roleRef");
      if (!staff) return res.status(401).json({ success: false, message: "Invalid credentials." });
      if (!staff.isActive) return res.status(403).json({ success: false, message: "Your account is inactive. Contact the SuperAdmin." });

      const valid = await staff.comparePassword(password);
      if (!valid) return res.status(401).json({ success: false, message: "Invalid credentials." });

      staff.lastLogin = new Date();
      await staff.save();

      const token = jwt.sign({ id: staff._id, role: staff.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

      await logActivity({
        performedBy: staff._id, performedByRole: staff.role, performedByName: staff.name,
        action: "LOGIN", description: "Staff user logged in", targetStaffUser: staff._id, ipAddress: getIp(req),
      });

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          roleName: staff.roleRef?.name ?? null,
          // SuperAdmin: null (bypasses checks). Everyone else: their role's permissions.
          permissions: staff.role === "admin" ? null : staff.roleRef?.permissions ?? null,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Login failed", error: err.message });
    }
  }

  /** POST /api/admin/staff-users  Body: { name, email, phone, password, roleId } */
  async create(req, res) {
    try {
      const { name, email, phone, password, roleId } = req.body;

      if (!name || !email || !password || !roleId) {
        return res.status(400).json({ success: false, message: "name, email, password, and roleId are required." });
      }

      const roleDoc = await Role.findById(roleId);
      if (!roleDoc || !roleDoc.isActive) {
        return res.status(400).json({ success: false, message: "Selected role was not found or is inactive." });
      }

      const exists = await StaffUser.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(409).json({ success: false, message: "A staff user with this email already exists." });

      const staff = new StaffUser({
        name,
        email: email.toLowerCase(),
        phone: phone || "",
        password,
        role: roleDoc.type,   // role "type" (role_admin/sub_admin/associates) denormalized for auth
        roleRef: roleDoc._id, // source of truth for permissions
        createdBy: req.user.id,
      });
      await staff.save();

      await logActivity({
        performedBy: req.user.id, performedByRole: req.user.role, performedByName: req.user.name,
        action: "CREATE", description: `Onboarded ${roleDoc.type} (role: ${roleDoc.name}): ${name} (${email})`,
        targetStaffUser: staff._id, ipAddress: getIp(req),
      });

      const populated = await staff.populate("roleRef");
      return res.status(201).json({ success: true, data: populated });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to create staff user", error: err.message });
    }
  }

  async getAll(req, res) {
    try {
      const staffUsers = await StaffUser.find({ role: { $ne: "admin" } })
        .populate("createdBy", "name email")
        .populate("roleRef", "name type permissions")
        .sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: staffUsers });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch staff users", error: err.message });
    }
  }

  async getOne(req, res) {
    try {
      const staff = await StaffUser.findById(req.params.id)
        .populate("createdBy", "name email")
        .populate("roleRef", "name type permissions");
      if (!staff) return res.status(404).json({ success: false, message: "Staff user not found" });
      return res.status(200).json({ success: true, data: staff });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch staff user", error: err.message });
    }
  }

  /** PUT /api/admin/staff-users/:id — now also allows reassigning roleId (same type only). */
  async update(req, res) {
    try {
      const { name, email, phone, roleId } = req.body;
      const staff = await StaffUser.findById(req.params.id);
      if (!staff) return res.status(404).json({ success: false, message: "Staff user not found" });
      if (staff.role === "admin") return res.status(403).json({ success: false, message: "SuperAdmin account cannot be modified here." });

      if (email && email.toLowerCase() !== staff.email) {
        const dup = await StaffUser.findOne({ email: email.toLowerCase(), _id: { $ne: staff._id } });
        if (dup) return res.status(409).json({ success: false, message: "Email already in use." });
        staff.email = email.toLowerCase();
      }
      if (name) staff.name = name;
      if (phone !== undefined) staff.phone = phone;

      if (roleId && String(roleId) !== String(staff.roleRef)) {
        const roleDoc = await Role.findById(roleId);
        if (!roleDoc || !roleDoc.isActive) return res.status(400).json({ success: false, message: "Selected role was not found or is inactive." });
        if (roleDoc.type !== staff.role) {
          return res.status(400).json({ success: false, message: `Cannot reassign to a role of type "${roleDoc.type}" — staff role type is fixed at "${staff.role}".` });
        }
        staff.roleRef = roleDoc._id;
      }

      await staff.save();

      await logActivity({
        performedBy: req.user.id, performedByRole: req.user.role, performedByName: req.user.name,
        action: "UPDATE", description: `Updated staff user: ${staff.name}`, targetStaffUser: staff._id, ipAddress: getIp(req),
      });

      const populated = await staff.populate("roleRef", "name type permissions");
      return res.status(200).json({ success: true, data: populated });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to update staff user", error: err.message });
    }
  }




  /** PATCH /api/admin/staff-users/:id/status — activate/deactivate. */
  async toggleStatus(req, res) {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ success: false, message: "isActive (boolean) is required." });
      }

      const staff = await StaffUser.findById(req.params.id);
      if (!staff) return res.status(404).json({ success: false, message: "Staff user not found" });
      if (staff.role === "admin") {
        return res.status(403).json({ success: false, message: "SuperAdmin account cannot be deactivated." });
      }

      staff.isActive = isActive;
      await staff.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name,
        action: "STATUS_CHANGE",
        description: `${isActive ? "Activated" : "Deactivated"}: ${staff.name}`,
        targetStaffUser: staff._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({ success: true, data: staff });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to toggle status", error: err.message });
    }
  }

  /** PATCH /api/admin/staff-users/:id/reset-password */
  async resetPassword(req, res) {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "newPassword must be at least 6 characters." });
      }

      const staff = await StaffUser.findById(req.params.id);
      if (!staff) return res.status(404).json({ success: false, message: "Staff user not found" });
      if (staff.role === "admin") {
        return res.status(403).json({ success: false, message: "Use the SuperAdmin's own account settings to change this password." });
      }

      staff.password = newPassword; // pre-save hook hashes it
      await staff.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name,
        action: "PASSWORD_RESET",
        description: `Password reset for: ${staff.name}`,
        targetStaffUser: staff._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({ success: true, message: "Password reset successfully." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to reset password", error: err.message });
    }
  }

  /** DELETE /api/admin/staff-users/:id — soft delete. */
  async remove(req, res) {
    try {
      const staff = await StaffUser.findById(req.params.id);
      if (!staff) return res.status(404).json({ success: false, message: "Staff user not found" });
      if (staff.role === "admin") {
        return res.status(403).json({ success: false, message: "SuperAdmin account cannot be deleted." });
      }

      staff.isActive = false;
      staff.email = `${staff.email}__deleted_${Date.now()}`;
      await staff.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name,
        action: "DELETE",
        description: `Deleted staff user: ${staff.name}`,
        targetStaffUser: staff._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({ success: true, message: "Staff user deleted successfully." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to delete staff user", error: err.message });
    }
  }

  /** GET /api/admin/staff-users/:id/activity */
  async getActivity(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const logs = await StaffActivity.find({ targetStaffUser: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      const total = await StaffActivity.countDocuments({ targetStaffUser: req.params.id });

      return res.status(200).json({ success: true, data: logs, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch activity logs", error: err.message });
    }
  }

  /** GET /api/admin/permission-modules — returns the canonical tree for building the UI matrix. */
  async getPermissionModules(req, res) {
    const { PERMISSION_TREE } = await import("../../constants/permissionModules.js");
    return res.status(200).json({ success: true, data: PERMISSION_TREE });
  }

  // REMOVE updatePermissions() entirely — permission edits now go through
  // RoleController#updatePermissions (PATCH /api/admin/roles/:id/permissions).

  // toggleStatus / resetPassword / remove / getActivity / getPermissionModules: unchanged.
}

export default StaffUserController;

