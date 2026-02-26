
import mongoose from "mongoose";

const servicesSchema = new mongoose.Schema({
  name: { type: String, required: true },
  desc: { type: String },
});

export default mongoose.model("Services", servicesSchema);
