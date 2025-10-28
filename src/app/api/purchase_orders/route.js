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
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    const listUrl = `${DEAR_API_BASE}/purchaseList?Page=${Page}&Limit=${Limit}&${queryString}`;
    const listData = await fetchDearApi(listUrl);
    const purchaseList = listData.PurchaseList || [];
    const MAX_CONCURRENT = 5;
    const fullDetails = [];

    for (let i = 0; i < purchaseList.length; i += MAX_CONCURRENT) {
      const chunk = purchaseList.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        chunk.map(async (order) => {
          const url = `${DEAR_API_BASE}/advanced-purchase?ID=${order.ID}`;
          return fetchDearApi(url);
        })
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
    }

    return NextResponse.json({
      totalOrders: listData.Total || 0,
      purchaseOrders: fullDetails,
      page: Page,
      limit: Limit,
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders", details: error.message },
      { status: 500 }
    );
  }
}
