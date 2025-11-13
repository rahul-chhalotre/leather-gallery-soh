

create a post request for processing orders
accept the sale_ids array in the request body
if sale_ids are empty or is not an array then return 400 with missing data error
call processOrders(sale_ids) import from shopify/index.js

under this processOrders
iterate or loop through sale_ids

sale_id
findrecord in mongodb estimated order with status "estimating"
if not found continue with next sale_id

if found
const sale = findrecord(sale_id)

const customerEmail = sale.customerEmail
const customer = findCustomer(customerEmail)

if customer
else create customer in shopify and get customerId

then continue with quote line items from sale to get variants

get variants and create lineItems payload to create draft order

create draft order
const order = createShopifyOrder(payload of lineItems or any required data)

create invoice using order

save customerId draftOrder ID, sale_id, invoice id or url, variants  data with sku and quantity to estimated order record,
