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
      CreatedSince: searchParams.get('CreatedSince') || '',
      UpdatedSince: searchParams.get('UpdatedSince') || '',
      ShipBy: searchParams.get('ShipBy') || '',
      QuoteStatus: searchParams.get('QuoteStatus') || '',
      OrderStatus: searchParams.get('OrderStatus') || '',
      CombinedPickStatus: searchParams.get('CombinedPickStatus') || '',
      CombinedPackStatus: searchParams.get('CombinedPackStatus') || '',
      CombinedShippingStatus: searchParams.get('CombinedShippingStatus') || '',
      CombinedInvoiceStatus: searchParams.get('CombinedInvoiceStatus') || '',
      CreditNoteStatus: searchParams.get('CreditNoteStatus') || '',
      ExternalID: searchParams.get('ExternalID') || '',
      Status: searchParams.get('Status') || '',
      ReadyForShipping: searchParams.get('ReadyForShipping') || '',
      OrderLocationID: searchParams.get('OrderLocationID') || '',
    };

    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    // Step 1: Get all open sale orders
    do {
      const url = `${DEAR_API_BASE}/saleList?Page=${Page}&Limit=${Limit}&${queryString}`;
      const data = await fetchDearApi(url);
      const saleList = data.SaleList || [];
      total = data.Total || 0;

      allOrders = allOrders.concat(saleList);
      Page += 1;
    } while (allOrders.length < total);

    console.log(`✅ Retrieved ${allOrders.length} open sale orders`);

    // Step 2: Fetch full details for each sale order (with batching)
    const MAX_CONCURRENT = 5;
    const fullDetails = [];

    for (let i = 0; i < allOrders.length; i += MAX_CONCURRENT) {
      const chunk = allOrders.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        chunk.map(async (order) => {
          const url = `${DEAR_API_BASE}/sale?ID=${order.SaleID}`;
          const detail = await fetchDearApi(url);
          return detail
        })
      );
results.forEach((r) => {
  const shipByDate = (r.value && r.value.ShipBy) ? new Date(r.value.ShipBy) : null;
  const today = new Date();

  if (shipByDate && shipByDate > today) {
    fullDetails.push(r.value);
  }
});
    }

    // Step 3: Return combined data
    return NextResponse.json({
      totalOrders: allOrders.length,
      saleOrders: fullDetails,
    });
  } catch (error) {
    console.error('🚨 Error fetching all open sale orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch all open sale orders', details: error.message },
      { status: 500 }
    );
  }
}