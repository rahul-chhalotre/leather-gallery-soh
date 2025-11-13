
import { connectToDB } from "../../../lib/mongodb.js"; 
import SyncOrder from "../../../models/syncOrder.js"; 
const DEAR_API_BASE = "https://inventory.dearsystems.com/ExternalApi/v2";
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;
const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const ALLOWED_POS_LOCATIONS = ["Riverhorse Valley-Warehouse", "Deco Park Warehouse"];




export async function fetchSaleApi(endpoint) {
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




export async function importSalesData() {
 
  await connectToDB();
  // Fetch sales data from external API
  const listData = await fetchSaleApi("/saleList?Status=ESTIMATING");
  const saleList = listData.SaleList || [];
  console.log(` ${saleList.length} sales found.`);

  for (const sale of saleList) {
    console.log(`\n🔍 Processing SaleID: ${sale.SaleID} `);
    try {
      // Fetch full sale details
      const detailData = await fetchSaleApi(`/sale?ID=${sale.SaleID}`);
       if (!ALLOWED_POS_LOCATIONS.includes(detailData.Location)) continue;
      // Save or update sale + details
      
        await SyncOrder.findOneAndUpdate(
            { ID: detailData.ID },
            { $set:  detailData  },
            { upsert: true, new: true }
        );


    } catch (err) {
      console.error(` Error saving sale ${sale.OrderNumber}:`, err.message);
    }
  }

}







// ---------- Helper: Find Shopify Variant by SKU ----------
// async function getVariantBySKU(sku) {
//   const res = await fetch(
//     `https://${SHOPIFY_DOMAIN}/admin/api/2025-10/variants.json?sku=${encodeURIComponent(sku)}`,
//     {
//       headers: {
//         "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
//         "Content-Type": "application/json",
//       },
//     }
//   );
//   const data = await res.json();
//   return data.variants?.[0] || null;
// }
// ---------- Step 1: Get basic customer list ----------




















// // export async function getCustomer() {

// //   const listData = await fetchCustomerApi("/saleList?Status=ESTIMATING");
// //   const saleList = listData.SaleList || [];

// //   const customers = [];
// //   for (const sale of saleList) {
// //     const detailData = await fetchCustomerApi(`/sale?ID=${sale.SaleID}`);
// //     if (!ALLOWED_POS_LOCATIONS.includes(detailData.Location)) continue;
// //     const quoteLines = detailData.Quote?.Lines || [];
// //     const lineItems = [];
// //     // Build Shopify lineItems from quoteLines
// //     for (const line of quoteLines) {
// //       const sku = line.SKU?.trim();
// //       const quantity = line.Quantity;
// //       if (!sku) continue;
// //       try {
// //         const variant = await getVariantBySKU(sku);
// //         if (variant) {
// //           lineItems.push({
// //             variant_id: `${variant.id}`,
// //             quantity: Math.round(quantity),
// //           });
// //         } else {
// //           console.warn(`Variant not found for SKU: ${sku}`);
// //         }
// //       } catch (err) {
// //         console.error(`Error fetching variant for SKU ${sku}:`, err.message);
// //       }
// //     }
// //     console.log("Line items", lineItems);
// //     customers.push({
// //       customerData: {
// //         CustomerName: detailData.Customer,
// //         Email: detailData.Email,
// //         Phone: detailData.Phone,
// //         Location: detailData.Location,
// //         BillingAddress: detailData.BillingAddress || {},
// //         ShippingAddress: detailData.ShippingAddress || {},
// //       },
// //       lineItems,
// //       tags: [
// //         "POS-Quote",
// //         `CoreSale:${detailData.Order.SaleOrderNumber}`,
// //         `Location:${detailData.Location}`,
// //       ],
// //       noteAttributes: [
// //         { name: "coreSaleId", value: detailData.ID },
// //         { name: "coreDocumentNumber", value: detailData.Order.SaleOrderNumber },
// //         { name: "quoteCreatedAt", value: detailData.SaleOrderDate },
// //       ]
// //     });

// //   }
// //   return customers;
// // }
// // ---------- Step 2: Search Shopify by email ----------
// export async function searchCustomer(email) {
//   const res = await fetch(
//     `https://${SHOPIFY_DOMAIN}/admin/api/2025-01/customers/search.json?query=email:${email}`,
//     {
//       headers: {
//         "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
//         "Content-Type": "application/json",
//       },
//     }
//   );
//   const data = await res.json();
//   return data.customers || [];
// }
// // ---------- Step 3: Create customer in Shopify ----------
// export async function createCustomer(customers) {
//   const c = customers.customerData;
//   const billing = c.BillingAddress || {};
//   const shipping = c.ShippingAddress || {};
//   const [first_name, ...lastParts] = c.CustomerName?.trim()?.split(" ") || [];
//   const last_name = lastParts.join(" ");
//   const payload = {
//     customer: {
//       first_name,
//       last_name,
//       email: c.Email?.trim(),
//       phone: c.Phone?.trim(),
//       verified_email: true,
//       addresses: [
//         {
//           address1: billing.Line1 || shipping.Line1 || "",
//           address2: billing.Line2 || shipping.Line2 || "",
//           city: billing.City || shipping.City || "",
//           province: billing.State || shipping.State || "",
//           zip: billing.Postcode || shipping.Postcode || "",
//           country: billing.Country || shipping.Country || "",
//           company: shipping.Company || "",
//         },
//       ],
//     },
//   };
//   const res = await fetch(
//     `https://${SHOPIFY_DOMAIN}/admin/api/2025-01/customers.json`,
//     {
//       method: "POST",
//       headers: {
//         "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(payload),
//     }
//   );
//   const data = await res.json();
//   console.log("Create Customer Response:", data);
//   if (!res.ok) throw new Error(JSON.stringify(data.errors || data));
//   return data.customer;
// }
// // ---------- Step 4: Sequential Sync ----------
// export async function syncCustomersSequentially() {
//   try {
//     const listData = await fetchCustomerApi("/saleList?Status=ESTIMATING");
//     const saleList = listData.SaleList || [];
//     const results = [];
//     let createdCount = 0;
//     let skippedCount = 0;
//     for (const [index, sale] of saleList.entries()) {
//       console.log(`\n:small_blue_diamond: Processing ${index + 1}/${saleList.length} → SaleID: ${sale.SaleID}`);
//       try {
//         const detailData = await fetchCustomerApi(`/sale?ID=${sale.SaleID}`);
//         if (!ALLOWED_POS_LOCATIONS.includes(detailData.Location)) continue;
//         const customer = {
//           Location: detailData.Location,
//           CustomerName: detailData.Customer,
//           Email: detailData.Email,
//           Phone: detailData.Phone,
//           BillingAddress: detailData.BillingAddress || {},
//           ShippingAddress: detailData.ShippingAddress || {},
//         };
//         if (!customer.Email) continue;
//         const existing = await searchCustomer(customer.Email);
//         if (existing.length > 0) {
//           console.log(`Skipped (already exists): ${customer.Email}`);
//           results.push({ email: customer.Email, action: "skipped", id: existing[0].id });
//           skippedCount++;
//         } else {
//           const created = await createCustomer(customer);
//           console.log(`Created new customer: ${created.email}`);
//           results.push({ email: customer.Email, action: "created", id: created.id });
//           createdCount++;
//         }
//       } catch (err) {
//         console.error(`Error with SaleID ${sale.SaleID}:`, err.message);
//       }
//     }
//     const summary = {
//       success: true,
//       summary: {
//         totalProcessed: createdCount + skippedCount,
//         created: createdCount,
//         skipped: skippedCount,
//       },
//       details: results,
//     };
//     console.log("\n Sync Complete:", summary.summary);
//     return summary;
//   } catch (error) {
//     console.error(" Fatal error in syncCustomersSequentially:", error);
//     return { success: false, message: error.message };
//   }
// }


// export async function createDraftOrder(customers = []) {
//   console.log("Creating draft orders for customers:", customers.length);

//   const results = [];

//   for (const c of customers) {
//     try {
//       const { customerData, lineItems, tags, noteAttributes } = c;

//       const billing = customerData.BillingAddress || {};
//       const shipping = customerData.ShippingAddress || {};
//       const [first_name, ...lastParts] = customerData.CustomerName?.trim()?.split(" ") || [];
//       const last_name = lastParts.join(" ");

//       const payload = {
//         draft_order: {
//           email: customerData.Email,
//           billing_address: {
//             first_name,
//             last_name,
//             address1: billing.Line1 || "",
//             address2: billing.Line2 || "",
//             city: billing.City || "",
//             province: billing.State || "",
//             zip: billing.Postcode || "",
//             country: billing.Country || "",
//             phone: customerData.Phone || "",
//           },
//           shipping_address: {
//             first_name,
//             last_name,
//             address1: shipping.Line1 || "",
//             address2: shipping.Line2 || "",
//             city: shipping.City || "",
//             province: shipping.State || "",
//             zip: shipping.Postcode || "",
//             country: shipping.Country || "",
//             phone: customerData.Phone || "",
//           },
//           line_items: lineItems,
//           tags: tags.join(", "),
//           note_attributes: noteAttributes,
//         },
//       };

//       const res = await fetch(
//         `https://${SHOPIFY_DOMAIN}/admin/api/2025-10/draft_orders.json`,
//         {
//           method: "POST",
//           headers: {
//             "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(payload),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         console.error("Shopify Error:", data);
//         throw new Error(JSON.stringify(data.errors || data));
//       }

//       console.log(`Draft order created for ${customerData.Email}`);
//       results.push({ success: true, email: customerData.Email, draftOrderId: data.draft_order.id });

//     } catch (err) {
//       console.error(`Error creating draft order for ${c.customerData?.Email}:`, err.message);
//       results.push({ success: false, email: c.customerData?.Email, message: err.message });
//     }
//   }

//   return results;
// }


// export async function createDraftOrder(customers) {
//   console.log("Creating draft order for customers:", customers);
//   const { customerData, lineItems, tags, noteAttributes } = customers;
  
//   try {
// //     const formattedLineItems = lineItems.map(item => ({
// //   variant_id: item.variantId.split("/").pop()
// //   quantity: item.quantity
// // }));

//     // Extract customer + address info
//     const billing = customerData.BillingAddress || {};
//     const shipping = customerData.ShippingAddress || {};
//     const [first_name, ...lastParts] = customerData.CustomerName?.trim()?.split(" ") || [];
//     const last_name = lastParts.join(" ");

//     //  Draft Order Payload
//     const payload = {
//       draft_order: {
//         email: customerData.Email,
//         billing_address: {
//           first_name,
//           last_name,
//           address1: billing.Line1 || "",
//           address2: billing.Line2 || "",
//           city: billing.City || "",
//           province: billing.State || "",
//           zip: billing.Postcode || "",
//           country: billing.Country || "",
//           phone: customerData.Phone || "",
//         },
//         shipping_address: {
//           first_name,
//           last_name,
//           address1: shipping.Line1 || "",
//           address2: shipping.Line2 || "",
//           city: shipping.City || "",
//           province: shipping.State || "",
//           zip: shipping.Postcode || "",
//           country: shipping.Country || "",
//           phone: customerData.Phone || "",
//         },
//         line_items: lineItems,
//         tags: tags.join(", "),
//         note_attributes: noteAttributes,
//       },
//     };

//     // ✅ Create Draft Order via Shopify REST API
//     const res = await fetch(
//       `https://${SHOPIFY_DOMAIN}/admin/api/2025-10/draft_orders.json`,
//       {
//         method: "POST",
//         headers: {
//           "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(payload),
//       }
//     );

//     const data = await res.json();
//     if (!res.ok) {
//       console.error("Shopify Error:", data);
//       throw new Error(JSON.stringify(data.errors || data));
//     }

//     console.log(`✅ Draft Order Created for ${customerData.Email}`);
//     return data.draft_order;
//   } catch (err) {
//     console.error("❌ Error creating draft order:", err.message);
//     return { success: false, message: err.message };
//   }
// }