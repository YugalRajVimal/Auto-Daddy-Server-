// // Controllers/Admin/role.controller.js
// import { Role, ONBOARDABLE_ROLE_TYPES } from "../../Schema/RolesAndPermissions/Role.schema.js";
// import { StaffUser } from "../../Schema/RolesAndPermissions/Staffuser.schema.js";
// import { buildDefaultPermissions, isValidNav, isValidSubNav, BASE_ACTIONS } from "../../constants/permissionModules.js";

// function validatePermissionsPayload(payload) {
//   if (!payload || typeof payload !== "object") return { valid: false, error: "permissions must be an object" };
//   for (const [navKey, navVal] of Object.entries(payload)) {
//     if (!isValidNav(navKey)) return { valid: false, error: `Unknown module "${navKey}"` };
//     if (navVal.view !== undefined && typeof navVal.view !== "boolean") return { valid: false, error: `${navKey}.view must be boolean` };
//     if (navVal.subNav) {
//       for (const [subKey, subVal] of Object.entries(navVal.subNav)) {
//         if (!isValidSubNav(navKey, subKey)) return { valid: false, error: `Unknown sub-module "${navKey}.${subKey}"` };
//         for (const action of Object.keys(subVal)) {
//           if (!BASE_ACTIONS.includes(action)) return { valid: false, error: `Unknown action "${action}" on ${navKey}.${subKey}` };
//           if (typeof subVal[action] !== "boolean") return { valid: false, error: `${navKey}.${subKey}.${action} must be boolean` };
//         }
//       }
//     }
//   }
//   return { valid: true };
// }

// function mergePermissions(base, patch) {
//   const merged = JSON.parse(JSON.stringify(base));
//   for (const [navKey, navVal] of Object.entries(patch)) {
//     if (!merged[navKey]) continue;
//     if (navVal.view !== undefined) merged[navKey].view = navVal.view;
//     if (navVal.subNav) {
//       for (const [subKey, subVal] of Object.entries(navVal.subNav)) {
//         if (!merged[navKey].subNav[subKey]) continue;
//         Object.assign(merged[navKey].subNav[subKey], subVal);
//       }
//     }
//   }
//   return merged;
// }

// class RoleController {
//   /** POST /api/admin/roles  Body: { name, type, permissions? } */
//   async create(req, res) {
//     try {
//       const { name, type, permissions } = req.body;
//       if (!name || !type) return res.status(400).json({ success: false, message: "name and type are required." });
//       if (!ONBOARDABLE_ROLE_TYPES.includes(type)) {
//         return res.status(400).json({ success: false, message: `type must be one of: ${ONBOARDABLE_ROLE_TYPES.join(", ")}` });
//       }

//       let finalPermissions = buildDefaultPermissions();
//       if (permissions) {
//         const { valid, error } = validatePermissionsPayload(permissions);
//         if (!valid) return res.status(400).json({ success: false, message: error });
//         finalPermissions = mergePermissions(finalPermissions, permissions);
//       }

//       const role = await Role.create({ name, type, permissions: finalPermissions, createdBy: req.user.id });
//       return res.status(201).json({ success: true, data: role });
//     } catch (err) {
//       return res.status(500).json({ success: false, message: "Failed to create role", error: err.message });
//     }
//   }

//   /** GET /api/admin/roles?type=sub_admin (type optional) */
//   async getAll(req, res) {
//     try {
//       const filter = { isActive: true };
//       if (req.query.type) filter.type = req.query.type;
//       const roles = await Role.find(filter).sort({ createdAt: -1 });
//       return res.status(200).json({ success: true, data: roles });
//     } catch (err) {
//       return res.status(500).json({ success: false, message: "Failed to fetch roles", error: err.message });
//     }
//   }

//   async getOne(req, res) {
//     try {
//       const role = await Role.findById(req.params.id);
//       if (!role) return res.status(404).json({ success: false, message: "Role not found" });
//       return res.status(200).json({ success: true, data: role });
//     } catch (err) {
//       return res.status(500).json({ success: false, message: "Failed to fetch role", error: err.message });
//     }
//   }

//   /** PUT /api/admin/roles/:id — rename only; type is fixed after creation (staff already reference it). */
//   async update(req, res) {
//     try {
//       const { name } = req.body;
//       const role = await Role.findById(req.params.id);
//       if (!role) return res.status(404).json({ success: false, message: "Role not found" });
//       if (name) role.name = name;
//       await role.save();
//       return res.status(200).json({ success: true, data: role });
//     } catch (err) {
//       return res.status(500).json({ success: false, message: "Failed to update role", error: err.message });
//     }
//   }

//   /** PATCH /api/admin/roles/:id/permissions  Body: { permissions } — deep-merge, affects every assigned staff user. */
//   async updatePermissions(req, res) {
//     try {
//       const { permissions } = req.body;
//       const { valid, error } = validatePermissionsPayload(permissions);
//       if (!valid) return res.status(400).json({ success: false, message: error });

//       const role = await Role.findById(req.params.id);
//       if (!role) return res.status(404).json({ success: false, message: "Role not found" });

//       role.permissions = mergePermissions(role.permissions?.toObject?.() ?? role.permissions, permissions);
//       role.markModified("permissions");
//       await role.save();

//       return res.status(200).json({ success: true, data: role });
//     } catch (err) {
//       return res.status(500).json({ success: false, message: "Failed to update role permissions", error: err.message });
//     }
//   }

//   /** DELETE /api/admin/roles/:id — soft delete, blocked if staff are still assigned. */
//   async remove(req, res) {
//     try {
//       const inUse = await StaffUser.countDocuments({ roleRef: req.params.id, isActive: true });
//       if (inUse > 0) {
//         return res.status(409).json({ success: false, message: `${inUse} staff user(s) are still assigned to this role. Reassign them first.` });
//       }
//       const role = await Role.findById(req.params.id);
//       if (!role) return res.status(404).json({ success: false, message: "Role not found" });
//       role.isActive = false;
//       await role.save();
//       return res.status(200).json({ success: true, message: "Role deleted." });
//     } catch (err) {
//       return res.status(500).json({ success: false, message: "Failed to delete role", error: err.message });
//     }
//   }
// }

// export default RoleController;

import { Role, ONBOARDABLE_ROLE_TYPES } from "../../Schema/RolesAndPermissions/Role.schema.js";
import { StaffUser } from "../../Schema/RolesAndPermissions/Staffuser.schema.js";
import {
  buildDefaultPermissions,
  isValidNav,
  isValidSubNav,
  BASE_ACTIONS,
  normalizePermissions,
} from "../../constants/permissionModules.js";

function validatePermissionsPayload(payload) {
  if (!payload || typeof payload !== "object") return { valid: false, error: "permissions must be an object" };
  for (const [navKey, navVal] of Object.entries(payload)) {
    if (!isValidNav(navKey)) return { valid: false, error: `Unknown module "${navKey}"` };
    if (navVal.view !== undefined && typeof navVal.view !== "boolean") return { valid: false, error: `${navKey}.view must be boolean` };
    if (navVal.subNav) {
      for (const [subKey, subVal] of Object.entries(navVal.subNav)) {
        if (!isValidSubNav(navKey, subKey)) return { valid: false, error: `Unknown sub-module "${navKey}.${subKey}"` };
        for (const action of Object.keys(subVal)) {
          if (!BASE_ACTIONS.includes(action)) return { valid: false, error: `Unknown action "${action}" on ${navKey}.${subKey}` };
          if (typeof subVal[action] !== "boolean") return { valid: false, error: `${navKey}.${subKey}.${action} must be boolean` };
        }
      }
    }
  }
  return { valid: true };
}

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
  // Auto-correct nav.view based on subNav state — always the source of truth.
  return normalizePermissions(merged);
}

class RoleController {
  /** POST /api/admin/roles  Body: { name, type, permissions? } */
  async create(req, res) {
    try {
      const { name, type, permissions } = req.body;
      if (!name || !type) return res.status(400).json({ success: false, message: "name and type are required." });
      if (!ONBOARDABLE_ROLE_TYPES.includes(type)) {
        return res.status(400).json({ success: false, message: `type must be one of: ${ONBOARDABLE_ROLE_TYPES.join(", ")}` });
      }

      let finalPermissions = buildDefaultPermissions();
      if (permissions) {
        const { valid, error } = validatePermissionsPayload(permissions);
        if (!valid) return res.status(400).json({ success: false, message: error });
        finalPermissions = mergePermissions(finalPermissions, permissions);
      }

      const role = await Role.create({ name, type, permissions: finalPermissions, createdBy: req.user.id });
      return res.status(201).json({ success: true, data: role });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to create role", error: err.message });
    }
  }

  /** GET /api/admin/roles?type=sub_admin (type optional) */
  async getAll(req, res) {
    try {
      const filter = { isActive: true };
      if (req.query.type) filter.type = req.query.type;
      const roles = await Role.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: roles });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch roles", error: err.message });
    }
  }

  async getOne(req, res) {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: "Role not found" });
      return res.status(200).json({ success: true, data: role });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch role", error: err.message });
    }
  }

  /** PUT /api/admin/roles/:id — rename only; type is fixed after creation (staff already reference it). */
  async update(req, res) {
    try {
      const { name } = req.body;
      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: "Role not found" });
      if (name) role.name = name;
      await role.save();
      return res.status(200).json({ success: true, data: role });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to update role", error: err.message });
    }
  }

  /** PATCH /api/admin/roles/:id/permissions  Body: { permissions } — deep-merge, affects every assigned staff user. */
  async updatePermissions(req, res) {
    try {
      const { permissions } = req.body;
      const { valid, error } = validatePermissionsPayload(permissions);
      if (!valid) return res.status(400).json({ success: false, message: error });

      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: "Role not found" });

      role.permissions = mergePermissions(role.permissions?.toObject?.() ?? role.permissions, permissions);
      role.markModified("permissions");
      await role.save();

      return res.status(200).json({ success: true, data: role });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to update role permissions", error: err.message });
    }
  }

  /** DELETE /api/admin/roles/:id — soft delete, blocked if staff are still assigned. */
  async remove(req, res) {
    try {
      const inUse = await StaffUser.countDocuments({ roleRef: req.params.id, isActive: true });
      if (inUse > 0) {
        return res.status(409).json({ success: false, message: `${inUse} staff user(s) are still assigned to this role. Reassign them first.` });
      }
      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: "Role not found" });
      role.isActive = false;
      await role.save();
      return res.status(200).json({ success: true, message: "Role deleted." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Failed to delete role", error: err.message });
    }
  }
}

export default RoleController;