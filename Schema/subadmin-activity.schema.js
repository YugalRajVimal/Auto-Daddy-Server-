// Schema/subadmin-activity.schema.js
import mongoose from "mongoose";

const SubAdminActivitySchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Could be SubAdmin or Admin
    },
    performedByRole: {
      type: String,
      enum: ["admin", "subadmin"],
      required: true,
    },
    performedByName: { type: String },
    action: {
      type: String,
      enum: [
        "LOGIN",
        "LOGOUT",
        "CREATE",
        "UPDATE",
        "DELETE",
        "PERMISSION_CHANGE",
        "STATUS_CHANGE",
        "PASSWORD_RESET",
      ],
      required: true,
    },
    module: { type: String },
    description: { type: String },
    targetSubAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubAdmin",
    },
    ipAddress: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SubAdminActivity = mongoose.model(
  "SubAdminActivity",
  SubAdminActivitySchema
);