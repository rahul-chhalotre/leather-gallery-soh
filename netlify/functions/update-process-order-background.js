import { connectToDB } from "../../src/lib/mongodb.js";
import SyncOrder from "../../src/models/syncOrder.js";
import { processOrders } from "../../src/app/services/shopify/index.js";

export const handler = async () => {
  try {
    console.log("🚀 Processing orders (Netlify Function)...");

    // Connect DB
    await connectToDB();

    // Fetch only ESTIMATING orders
    const estimatingSales = await SyncOrder.find({ Status: "ESTIMATING" });
    const sale_ids = estimatingSales.map((sale) => sale.ID);
     
    if (sale_ids.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: "No orders with status 'ESTIMATING' found.",
        }),
      };
    }
    
    // Process each order
    for (let sale of sale_ids) {
        if(sale === "648c8db2-6f25-4285-9ee0-bcce65f98e28"){
         console.log(sale);
        await processOrders(sale);
        }
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
