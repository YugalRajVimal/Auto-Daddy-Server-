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
      required: false,
    },
    provider: {
      type: String,
      required: false,
    },
    dns: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Domain", DomainSchema);