import { connectToDB } from "../../src/lib/mongodb.js";
import SyncOrder from "../../src/models/syncOrder.js";
import { processOrders } from "../../src/app/services/shopify/index.js";

export const handler = async () => {
  try {
    console.log("Processing orders (Netlify Function)...");

    // Connect to the database
    await connectToDB();

    // Fetch orders that are NOT processed yet
    const estimatingSales = await SyncOrder.find({
      Status: { $in: ["ESTIMATING", "PENDING"] }
    });

    if (estimatingSales.length === 0) {
      console.log("No unprocessed orders found.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: "No unprocessed orders found.",
        }),
      };
    }

    // Loop through each sale
    for (let sale of estimatingSales) {
      const saleId = sale.ID;

      console.log(`Processing sale: ${saleId}`);

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

      console.log(`Sale ${saleId} marked as PROCESSED`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Processed orders successfully",
      }),
    };

  } catch (error) {
    console.error("Error processing orders:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error.message,
      }),
    };
  }
};
