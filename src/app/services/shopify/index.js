const DEAR_API_BASE = "https://inventory.dearsystems.com/ExternalApi/v2";
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const ALLOWED_POS_LOCATIONS = ["Riverhorse Valley-Warehouse", "Deco Park Warehouse"];

// ---------- Fetch from Cin7 ----------
export async function fetchCustomerApi(endpoint) {
  const res = await fetch(`${DEAR_API_BASE}${endpoint}`, {
    headers: {
      "api-auth-accountid": ACCOUNT_ID,
      "api-auth-applicationkey": APP_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DEAR API Error: ${res.status} - ${err}`);
  }
  return res.json();
}

// ---------- Step 1: Get basic customer list ----------
export async function getCustomerList() {
  const listData = await fetchCustomerApi("/saleList?Status=ESTIMATING");
  const saleList = listData.SaleList || [];

  const customers = [];

  for (const sale of saleList) {
    const detailData = await fetchCustomerApi(`/sale?ID=${sale.SaleID}`);
    if (!ALLOWED_POS_LOCATIONS.includes(detailData.Location)) continue;

    customers.push({
      Location: detailData.Location,
      CustomerName: detailData.Customer,
      Email: detailData.Email,
      Phone: detailData.Phone,
      BillingAddress: detailData.BillingAddress || {},
      ShippingAddress: detailData.ShippingAddress || {},
    });
  }
console.log(customers)
  return customers;
  
}

// ---------- Step 2: Search Shopify by email ----------
export async function searchCustomer(email) {
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/2025-01/customers/search.json?query=email:${email}`,
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await res.json();
  return data.customers || [];
}

// ---------- Step 3: Create customer in Shopify ----------
export async function createCustomer(c) {
  const billing = c.BillingAddress || {};
  const shipping = c.ShippingAddress || {};
  const [first_name, ...lastParts] = c.CustomerName?.trim()?.split(" ") || [];
  const last_name = lastParts.join(" ");

  const payload = {
    customer: {
      first_name,
      last_name,
      email: c.Email?.trim(),
      phone: c.Phone?.trim(),
      verified_email: true,
      addresses: [
        {
          address1: billing.Line1 || shipping.Line1 || "",
          address2: billing.Line2 || shipping.Line2 || "",
          city: billing.City || shipping.City || "",
          province: billing.State || shipping.State || "",
          zip: billing.Postcode || shipping.Postcode || "",
          country: billing.Country || shipping.Country || "",
          company: shipping.Company || "",
        },
      ],
    },
  };

  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/2025-01/customers.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.errors || data));

  return data.customer;
}

// ---------- Step 4: Sequential Sync ----------
export async function syncCustomersSequentially() {
  try {
    const listData = await fetchCustomerApi("/saleList?Status=ESTIMATING");
    const saleList = listData.SaleList || [];

    console.log(`Total Cin7 sales found: ${saleList.length}`);
    const results = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const [index, sale] of saleList.entries()) {
      console.log(`\n🔹 Processing ${index + 1}/${saleList.length} → SaleID: ${sale.SaleID}`);

      try {
        const detailData = await fetchCustomerApi(`/sale?ID=${sale.SaleID}`);
        if (!ALLOWED_POS_LOCATIONS.includes(detailData.Location)) continue;

        const customer = {
          Location: detailData.Location,
          CustomerName: detailData.Customer,
          Email: detailData.Email,
          Phone: detailData.Phone,
          BillingAddress: detailData.BillingAddress || {},
          ShippingAddress: detailData.ShippingAddress || {},
        };

        if (!customer.Email) continue;

        const existing = await searchCustomer(customer.Email);

        if (existing.length > 0) {
          console.log(`🟡 Skipped (already exists): ${customer.Email}`);
          results.push({ email: customer.Email, action: "skipped", id: existing[0].id });
          skippedCount++;
        } else {
          const created = await createCustomer(customer);
          console.log(`🟢 Created new customer: ${created.email}`);
          results.push({ email: customer.Email, action: "created", id: created.id });
          createdCount++;
        }
      } catch (err) {
        console.error(`❌ Error with SaleID ${sale.SaleID}:`, err.message);
      }
    }

    const summary = {
      success: true,
      summary: {
        totalProcessed: createdCount + skippedCount,
        created: createdCount,
        skipped: skippedCount,
      },
      details: results,
    };

    console.log("\n✅ Sync Complete:", summary.summary);
    return summary;
  } catch (error) {
    console.error("❌ Fatal error in syncCustomersSequentially:", error);
    return { success: false, message: error.message };
  }
}
