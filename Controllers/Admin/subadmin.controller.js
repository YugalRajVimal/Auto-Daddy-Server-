// Controllers/Admin/subadmin.controller.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { SubAdminActivity } from "../../Schema/subadmin-activity.schema.js";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
import { Admin } from "../../Schema/admin.schema.js";
import { SubAdmin } from "../../Schema/subadmin.schema.js";

// Helper: log activity
async function logActivity({ performedBy, performedByRole, performedByName, action, module, description, targetSubAdmin, ipAddress, metadata }) {
  try {
    await SubAdminActivity.create({
      performedBy,
      performedByRole,
      performedByName,
      action,
      module,
      description,
      targetSubAdmin,
      ipAddress,
      metadata,
    });
  } catch (e) {
    console.error("[SubAdminActivity] Failed to log:", e.message);
  }
}

function getIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "";
}

class SubAdminController {
  // ─── AUTH: Login (shared endpoint, detects role) ──────────────────────────

  /**
   * POST /api/auth/subadmin/login
   * Body: { email, password }
   * Returns JWT containing { id, role, permissions }
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ success: false, message: "Email and password are required." });

      const subAdmin = await SubAdmin.findOne({ email: email.trim().toLowerCase() });
      if (!subAdmin)
        return res.status(401).json({ success: false, message: "Invalid credentials." });

      if (!subAdmin.isActive)
        return res.status(403).json({ success: false, message: "Your account is inactive. Contact the admin." });

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

      await logActivity({
        performedBy: subAdmin._id,
        performedByRole: "subadmin",
        performedByName: subAdmin.name,
        action: "LOGIN",
        description: "SubAdmin logged in",
        targetSubAdmin: subAdmin._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({
        success: true,
        token,
        user: { id: subAdmin._id, name: subAdmin.name, email: subAdmin.email, role: "subadmin", permissions: subAdmin.permissions },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Login failed", error: err.message });
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  /**
   * POST /api/admin/subadmins
   * Create a new SubAdmin (main admin only)
   */
  async create(req, res) {
    try {
      let { name, email, phone, password, permissions } = req.body;

      if (!name || !email)
        return res.status(400).json({ success: false, message: "name and email are required." });

      // If password not provided, use default
      if (!password) {
        password = "Admin123";
      }

      const exists = await SubAdmin.findOne({ email: email.toLowerCase() });
      if (exists)
        return res.status(409).json({ success: false, message: "A SubAdmin with this email already exists." });

      const subAdmin = new SubAdmin({
        name,
        email: email.toLowerCase(),
        phone: phone || "",
        password,
        createdBy: req.user.id,
        permissions: permissions || {},
      });

      await subAdmin.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name || "Admin",
        action: "CREATE",
        module: "subadmins",
        description: `Created SubAdmin: ${name} (${email})`,
        targetSubAdmin: subAdmin._id,
        ipAddress: getIp(req),
      });

      return res.status(201).json({ success: true, data: subAdmin });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to create SubAdmin", error: err.message });
    }
  }

  /**
   * GET /api/admin/subadmins
   * List all SubAdmins
   */
  async getAll(req, res) {
    try {
      const subAdmins = await SubAdmin.find({})
        .select("-password")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: subAdmins });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch SubAdmins", error: err.message });
    }
  }

  /**
   * GET /api/admin/subadmins/:id
   * Get single SubAdmin
   */
  async getOne(req, res) {
    try {
      const subAdmin = await SubAdmin.findById(req.params.id)
        .select("-password")
        .populate("createdBy", "name email");
      if (!subAdmin)
        return res.status(404).json({ success: false, message: "SubAdmin not found" });
      return res.status(200).json({ success: true, data: subAdmin });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch SubAdmin", error: err.message });
    }
  }

  /**
   * PUT /api/admin/subadmins/:id
   * Update SubAdmin details (name, email, phone)
   */
  async update(req, res) {
    try {
      const { name, email, phone } = req.body;
      const subAdmin = await SubAdmin.findById(req.params.id);
      if (!subAdmin)
        return res.status(404).json({ success: false, message: "SubAdmin not found" });

      if (email && email.toLowerCase() !== subAdmin.email) {
        const dup = await SubAdmin.findOne({ email: email.toLowerCase(), _id: { $ne: subAdmin._id } });
        if (dup) return res.status(409).json({ success: false, message: "Email already in use." });
        subAdmin.email = email.toLowerCase();
      }
      if (name) subAdmin.name = name;
      if (phone !== undefined) subAdmin.phone = phone;

      await subAdmin.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name || "Admin",
        action: "UPDATE",
        module: "subadmins",
        description: `Updated SubAdmin: ${subAdmin.name}`,
        targetSubAdmin: subAdmin._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({ success: true, data: subAdmin });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to update SubAdmin", error: err.message });
    }
  }

  /**
   * PATCH /api/admin/subadmins/:id/permissions
   * Update permissions for a SubAdmin
   */
  async updatePermissions(req, res) {
    try {
      const { permissions } = req.body;
      if (!permissions || typeof permissions !== "object")
        return res.status(400).json({ success: false, message: "permissions object is required." });

      const subAdmin = await SubAdmin.findById(req.params.id);
      if (!subAdmin)
        return res.status(404).json({ success: false, message: "SubAdmin not found" });

      const oldPerms = JSON.stringify(subAdmin.permissions);
      subAdmin.permissions = { ...subAdmin.permissions.toObject?.() || subAdmin.permissions, ...permissions };
      await subAdmin.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name || "Admin",
        action: "PERMISSION_CHANGE",
        module: "subadmins",
        description: `Updated permissions for SubAdmin: ${subAdmin.name}`,
        targetSubAdmin: subAdmin._id,
        ipAddress: getIp(req),
        metadata: { before: JSON.parse(oldPerms), after: subAdmin.permissions },
      });

      return res.status(200).json({ success: true, data: subAdmin });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to update permissions", error: err.message });
    }
  }

  /**
   * PATCH /api/admin/subadmins/:id/status
   * Activate or deactivate a SubAdmin
   */
  async toggleStatus(req, res) {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean")
        return res.status(400).json({ success: false, message: "isActive (boolean) is required." });

      const subAdmin = await SubAdmin.findById(req.params.id);
      if (!subAdmin)
        return res.status(404).json({ success: false, message: "SubAdmin not found" });

      subAdmin.isActive = isActive;
      await subAdmin.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name || "Admin",
        action: "STATUS_CHANGE",
        module: "subadmins",
        description: `${isActive ? "Activated" : "Deactivated"} SubAdmin: ${subAdmin.name}`,
        targetSubAdmin: subAdmin._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({ success: true, data: subAdmin });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to toggle status", error: err.message });
    }
  }

  /**
   * DELETE /api/admin/subadmins/:id
   * Soft delete (set isActive false) or hard delete SubAdmin
   */
  async remove(req, res) {
    try {
      const subAdmin = await SubAdmin.findById(req.params.id);
      if (!subAdmin)
        return res.status(404).json({ success: false, message: "SubAdmin not found" });

      // Soft delete preferred: mark inactive and record
      subAdmin.isActive = false;
      subAdmin.email = subAdmin.email + `__deleted_${Date.now()}`;
      await subAdmin.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name || "Admin",
        action: "DELETE",
        module: "subadmins",
        description: `Deleted SubAdmin: ${subAdmin.name}`,
        targetSubAdmin: subAdmin._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({ success: true, message: "SubAdmin deleted successfully." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to delete SubAdmin", error: err.message });
    }
  }

  /**
   * PATCH /api/admin/subadmins/:id/reset-password
   * Admin resets SubAdmin password
   */
  async resetPassword(req, res) {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ success: false, message: "newPassword must be at least 6 characters." });

      const subAdmin = await SubAdmin.findById(req.params.id);
      if (!subAdmin)
        return res.status(404).json({ success: false, message: "SubAdmin not found" });

      subAdmin.password = newPassword; // pre-save hook hashes it
      await subAdmin.save();

      await logActivity({
        performedBy: req.user.id,
        performedByRole: req.user.role,
        performedByName: req.user.name || "Admin",
        action: "PASSWORD_RESET",
        module: "subadmins",
        description: `Password reset for SubAdmin: ${subAdmin.name}`,
        targetSubAdmin: subAdmin._id,
        ipAddress: getIp(req),
      });

      return res.status(200).json({ success: true, message: "Password reset successfully." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to reset password", error: err.message });
    }
  }

  /**
   * GET /api/admin/subadmins/:id/activity
   * Get activity logs for a specific SubAdmin
   */
  async getActivity(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const logs = await SubAdminActivity.find({ targetSubAdmin: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await SubAdminActivity.countDocuments({ targetSubAdmin: req.params.id });

      return res.status(200).json({ success: true, data: logs, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch activity logs", error: err.message });
    }
  }
}

export default SubAdminController;