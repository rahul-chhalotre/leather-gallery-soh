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
      OrderStatus: searchParams.get("OrderStatus") || "AUTHORISED",
      RestockReceivedStatus: searchParams.get("RestockReceivedStatus") || "",
      InvoiceStatus: searchParams.get("InvoiceStatus") || "",
      CreditNoteStatus: searchParams.get("CreditNoteStatus") || "",
      UnstockStatus: searchParams.get("UnstockStatus") || "",
      Status: searchParams.get("Status") || "",
      DropShipTaskID: searchParams.get("DropShipTaskID") || "",
    };

    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== "")
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    const fullDetails = [];
    const limit = 100; // DEAR's page limit
    let page = 1;

    while (true) {
      const listUrl = `${DEAR_API_BASE}/purchaseList?Page=${page}&Limit=${limit}&${queryString}`;
      const listData = await fetchDearApi(listUrl);
      const purchaseList = listData.PurchaseList || [];

      if (purchaseList.length === 0) break;

      const results = await Promise.allSettled(
        purchaseList.map((order) =>
          fetchDearApi(`${DEAR_API_BASE}/advanced-purchase?ID=${order.ID}`)
        )
      );

      results.forEach((r) => {
        if (
          r.status === "fulfilled" &&
          r.value?.RequiredBy &&
          r.value.CombinedReceivingStatus !== "FULLY RECEIVED" &&
          r.value.CombinedInvoiceStatus !== "INVOICED"
        ) {
          fullDetails.push(r.value);
        }
      });

      if (purchaseList.length < limit) break;
      page++;
    }

    return NextResponse.json({
      totalOrders: fullDetails.length,
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