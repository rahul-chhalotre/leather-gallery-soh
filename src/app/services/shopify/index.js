import { connectToDB } from "../../../lib/mongodb.js";
import SyncOrder from "../../../models/syncOrder.js";
import { fetchSaleApi } from "../dear-api/index.js";
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

export async function processOrders(sale_ids) {
  console.log("sale IDs:", sale_ids);
  for (const sale_id of sale_ids) {
    try {
      const saleID = sale_id;
      const customerData = await SyncOrder.findOne({ ID: sale_id });
      const customerEmail = customerData.Email;
      let customer = await searchCustomer(customerEmail);
      let customerID;
      if (!customer) {
        const newCustomer = await createCustomer(customerData);
        console.log(`Created new customer in Shopify with email ${newCustomer}`);
        customer = newCustomer?.customer;
      }
      customerID = customer.id;
      const lineItems = await prepareLineItems(customerData);
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
      const payload = await generateOrderPayload(customerData, lineItems, tags, noteAttributes);
      const createdDraftOrderData = await createDraftOrder(payload);
      const draftOrderId = createdDraftOrderData.id;
      const draftOrderInvoiceUrl = createdDraftOrderData.invoice_url;
      // console.log(`Draft Order created in Shopify with ID: ${draftOrderId}, Invoice URL: ${draftOrderInvoiceUrl}`);
      sendInvoice(draftOrderId);
      console.log("saveprocess" , saleID , customerID , draftOrderId , draftOrderInvoiceUrl)
      saveProcessOrder(saleID, customerID, draftOrderId, draftOrderInvoiceUrl);
      



    } catch (error) {
      console.error(`Error processing sale ID ${sale_id}:`, error);
    }
  }
}
// // ---------- Step 2: Search Shopify by email ----------
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
  // console.log("Creating customer in Shopify:", customers);
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
  console.log("Shopify create customer response:", data);
  return data;
}

export async function prepareLineItems(customerData) {
  const quoteLines = customerData.Quote?.Lines || [];
  const lineItems = [];
  // Build Shopify lineItems from quoteLines
  for (const line of quoteLines) {
    const sku = line.SKU?.trim();
    const quantity = line.Quantity;
    if (!sku) continue;
    try {
      const variant = await getVariantBySKU(sku);
      if (variant) {
        lineItems.push({
          variant_id: `${variant.id}`,
          quantity: Math.round(quantity),
        });
      } else {
        console.warn(`Variant not found for SKU: ${sku}`);
      }
    } catch (err) {
      console.error(`Error fetching variant for SKU ${sku}:`, err.message);
    }
  }
  return lineItems;
}

// ---------- Helper: Find Shopify Variant by SKU ----------
async function getVariantBySKU(sku) {
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/2025-10/variants.json?sku=${encodeURIComponent(sku)}`,
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await res.json();
  return data.variants?.[0] || null;
}
async function generateOrderPayload(customerData, lineItems, tags, noteAttributes) {
  const billing = customerData?.BillingAddress || {};
  const shipping = customerData?.ShippingAddress || {};
  const payload = {
    draft_order: {
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
      note_attributes: noteAttributes || [],
    }
  };
  return payload;
}

export async function createDraftOrder(payload) {
  try {
    // Create Draft Order via Shopify REST API
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2025-10/draft_orders.json`,
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
    if (data) {
      console.log("Draft Order Created");
      return data.draft_order;
    } else {
      throw new Error("Data not received from Shopify");
    }
  } catch (err) {
    console.error("Error creating draft order:", err.message);
    return { success: false, message: err.message };
  }
}



export async function sendInvoice(draftOrderId) {
  console.log("Sending invoice for Draft Order ID:", draftOrderId);
  const invoicePayload = {
    to: "kapil.gurjar2028@gmail.com",
    from: "kapil.gurjar2028@gmail.com",
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




export async function saveProcessOrder(saleID, customerID, draftOrderID, invoiceURL ) {
  await connectToDB();
  // console.log(saleID , customerID , draftOrderID , invoiceURL)
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
