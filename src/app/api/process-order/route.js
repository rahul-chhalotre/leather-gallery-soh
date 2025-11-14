import { NextResponse } from "next/server";
import { processOrders } from "../../services/shopify/index.js";
export async function POST(req) {
  try {
    const body = await req.json();
    const { sale_ids } = body;
    if (!Array.isArray(sale_ids)) {
      return NextResponse.json(
        { success: false, message: "Please provide an array of sale_ids" },
        { status: 400 }
      );
    }
    await processOrders(sale_ids);
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