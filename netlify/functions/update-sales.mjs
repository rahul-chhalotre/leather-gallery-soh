import { connectToDB } from "../../src/lib/mongodb";
import SaleOrder from "../../src/models/SaleOrder";

const DEAR_API_BASE = "https://inventory.dearsystems.com/ExternalApi/v2";
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;

// --- API fetch helper with logging ---
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
//   console.log(`[API] Fetched ${data.SaleList?.length || 0} sale(s)`);
  return data;
}

export async function handler(event, context) {
   console.log(`[SCHEDULED FUNCTION] update-sales-background triggered at: ${new Date().toISOString()}`);
  try {
    console.log("[DB] Connecting to MongoDB...");
    await connectToDB();
    console.log("[DB] MongoDB connected");

    const fullDetails = [];
    const limit = 100;
    let page = 1;

    while (true) {
      console.log(`[INFO] Fetching sale list page ${page}...`);
      const listUrl = `${DEAR_API_BASE}/saleList?Page=${page}&Limit=${limit}&OrderStatus=AUTHORISED`;
      const listData = await fetchDearApi(listUrl);

      const saleList = listData.SaleList || [];
      if (!saleList.length) {
        console.log("[INFO] No more sales to fetch, exiting loop.");
        break;
      }

      console.log(`[INFO] Fetching full sale details for ${saleList.length} sales...`);
      const results = await Promise.allSettled(
        saleList.map((order) => fetchDearApi(`${DEAR_API_BASE}/sale?ID=${order.SaleID}`))
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          const sale = r.value;
          if (!sale.ID) continue;

          const totalOrdered = sale.Lines?.reduce(
            (sum, line) => sum + (line.Quantity || 0),
            0
          ) || 0;
          const totalShipped = sale.Fulfilments?.reduce(
            (sum, f) =>
              sum +
              (f.Lines?.reduce(
                (lsum, l) => lsum + (l.QuantityShipped || 0),
                0
              ) || 0),
            0
          ) || 0;

          const remainingOut = totalOrdered - totalShipped;
          sale.RemainingOut = remainingOut;
          fullDetails.push(sale);

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

          console.log(`[DB] Upserted Sale ID: ${sale.ID} | RemainingOut: ${remainingOut}`);
        } else {
          console.error(`[ERROR] Failed to fetch sale: ${r.reason}`);
        }
      }

      console.log(`[INFO] Finished page ${page}, total sales processed so far: ${fullDetails.length}`);

      if (saleList.length < limit) {
        console.log("[INFO] Last page reached.");
        break;
      }

      page++;
    }

    console.log(`[INFO] Total sale orders fetched: ${fullDetails.length}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Sale orders updated",
        totalOrdersFetched: fullDetails.length,
      }),
    };
  } catch (error) {
    console.error("[ERROR]", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
