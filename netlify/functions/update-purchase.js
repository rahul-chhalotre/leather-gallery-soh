import { connectToDB } from "../../src/lib/mongodb.js";
import PurchaseOrder from "../../src/models/PurchaseOrder.js";


const DEAR_API_BASE = "https://inventory.dearsystems.com/ExternalApi/v2";
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;

async function fetchDearApi(url) {
  console.log(`[API] Fetching: ${url}`);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "api-auth-accountid": ACCOUNT_ID,
      "api-auth-applicationkey": APP_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[API ERROR] ${res.status} ${res.statusText} - ${text}`);
    throw new Error(`DEAR API request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
//   console.log(`[API] Fetched ${data.PurchaseList?.length || 0} items`);
  return data;
}

export async function handler(event, context) {
  try {
    console.log("[DB] Connecting to MongoDB...");
    await connectToDB();
    console.log("[DB] MongoDB connected");

    const fullDetails = [];
    const limit = 100;
    let page = 1;

    while (true) {
      console.log(`[INFO] Fetching page ${page}...`);
      const listUrl = `${DEAR_API_BASE}/purchaseList?Page=${page}&Limit=${limit}&OrderStatus=AUTHORISED`;
      const listData = await fetchDearApi(listUrl);
      const purchaseList = listData.PurchaseList || [];

      if (!purchaseList.length) {
        console.log("[INFO] No more purchase orders to fetch, exiting loop.");
        break;
      }

      const results = await Promise.allSettled(
        purchaseList.map(order => fetchDearApi(`${DEAR_API_BASE}/advanced-purchase?ID=${order.ID}`))
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          const order = r.value;
          if (!order.ID) continue;

          const totalOrdered = order.Lines?.reduce((sum, line) => sum + (line.QuantityOrdered || 0), 0) || 0;
          const totalReceived = order.Lines?.reduce((sum, line) => sum + (line.QuantityReceived || 0), 0) || 0;
          const remainingIn = totalOrdered - totalReceived;

          order.RemainingIn = remainingIn;
          fullDetails.push(order);

          const dbResult = await PurchaseOrder.findOneAndUpdate(
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

          console.log(`[DB] Upserted order ID: ${order.ID}`);
        } else {
          console.error(`[ERROR] Failed to fetch order: ${r.reason}`);
        }
      }

      console.log(`[INFO] Finished page ${page}, fetched so far: ${fullDetails.length}`);
      if (purchaseList.length < limit) break;
      page++;
    }

    console.log(`[INFO] Total purchase orders fetched: ${fullDetails.length}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Purchase orders updated", totalOrdersFetched: fullDetails.length }),
    };
  } catch (error) {
    console.error("[ERROR]", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
