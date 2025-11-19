import { NextResponse } from "next/server";
import { connectToDB } from "../../../lib/mongodb";
import { processOrders } from "@/app/services/shopify/index";
import SyncOrder from "../../../models/syncOrder.js";

export async function POST() {
  try {
    console.log("🚀 Processing orders (Next.js API)...");

    // Connect DB
    await connectToDB();

    // Fetch orders that are NOT processed yet
    const estimatingSales = await SyncOrder.find({
      Status: { $in: ["ESTIMATING", "PENDING"] }
    });

    if (estimatingSales.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No unprocessed orders found.",
        },
        { status: 200 }
      );
    }

    // Loop through each sale
    for (let sale of estimatingSales) {
      const saleId = sale.ID;

      console.log(`🔄 Processing sale: ${saleId}`);

      // Double protection — skip already processed
      if (sale.Status === "PROCESSED") {
        console.log(`⏭ Skipping sale ${saleId} (already processed)`);
        continue;
      }

      // Run Shopify/Dear processing workflow
      await processOrders(saleId);

      // Update SyncOrder status to PROCESSED after success
      await SyncOrder.updateOne(
        { ID: saleId },
        { $set: { Status: "PROCESSED", processedAt: new Date() } }
      );

      console.log(`✅ Sale ${saleId} marked as PROCESSED`);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Processed orders successfully",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ Error processing orders:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    );
  }
}
