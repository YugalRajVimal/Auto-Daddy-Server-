// models/counter.model.js
import mongoose from "mongoose";


const ALLOWED_NAMES = ["jobNo","invoiceNo"];

const counterSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(value) {
        return ALLOWED_NAMES.includes(value);
      },
      message: props => `${props.value} is not a valid counter name. Allowed names are: ${ALLOWED_NAMES.join(", ")}`
    }
  },
  seq: { type: Number, default: 0 }
});

export default mongoose.model("Counter", counterSchema);
