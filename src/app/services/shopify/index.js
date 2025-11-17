import { createGraphQLClient } from "@shopify/graphql-client";
// import '@shopify/shopify-api/adapters/node';
import { connectToDB } from "../../../lib/mongodb.js";
import SyncOrder from "../../../models/syncOrder.js";
import { fetchSaleApi } from "../dear-api/index.js";
import DeadLetterQueue from "../../../models/DeadLetterQueue.js";
import ProcessOrder from "../../../models/ProcessOrder.js";


const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const ALLOWED_POS_LOCATIONS = ["Riverhorse Valley-Warehouse", "Deco Park Warehouse"];


export async function importSalesData() {
  await connectToDB();
  // Fetch sales data from external API
  const listData = await fetchSaleApi("/saleList?Status=ESTIMATING");
  const saleList = listData.SaleList || [];
  for (const sale of saleList) {
    try {
      // Fetch full sale details
      const detailData = await fetchSaleApi(`/sale?ID=${sale.SaleID}`);
      if (!ALLOWED_POS_LOCATIONS.includes(detailData.Location)) continue;
      // Save or update sale + details
      await SyncOrder.findOneAndUpdate(
        { ID: detailData.ID },
        { $set: detailData },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(` Error saving sale ${sale.OrderNumber}:`, err.message);
    }
  }

}

export async function processOrders(sale_id) {
  try {
    const saleID = sale_id;

    console.log(saleID, "SalesID")

    // ---- Fetch order data ----
    const customerData = await SyncOrder.findOne({ ID: saleID });
    const customerEmail = customerData.Email;

    console.log(customerData, 'CustomerData')

    // ---- Find or create customer ----
    let customer = await searchCustomer(customerEmail);
    console.log(customer, 'customer')
    if (!customer) {
      const newCustomer = await createCustomer(customerData);
      console.log(`Created new customer: ${newCustomer}`);
      customer = newCustomer?.customer;
    }

    const customerID = customer.id;

    // ---- Prepare order data ----
    const lineItems = await prepareLineItems(customerData, saleID);
    if (!lineItems) {
      console.log(`Order ${saleID} stopped. SKU missing.`);
      return;    
    }

    const tags = [
      "POS-Quote",
      `CoreSale:${customerData.Order.SaleOrderNumber}`,
      `Location:${customerData.Location}`,
    ];

    const noteAttributes = [
      { name: "coreSaleId", value: customerData.ID },
      { name: "coreDocumentNumber", value: customerData.Order.SaleOrderNumber },
      { name: "quoteCreatedAt", value: customerData.SaleOrderDate },
    ];

    // ---- Build payload ----
    const payload = await generateOrderPayload(
      customerData,
      lineItems,
      tags,
      noteAttributes
    );

    // ---- Create draft order ----
    const createdDraftOrderData = await createDraftOrder(payload);
    console.log("Draft order:", createdDraftOrderData);

    const draftOrderId = createdDraftOrderData.id;
    const draftOrderInvoiceUrl = createdDraftOrderData.invoice_url;

    console.log(
      `Draft Order created with ID: ${draftOrderId}, Invoice URL: ${draftOrderInvoiceUrl}`
    );

    // ---- Send invoice ----
    const invoiceResult = await sendInvoice(draftOrderId);

    // ---- Update status ONLY if invoice succeeded ----
    if (invoiceResult.success) {
      await SyncOrder.updateOne(
        { ID: saleID },
        { $set: { Status: "PROCESSED" } }
      );

      console.log(`Order ${saleID} marked as PROCESSED`);
    } else {
      console.log(`Invoice NOT sent for ${saleID}. Status unchanged.`);
    }

    // ---- Save process data ----
    if(saleID&&customerID&&draftOrderId&&draftOrderInvoiceUrl){
    await saveProcessOrder(
      saleID,
      customerID,
      draftOrderId,
      draftOrderInvoiceUrl
    );
    console.log("Saved process order to DB.");
  }else{
    console.log(
    "Not saving to DB. Missing fields:",
    {
      saleID,
      customerID,
      draftOrderId,
      draftOrderInvoiceUrl
    }
  );
  }

  } catch (error) {
    console.error(`Error processing sale ID ${sale_id}:`, error);
  }
}

// // ---------- Step 2: Search Shopify by email ----------
export async function searchCustomer(email) {
  console.log(process.env.SHOPIFY_STORE_DOMAIN, "Domain");
  console.log(process.env.SHOPIFY_ACCESS_TOKEN, "Token")
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/customers/search.json?query=email:${email}`,
    {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await res.json();
  console.log(data, 'customer res')
  if (data && data.customers && data.customers.length > 0) {
    // Means we got customer data
    return data.customers[0];
  } else {
    // Means no customers found or invalid response
    return null;
  }
}
// // ---------- Step 3: Create customer in Shopify ----------
export async function createCustomer(customers) {
  const c = customers;
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

  console.log(process.env.SHOPIFY_STORE_DOMAIN, "Shopify Domain")
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/customers.json`,
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
  console.log("Shopify create customer response:", data);
  return data;
}

// ---------- Helper: Find Shopify Variant by SKU ----------


export async function prepareLineItems(customerData, saleID) {
  await connectToDB();

  const quoteLines = customerData.Quote?.Lines || [];
  const lineItems = [];

  for (const line of quoteLines) {
    const sku = line.SKU?.trim();
    const quantity = line.Quantity;

    if (!sku) continue;

    try {
      const variant = await fetchVariantsBySKU(sku);

      if (!variant || variant.length === 0) {
        // SKU NOT FOUND → log to DLQ
        await DeadLetterQueue.create({
          sale_id: saleID,
          sku: sku,
        });

        console.log(`DLQ entry created for SKU: ${sku}`);
        return null;
      }

      // VALID VARIANT
      const variantId = variant[0].id.split("/").pop();

      lineItems.push({
        variant_id: variantId,
        quantity: Math.round(quantity),
      });

    } catch (err) {
      console.error(`Error fetching variant for SKU ${sku}:`, err.message);
    }
  }

  console.log("Prepared line items:", lineItems);
  return lineItems;   // FIXED
}


const client = createGraphQLClient({
  url: `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-10/graphql.json`,
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
  },
});
const GET_VARIANTS_BY_SKU = /* GraphQL */ `
   query getVariantsBySKU($sku: String!) {
     productVariants(first: 50, query: $sku) {
       edges {
         node {
           id
           title
           sku
           inventoryQuantity
           product {
             id
             title
           }
         }
       }
     }
   }
 `;
async function fetchVariantsBySKU(sku) {
  const { data, errors } = await client.request(GET_VARIANTS_BY_SKU, {
    variables: {
      sku: `sku:${sku}`,  // IMPORTANT
    },
  });
  if (errors) {
    console.error(errors);
    throw new Error("Shopify GraphQL error");
  }
  return data.productVariants.edges.map(edge => edge.node);
}

async function generateOrderPayload(customerData, lineItems, tags, noteAttributes) {
  const billing = customerData?.BillingAddress || {};
  const shipping = customerData?.ShippingAddress || {};

  return {
    email: customerData?.Email || "",
    billing_address: {
      first_name: customerData?.FirstName || "",
      last_name: customerData?.LastName || "",
      address1: billing?.Line1 || "",
      address2: billing?.Line2 || "",
      city: billing?.City || "",
      province: billing?.State || "",
      zip: billing?.Postcode || "",
      country: billing?.Country || "",
      phone: customerData?.Phone,
    },
    shipping_address: {
      first_name: customerData?.FirstName || "",
      last_name: customerData?.LastName || "",
      address1: shipping?.Line1 || "",
      address2: shipping?.Line2 || "",
      city: shipping?.City || "",
      province: shipping?.State || "",
      zip: shipping?.Postcode || "",
      country: shipping?.Country || "",
      phone: customerData?.Phone,
    },
    line_items: lineItems || [],
    tags: tags.join(", "),
    note_attributes: noteAttributes || []
  };
}



export async function createDraftOrder(payload) {
  try {
    const body = { draft_order: payload }; // Correct

    console.log("Final payload:", JSON.stringify(body, null, 2));

    const res = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-10/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();
    console.log("Shopify response:", data);

    if (!data.draft_order) {
      throw new Error(`Draft order not created → ${JSON.stringify(data)}`);
    }

    return data.draft_order;
  } catch (err) {
    console.error("Error creating draft order:", err);
    throw err;
  }
}

export async function sendInvoice(draftOrderId) {
  console.log("Sending invoice for Draft Order ID:", draftOrderId);
  const invoicePayload = {
    to: "kapil.gurjar2028@gmail.com",
    subject: "Apple Computer Invoice",
    custom_message: "Thank you for ordering!",
    bcc: ["kapil.gurjar2028@gmail.com"],
  };
  try {
    const res = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-10/draft_orders/${draftOrderId}/send_invoice.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ draft_order_invoice: invoicePayload }),
      }
    );
    const data = await res.json();
    console.log("Send Invoice Response:", data);
    if (!res.ok) {
      console.error(":red_circle: Shopify Error:", data);
      return { success: false, error: data };
    }
    return { success: true, data };
  } catch (error) {
    console.error(":x: Error sending invoice:", error);
    return { success: false, error };
  }
}




export async function saveProcessOrder(saleID, customerID, draftOrderID, invoiceURL) {
  await connectToDB();
  try {
    const saved = await ProcessOrder.create({
      saleID: saleID,
      customerID: customerID,
      draftOrderID: draftOrderID,
      invoiceURL: invoiceURL

    });

    console.log("Saved Process Order:", saved._id);
    return saved;
  } catch (err) {
    console.error("Error saving process order:", err);
    throw err;
  }
}

