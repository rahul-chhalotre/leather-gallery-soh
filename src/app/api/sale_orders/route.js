import { NextResponse } from "next/server";
import { connectToDB } from "../../../lib/mongodb";
import SaleOrder from "../../../models/SaleOrder";

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

    // Check existing Sale Orders in DB
    const existingOrders = await SaleOrder.find().lean();
    if (existingOrders.length > 0 && !forceRefresh) {
      return NextResponse.json({
        source: "database",
        totalOrdersFetched: 0,
        totalOrdersInDB: existingOrders.length,
        saleOrders: existingOrders.map((o) => o.Order),
      });
    }

    // Build query parameters
    const params = {
      Search: searchParams.get("Search") || "",
      OrderStatus: searchParams.get("OrderStatus") || "AUTHORISED",
      FulfilmentStatus: searchParams.get("FulfilmentStatus") || "",
      QuoteStatus: searchParams.get("QuoteStatus") || "",
      CombinedPickStatus: searchParams.get("CombinedPickStatus") || "",
      CombinedPackStatus: searchParams.get("CombinedPackStatus") || "",
      CombinedShippingStatus: searchParams.get("CombinedShippingStatus") || "",
      CombinedInvoiceStatus: searchParams.get("CombinedInvoiceStatus") || "",
      CreditNoteStatus: searchParams.get("CreditNoteStatus") || "",
      ReadyForShipping: searchParams.get("ReadyForShipping") || "",
      OrderLocationID: searchParams.get("OrderLocationID") || "",
    };

    const queryString = Object.entries(params)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const fullDetails = [];
    const limit = 100;
    let page = 1;

    while (true) {
      const listUrl = `${DEAR_API_BASE}/saleList?Page=${page}&Limit=${limit}&${queryString}`;
      const listData = await fetchDearApi(listUrl);
      const saleList = listData.SaleList || [];
      if (saleList.length === 0) break;

      const results = await Promise.allSettled(
        saleList.map(order => fetchDearApi(`${DEAR_API_BASE}/sale?ID=${order.SaleID}`))
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          const sale = r.value;
          if (!sale.ID) continue;

          // --- Calculate RemainingOut (for open orders still not shipped) ---
          const totalOrdered = sale.Lines?.reduce((sum, line) => sum + (line.Quantity || 0), 0) || 0;
          const totalShipped = sale.Fulfilments?.reduce((sum, f) => 
            sum + (f.Lines?.reduce((lsum, l) => lsum + (l.QuantityShipped || 0), 0) || 0), 0
          ) || 0;
          const remainingOut = totalOrdered - totalShipped;

          sale.RemainingOut = remainingOut;

          fullDetails.push(sale);

          // Upsert into MongoDB
          await SaleOrder.findOneAndUpdate(
            { SaleID: sale.ID },
            {
              SaleID: sale.ID,
              Customer: sale.Customer,
              OrderStatus: sale.OrderStatus,
              FulfilmentStatus: sale.FulfilmentStatus,
              CombinedInvoiceStatus: sale.CombinedInvoiceStatus,
              ShipBy: sale.ShipBy,
              Location: sale.Location,
              Order: sale,
              RemainingOut: remainingOut,
            },
            { upsert: true, new: true }
          );
        }
      }

      if (saleList.length < limit) break;
      page++;
    }

    const totalOrdersInDB = await SaleOrder.countDocuments();
    return NextResponse.json({
      source: "DEAR",
      totalOrdersFetched: fullDetails.length,
      totalOrdersInDB,
      saleOrders: fullDetails,
    });

  } catch (error) {
    console.error("Error fetching sale orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch sale orders", details: error.message },
      { status: 500 }
    );
  }
}
