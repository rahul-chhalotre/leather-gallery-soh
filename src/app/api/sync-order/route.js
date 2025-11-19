import { NextResponse } from "next/server";
import { 
  importSalesData, 
} from "../../services/shopify/index.js";

export async function GET() {
  try {
    
    await importSalesData();
    return NextResponse.json({
      success: true,
      message: "Fetched customers from Cin7 successfully",
   
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}