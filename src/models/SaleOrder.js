import mongoose from "mongoose";

const saleOrderSchema = new mongoose.Schema(
  {
    SaleID: { type: String, required: true, unique: true },
    ShipBy: Date,
    Location: String,
    OrderStatus: String,
    FulfilmentStatus: String,
    Order: Object, 
  },
  { timestamps: true }
);

export default mongoose.models.SaleOrder || mongoose.model("SaleOrder", saleOrderSchema);
