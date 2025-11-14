import mongoose from "mongoose";

const DeadLetterQueueSchema = new mongoose.Schema(
  {
    sale_id: {
      type: String,
      required: true,
      index: true,     // Faster lookup
    },
    sku: {
      type: String,
      required: true,
      index: true,
    },
},{ timestamps: true }
);
export default mongoose.models.DeadLetterQueue || mongoose.model("DeadLetterQueue", DeadLetterQueueSchema);