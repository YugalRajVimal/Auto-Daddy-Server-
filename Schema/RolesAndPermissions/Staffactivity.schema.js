// Schema/staffActivity.schema.js
// Generalized replacement for subadmin-activity.schema.js — logs actions
// taken BY any StaffUser and, where relevant, actions taken ON a target
// StaffUser (e.g. permission changes, onboarding, deactivation).

import mongoose from "mongoose";

const StaffActivitySchema = new mongoose.Schema(
  {
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser", required: true },
    performedByRole: { type: String, required: true },
    performedByName: { type: String, default: "" },

    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "CREATE",
        "UPDATE",
        "PERMISSION_CHANGE",
        "STATUS_CHANGE",
        "PASSWORD_RESET",
        "DELETE",
      ],
    },
    module: { type: String, default: "staffUsers" },
    description: { type: String, default: "" },

    targetStaffUser: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser", default: null },
    ipAddress: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export const StaffActivity =
  mongoose.models.StaffActivity || mongoose.model("StaffActivity", StaffActivitySchema);