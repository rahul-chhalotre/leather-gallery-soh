import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import SaleOrder from "@/models/SaleOrder";

const DEAR_API_BASE = "https://inventory.dearsystems.com/ExternalApi/v2";
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;

async function fetchDearApi(url) {
  const res = await fetch(url, {
    headers: {
      "api-auth-accountid": ACCOUNT_ID,
      "api-auth-applicationkey": APP_KEY,
    },
  });
  if (!res.ok) throw new Error(`DEAR API failed: ${res.statusText}`);
  return res.json();
}

export async function GET() {
  await connectToDB();

  const cached = await SaleOrder.find({}).sort({ updatedAt: -1 }).limit(1000);
  if (cached.length > 0) {
    
    return NextResponse.json({ saleOrders: cached });
  }

  console.log("Fetching from DEAR...");
  const data = await fetchDearApi(`${DEAR_API_BASE}/saleList?Limit=200`);
  const saleList = data.SaleList || [];

  const fullDetails = [];
  for (const sale of saleList) {
    const detail = await fetchDearApi(`${DEAR_API_BASE}/sale?ID=${sale.SaleID}`);
    fullDetails.push(detail);
  }

  await SaleOrder.insertMany(fullDetails);

  console.log(` Saved ${fullDetails.length} sale orders to MongoDB`);
  return NextResponse.json({ saleOrders: fullDetails });
}
