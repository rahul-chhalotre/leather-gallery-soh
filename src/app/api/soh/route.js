export async function POST(req) {
  try {
    const { sku, location } = await req.json();
    console.log("📦 Received SKU:", sku, "Location:", location);

    const headers = {
      "Content-Type": "application/json",
      "api-auth-accountid": process.env.DEAR_API_ACCOUNT_ID,
      "api-auth-applicationkey": process.env.DEAR_API_APPLICATION_KEY,
    };

    const limit = 1000;

    async function fetchAllPages(urlBase) {
      let page = 1;
      let allItems = [];
      let total = 0;

      do {
        const url = `${urlBase}&Page=${page}&Limit=${limit}`;
        console.log(`Fetching: ${url}`);

        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`API error (${res.status}) for ${urlBase}`);
        }
        const data = await res.json();

        let list = [];
        if (data.PurchaseList) list = data.PurchaseList;
        else if (data.SaleList) list = data.SaleList;
        else if (Array.isArray(data)) list = data;
        else list = [];

        total = data.Total || 0;
        console.log(`Page ${page}, Items fetched: ${list.length}, Total: ${total}`);

        allItems = allItems.concat(list);
        page++;
      } while (allItems.length < total);

      return allItems;
    }

    const allPurchases = await fetchAllPages(
      "https://inventory.dearsystems.com/ExternalApi/v2/purchaseList?OrderStatus=AUTHORISED"
    );

    console.log("Total purchases fetched:", allPurchases.length);

    const purchaseMapped = allPurchases.flatMap((p) =>
      (p.Lines || []).filter((line) => {
        const lineLocation = (line.Warehouse || line.Location || "").toLowerCase();
        return (
          line.SKU === sku &&
          lineLocation === location.toLowerCase()
        );
      }).map((line) => ({
        ref: p.OrderNumber || p.Reference || "N/A",
        date: p.OrderDate || "N/A",
        in: line.Quantity || 0,
        out: 0,
        ots: line.ReceivedQuantity || 0,
      }))
    );

    console.log("Filtered purchase lines:", purchaseMapped.length);

    const allSales = await fetchAllPages(
      "https://inventory.dearsystems.com/ExternalApi/v2/saleList?OrderStatus=AUTHORISED"
    );

    console.log("Total sales fetched:", allSales.length);

    const saleMapped = allSales.flatMap((s) =>
      (s.Lines || []).filter((line) => {
        const lineLocation = (line.Warehouse || line.Location || "").toLowerCase();
        return (
          line.SKU === sku &&
          lineLocation === location.toLowerCase()
        );
      }).map((line) => ({
        ref: s.OrderNumber || s.Reference || "N/A",
        date: s.OrderDate || "N/A",
        in: 0,
        out: line.Quantity || 0,
        ots: line.QuantityFulfilled || 0,
      }))
    );

    console.log("Filtered sale lines:", saleMapped.length);

    const combined = [...purchaseMapped, ...saleMapped].filter(item => {
      // Filter out invalid dates
      return !isNaN(new Date(item.date).getTime());
    }).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    console.log("Final combined data length:", combined.length);
    console.log("Combined sample:", combined.slice(0, 3));

    return new Response(JSON.stringify(combined), { status: 200 });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
