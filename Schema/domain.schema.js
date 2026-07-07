import mongoose from "mongoose";

const DomainSchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ["carowner", "autoshopowner"],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userType",
    },
    domain: {
      type: String,
      required: true,
    },
    domainType: {
      type: String,
      enum: ["existing", "new"],
      required: true,
    },
    expiry: {
      type: Date,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    dns: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Domain", DomainSchema);