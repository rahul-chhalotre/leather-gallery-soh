import mongoose from "mongoose";

const ProcessOrderSchema = new mongoose.Schema(
  {
    saleID: { type: String, required: true },
    customerID: { type: String, required: true },
    draftOrderID: { type: String, required: true },
    invoiceURL: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.ProcessOrder ||
  mongoose.model("ProcessOrder", ProcessOrderSchema);
