import { NextResponse } from "next/server";

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
    throw new Error(
      `DEAR API request failed: ${res.status} ${res.statusText} - ${text}`
    );
  }

  return res.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      Search: searchParams.get("Search") || "",
      OrderStatus: searchParams.get("OrderStatus") || "",
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
      .filter(([_, value]) => value !== "")
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    const fullDetails = [];
    const limit = 100; // DEAR's max per page
    let page = 1;

    while (true) {
      const listUrl = `${DEAR_API_BASE}/saleList?Page=${page}&Limit=${limit}&${queryString}`;
      const listData = await fetchDearApi(listUrl);
      const saleList = listData.SaleList || [];

      if (saleList.length === 0) break;

      const results = await Promise.allSettled(
        saleList.map((order) =>
          fetchDearApi(`${DEAR_API_BASE}/sale?ID=${order.SaleID}`)
        )
      );

      results.forEach((r) => {
        if (r.status === "fulfilled") fullDetails.push(r.value);
      });

      if (saleList.length < limit) break;
      page++;
    }

    return NextResponse.json({
      totalOrders: fullDetails.length,
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