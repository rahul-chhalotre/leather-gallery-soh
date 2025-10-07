import { NextResponse } from 'next/server';

const DEAR_API_BASE = 'https://inventory.dearsystems.com/ExternalApi/v2';
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;

async function fetchDearApi(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'api-auth-accountid': ACCOUNT_ID,
      'api-auth-applicationkey': APP_KEY,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DEAR API request failed: ${res.status} ${res.statusText} - ${text}`);
  }

  return res.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    let Page = 1;
    const Limit = 200;
    let total = 0;
    let allOrders = [];

    // Optional filters
    const params = {
      Search: searchParams.get('Search') || '',
      RequiredBy: searchParams.get('RequiredBy') || '',
      UpdatedSince: searchParams.get('UpdatedSince') || '',
      OrderStatus: searchParams.get('OrderStatus') || 'AUTHORISED',
      RestockReceivedStatus: searchParams.get('RestockReceivedStatus') || '',
      InvoiceStatus: searchParams.get('InvoiceStatus') || '',
      CreditNoteStatus: searchParams.get('CreditNoteStatus') || '',
      UnstockStatus: searchParams.get('UnstockStatus') || '',
      Status: searchParams.get('Status') || '',
      DropShipTaskID: searchParams.get('DropShipTaskID') || '',
    };

    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    // Step 1: Get all open purchase orders
    do {
      const url = `${DEAR_API_BASE}/purchaseList?Page=${Page}&Limit=${Limit}&${queryString}`;
      const data = await fetchDearApi(url);
      const purchaseList = data.PurchaseList || [];
      total = data.Total || 0;

      allOrders = allOrders.concat(purchaseList);
      Page += 1;
    } while (allOrders.length < total);

    console.log(`✅ Retrieved ${allOrders.length} open purchase orders`);

    // Step 2: Fetch full details for each purchase order (with batching)
    const MAX_CONCURRENT = 5;
    const fullDetails = [];

    for (let i = 0; i < allOrders.length; i += MAX_CONCURRENT) {
      const chunk = allOrders.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        chunk.map(async (order) => {
          const url = `${DEAR_API_BASE}/advanced-purchase?ID=${order.ID}`;
          const detail = await fetchDearApi(url);
          return detail
        })
      );

      results.forEach((r) => {
        if (r.value && r.value.CombinedReceivingStatus !== 'FULLY RECEIVED' &&
            r.value.CombinedInvoiceStatus !== 'INVOICED' && r.value.RequiredBy && new Date(r.value.RequiredBy) > new Date()
            ) fullDetails.push(r.value);
      });
    }

    // Step 3: Return combined data
    return NextResponse.json({
      totalOrders: allOrders.length,
      purchaseOrders: fullDetails,
    });
  } catch (error) {
    console.error('🚨 Error fetching all open purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch all open purchase orders', details: error.message },
      { status: 500 }
    );
  }
}