// Schema/RolesAndPermissions/Role.schema.js
//
// Holds a NAMED, PERMISSION-GATED role. StaffUsers reference one of these
// via `roleRef`. Multiple roles can share the same `type` (e.g. two
// different "sub_admin" roles with different permission sets) — `type`
// only controls which STAFF_ROLES bucket the role belongs to (used for
// login/auth semantics), the actual grants live in `permissions`.
//
// "admin" (SuperAdmin) never gets a Role document — it bypasses all checks
// and is excluded from ONBOARDABLE_ROLES everywhere.

import mongoose from "mongoose";
import { buildDefaultPermissions } from "../../constants/permissionModules.js";

export const ONBOARDABLE_ROLE_TYPES = ["role_admin", "sub_admin", "associates"];

const PermissionsSchema = new mongoose.Schema({}, { _id: false, strict: false });

// Role.schema.js
const RoleSchema = new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      type: { type: String, enum: ONBOARDABLE_ROLE_TYPES, required: true },
      permissions: { type: mongoose.Schema.Types.Mixed, default: () => buildDefaultPermissions() }, // was PermissionsSchema
      isActive: { type: Boolean, default: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser", default: null },
    },
    { timestamps: true }
  );
// Prevent deleting/deactivating a role that still has staff assigned —
// enforced in the controller (needs a live query against StaffUser), not
// here, to avoid a circular schema import.

export const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);