import { NextResponse } from "next/server";
import { connectToDB } from "../../../lib/mongodb";
import PurchaseOrder from "../../../models/PurchaseOrder";

const DEAR_API_BASE = "https://inventory.dearsystems.com/ExternalApi/v2";
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;

async function fetchDearApi(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "api-auth-accountid": ACCOUNT_ID,
      "api-auth-applicationkey": APP_KEY,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DEAR API request failed: ${res.status} ${res.statusText} - ${text}`);
  }

  return res.json();
}

export async function GET(request) {
  try {
    await connectToDB();

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true"; 

    // Check existing data in DB
    const existingOrders = await PurchaseOrder.find().lean();
    if (existingOrders.length > 0 && !forceRefresh) {
      return NextResponse.json({
        source: "database",
        totalOrdersFetched: 0,
        totalOrdersInDB: existingOrders.length,
        purchaseOrders: existingOrders.map((o) => o.Order),
      });
    }

    // Build query parameters
    const params = {
      Search: searchParams.get("Search") || "",
      OrderStatus: searchParams.get("OrderStatus") || "AUTHORISED",
      RestockReceivedStatus: searchParams.get("RestockReceivedStatus") || "",
      InvoiceStatus: searchParams.get("InvoiceStatus") || "",
      CreditNoteStatus: searchParams.get("CreditNoteStatus") || "",
      UnstockStatus: searchParams.get("UnstockStatus") || "",
      Status: searchParams.get("Status") || "",
      DropShipTaskID: searchParams.get("DropShipTaskID") || "",
    };

    const queryString = Object.entries(params)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const fullDetails = [];
    const limit = 100;
    let page = 1;

    while (true) {
      const listUrl = `${DEAR_API_BASE}/purchaseList?Page=${page}&Limit=${limit}&${queryString}`;
      const listData = await fetchDearApi(listUrl);
      const purchaseList = listData.PurchaseList || [];
      if (purchaseList.length === 0) break;

      const results = await Promise.allSettled(
        purchaseList.map(order => fetchDearApi(`${DEAR_API_BASE}/advanced-purchase?ID=${order.ID}`))
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          const order = r.value;
          if (!order.ID) continue;

          // --- Calculate RemainingIn for Open To Sell ---
          const totalOrdered = order.Lines?.reduce((sum, line) => sum + (line.QuantityOrdered || 0), 0) || 0;
          const totalReceived = order.Lines?.reduce((sum, line) => sum + (line.QuantityReceived || 0), 0) || 0;
          const remainingIn = totalOrdered - totalReceived;

          order.RemainingIn = remainingIn; // Attach to order object

          fullDetails.push(order);

          // Save to DB
          await PurchaseOrder.findOneAndUpdate(
            { ID: order.ID },
            {
              ID: order.ID,
              Supplier: order.Supplier,
              OrderStatus: order.OrderStatus,
              CombinedReceivingStatus: order.CombinedReceivingStatus,
              CombinedInvoiceStatus: order.CombinedInvoiceStatus,
              Order: order,
              RemainingIn: remainingIn,
            },
            { upsert: true, new: true }
          );
        }
      }

      if (purchaseList.length < limit) break;
      page++;
    }

    const totalOrdersInDB = await PurchaseOrder.countDocuments();
    return NextResponse.json({
      source: "DEAR",
      totalOrdersFetched: fullDetails.length,
      totalOrdersInDB,
      purchaseOrders: fullDetails,
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders", details: error.message },
      { status: 500 }
    );
  }
}
