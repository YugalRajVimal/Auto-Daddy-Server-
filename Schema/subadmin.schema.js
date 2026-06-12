// Schema/subadmin.schema.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const permissionFields = {
  view: { type: Boolean, default: false },
  add: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
};

const modulePermissionSchema = new mongoose.Schema(permissionFields, { _id: false });

const SubAdminSchema = new mongoose.Schema(
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
    role: { type: String, enum: ["subadmin"], default: "subadmin" },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    permissions: {
      dashboard:        { ...modulePermissionSchema.obj },
      users:            { ...modulePermissionSchema.obj },
      services:         { ...modulePermissionSchema.obj },
      categories:       { ...modulePermissionSchema.obj },
      websiteTemplates: { ...modulePermissionSchema.obj },
      dashboardData:    { ...modulePermissionSchema.obj },
      carCompanies:     { ...modulePermissionSchema.obj },
      provinces:        { ...modulePermissionSchema.obj },
      cities:           { ...modulePermissionSchema.obj },
      ads:              { ...modulePermissionSchema.obj },
      runningDeals:     { ...modulePermissionSchema.obj },
      wallet:           { ...modulePermissionSchema.obj },
      inviteHelp:       { ...modulePermissionSchema.obj },
      tasks:            { ...modulePermissionSchema.obj },
    },
  },
  { timestamps: true }
);

// Hash password before save
SubAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

SubAdminSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Never return password in JSON responses
SubAdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// export const SubAdmin = mongoose.model("SubAdmin", SubAdminSchema);
export const SubAdmin =
  mongoose.models.SubAdmin ||
  mongoose.model("SubAdmin", SubAdminSchema);