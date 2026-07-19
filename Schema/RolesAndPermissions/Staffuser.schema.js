// Schema/staffUser.schema.js
//
// Replaces the old separate Admin / SubAdmin models with ONE unified
// collection. All non-portal staff (SuperAdmin, Admin, SubAdmin, Business
// Associate) live here, distinguished only by `role`.
//
// role values map 1:1 to the spec:
//   "admin"       -> SuperAdmin  (unrestricted, bypasses all permission checks)
//   "role_admin"  -> Admin       (permission-gated)
//   "sub_admin"   -> SubAdmin    (permission-gated)
//   "associates"  -> Business Associate (permission-gated)
//
// Roles are fixed/hardcoded — this is an enum, not a dynamically-managed
// "Role" collection. Only ONE document should ever exist with role "admin"
// in normal operation (enforced at the controller level, not the schema,
// since Mongoose doesn't support "at most one" constraints natively).

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { buildDefaultPermissions } from "../../constants/permissionModules.js";

export const STAFF_ROLES = ["admin", "role_admin", "sub_admin", "associates"];

// Mongoose-friendly nested schema mirroring buildDefaultPermissions() shape.
// Stored as Mixed rather than a fully-typed nested schema so new nav/sub-nav
// keys can be added in constants/permissionModules.js without a migration —
// the application layer (not Mongoose) validates shape against the tree.
const PermissionsSchema = new mongoose.Schema({}, { _id: false, strict: false });

const StaffUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, default: "" },
    password: { type: String, required: true },

    // OTP and verification fields for staff user
    otp: { type: String, default: null }, // Store current OTP (e.g., for login/verify flows)
    otpExpiresAt: { type: Date, default: null },
    otpGeneratedAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },

    role: {
      type: String,
      enum: STAFF_ROLES,
      required: true,
    },

    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },

    // Ignored/bypassed entirely for role: "admin" (SuperAdmin sees everything).
    // Populated with buildDefaultPermissions() shape for the other 3 roles.
    permissions: { type: PermissionsSchema, default: () => ({}) },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffUser",
      default: null, // null for the seed SuperAdmin; set for everyone onboarded after
    },
  },
  { timestamps: true }
);

StaffUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

StaffUserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

StaffUserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

/** True only for the SuperAdmin role — used for the "unrestricted bypass" rule. */
StaffUserSchema.methods.isSuperAdmin = function () {
  return this.role === "admin";
};

// Convenience static so callers don't hand-build the default tree.
StaffUserSchema.statics.defaultPermissions = function () {
  return buildDefaultPermissions();
};

export const StaffUser =
  mongoose.models.StaffUser || mongoose.model("StaffUser", StaffUserSchema);