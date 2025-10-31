import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    ID: String,
    RequiredBy: Date,
    Location: String,
    OrderStatus: String,
    RestockReceivedStatus: String,
    CombinedInvoiceStatus: String,
    CombinedReceivingStatus: String,
    Order: Object,
  },
  { timestamps: true }
);

export default mongoose.models.PurchaseOrder || mongoose.model("PurchaseOrder", purchaseOrderSchema);
