import { NextResponse } from "next/server";
import { 
  importSalesData, 
} from "../../src/app/services/shopify/index";

export const handler = async () => {
  try {
    // Run your Shopify/Cin7 import logic
    await importSalesData();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Fetched customers from Cin7 successfully",
      }),
    };

  } catch (error) {
    console.error("Error fetching customers:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error.message,
      }),
    };
  }
};