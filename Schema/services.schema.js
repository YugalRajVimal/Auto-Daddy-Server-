
import mongoose from "mongoose";

const subServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  desc: { type: String }
});

const servicesSchema = new mongoose.Schema({
  name: { type: String, required: true },
  desc: { type: String },
  services: [subServiceSchema]
});

export default mongoose.model("Services", servicesSchema);
