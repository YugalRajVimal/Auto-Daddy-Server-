import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { buildDefaultPermissions, buildAllTruePermissions } from "../../constants/permissionModules.js";

// Schema/RolesAndPermissions/Staffuser.schema.js
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

export const STAFF_ROLES = ["admin", "role_admin", "sub_admin", "associates"];

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

    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpGeneratedAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },

    role: {
      type: String,
      enum: STAFF_ROLES,
      required: true,
    },

    // NEW: points at the Role doc that actually holds the permission grants.
    // Required for role_admin / sub_admin / associates. Null for "admin"
    // (SuperAdmin bypasses permission checks entirely, no Role needed).
    roleRef: { type: mongoose.Schema.Types.ObjectId, ref: "Role", default: null },

    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },

    // REMOVED: permissions no longer live on the staff user — they live on
    // the referenced Role. Field intentionally deleted (not just unused) so
    // nobody accidentally reads/writes stale per-user permissions again.

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

StaffUserSchema.pre("validate", function (next) {
  if (this.role !== "admin" && !this.roleRef) {
    return next(new Error("roleRef is required for non-SuperAdmin staff users."));
  }
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

// Convenience statics so callers don't hand-build the trees.
StaffUserSchema.statics.defaultPermissions = function () {
  return buildDefaultPermissions();
};

StaffUserSchema.statics.allTruePermissions = function () {
  return buildAllTruePermissions();
};

export const StaffUser =
  mongoose.models.StaffUser || mongoose.model("StaffUser", StaffUserSchema);