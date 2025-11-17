import { NextResponse } from "next/server";
import { processOrders } from "../../services/shopify/index.js";
import { connectToDB } from "@/lib/mongodb.js";

import SyncOrder from "../../../models/syncOrder.js";
export async function POST(req) {
  try {
    await connectToDB();
    const estimatingSales = await SyncOrder.find({ Status: "ESTIMATING" });
    const sale_ids = estimatingSales.map((sale) => sale.ID);
     if (sale_ids.length === 0 ) {
      return NextResponse.json(
        {
          success: false,
          message: "No orders with status 'ESTIMATING' found.",
        },
        { status: 400 }
      );
    }
    for(let sale of sale_ids){
      await processOrders(sale);
    }
    return NextResponse.json(
      { success: true, message: "Processed orders successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing orders:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}