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

    const Page = parseInt(searchParams.get("page") || "1", 10);
    const Limit = parseInt(searchParams.get("limit") || "50", 10);

    // Collect all query params from frontend (optional)
    const params = {
      Search: searchParams.get("Search") || "",
      OrderStatus: searchParams.get("OrderStatus") || "", // fetch all statuses
      FulfilmentStatus: searchParams.get("FulfilmentStatus") || "", // fetch all fulfilment
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
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    // Fetch sale list
    const listUrl = `${DEAR_API_BASE}/saleList?Page=${Page}&Limit=${Limit}&${queryString}`;
    const listData = await fetchDearApi(listUrl);
    const saleList = listData.SaleList || [];

    console.log("Raw sale list:", saleList); // Debug log

    const MAX_CONCURRENT = 5;
    const fullDetails = [];

    // Fetch details in parallel
    for (let i = 0; i < saleList.length; i += MAX_CONCURRENT) {
      const chunk = saleList.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        chunk.map(async (order) => {
          const url = `${DEAR_API_BASE}/sale?ID=${order.SaleID}`;
          return fetchDearApi(url);
        })
      );

      results.forEach((r) => {
        if (r.status === "fulfilled") {
          fullDetails.push(r.value); // Remove previous filters
        }
      });
    }

    return NextResponse.json({
      totalOrders: listData.Total || 0,
      saleOrders: fullDetails,
      page: Page,
      limit: Limit,
    });
  } catch (error) {
    console.error("Error fetching sale orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch sale orders", details: error.message },
      { status: 500 }
    );
  }
}
