const mongoose = require('mongoose');
const { Schema } = mongoose;
// Sub-schemas
const AddressSchema = new Schema({
  DisplayAddressLine1: String,
  DisplayAddressLine2: String,
  Line1: String,
  Line2: String,
  City: String,
  State: String,
  Postcode: String,
  Country: String,
  Company: String,
  Contact: String,
  ShipToOther: Boolean
}, { _id: false });
const QuoteLineSchema = new Schema({
  ProductID: String,
  SKU: String,
  Name: String,
  Quantity: Number,
  Price: mongoose.Schema.Types.Decimal128,
  Discount: mongoose.Schema.Types.Decimal128,
  Tax: mongoose.Schema.Types.Decimal128,
  AverageCost: mongoose.Schema.Types.Decimal128,
  TaxRule: String,
  Comment: String,
  Total: mongoose.Schema.Types.Decimal128,
  ProductLength: Number,
  ProductWidth: Number,
  ProductHeight: Number,
  ProductWeight: Number,
  WeightUnits: String,
  DimensionsUnits: String,
  ProductCustomField1: String,
  ProductCustomField2: String,
  ProductCustomField3: String,
  ProductCustomField4: String,
  ProductCustomField5: String,
  ProductCustomField6: String,
  ProductCustomField7: String,
  ProductCustomField8: String,
  ProductCustomField9: String,
  ProductCustomField10: String
}, { _id: false });
const QuoteSchema = new Schema({
  Memo: String,
  Status: String,
  Prepayments: { type: Array, default: [] },
  Lines: { type: [QuoteLineSchema], default: [] },
  AdditionalCharges: { type: Array, default: [] },
  TotalBeforeTax: mongoose.Schema.Types.Decimal128,
  Tax: mongoose.Schema.Types.Decimal128,
  Total: mongoose.Schema.Types.Decimal128
}, { _id: false });
const OrderSchema = new Schema({
  SaleOrderNumber: String,
  Memo: String,
  Status: String,
  Lines: { type: Array, default: [] },
  AdditionalCharges: { type: Array, default: [] },
  TotalBeforeTax: mongoose.Schema.Types.Decimal128,
  Tax: mongoose.Schema.Types.Decimal128,
  Total: mongoose.Schema.Types.Decimal128
}, { _id: false });
const AttachmentSchema = new Schema({
  ID: String,
  ContentType: String,
  FileName: String,
  DownloadUrl: String
}, { _id: false });
const ManualJournalsSchema = new Schema({
  Status: String,
  Lines: { type: Array, default: [] }
}, { _id: false });
const AdditionalAttributesSchema = new Schema({
  AdditionalAttribute1: String,
  AdditionalAttribute2: String,
  AdditionalAttribute3: String,
  AdditionalAttribute4: String,
  AdditionalAttribute5: String,
  AdditionalAttribute6: String,
  AdditionalAttribute7: String,
  AdditionalAttribute8: String,
  AdditionalAttribute9: String,
  AdditionalAttribute10: String
}, { _id: false });
// Top-level schema
const estimatedOrderSchema = new Schema({
  ID: { type: String, required: true, unique: true },
  Customer: String,
  CustomerID: String,
  Contact: String,
  Phone: String,
  Email: String,
  DefaultAccount: String,
  SkipQuote: Boolean,
  BillingAddress: AddressSchema,
  ShippingAddress: AddressSchema,
  ShippingNotes: String,
  BaseCurrency: String,
  CustomerCurrency: String,
  TaxRule: String,
  TaxCalculation: String,
  Terms: String,
  PriceTier: String,
  ShipBy: Date,
  Location: String,
  SaleOrderDate: Date,
  LastModifiedOn: Date,
  Note: String,
  CustomerReference: String,
  COGSAmount: mongoose.Schema.Types.Decimal128,
  Status: String,
  CombinedPickingStatus: String,
  CombinedPackingStatus: String,
  CombinedShippingStatus: String,
  FulFilmentStatus: String,
  CombinedInvoiceStatus: String,
  CombinedPaymentStatus: String,
  CombinedTrackingNumbers: Schema.Types.Mixed,
  Carrier: String,
  CurrencyRate: Number,
  SalesRepresentative: String,
  ServiceOnly: Boolean,
  Type: String,
  SourceChannel: String,
  Quote: QuoteSchema,
  Order: OrderSchema,
  Fulfilments: { type: Array, default: [] },
  Invoices: { type: Array, default: [] },
  CreditNotes: { type: Array, default: [] },
  ManualJournals: ManualJournalsSchema,
  ExternalID: String,
  AdditionalAttributes: AdditionalAttributesSchema,
  Attachments: { type: [AttachmentSchema], default: [] },
  InventoryMovements: { type: Array, default: [] },
  Transactions: { type: Array, default: [] }
}, { timestamps: true });
export default mongoose.models.estimatedOrder || mongoose.model("estimatedOrder", estimatedOrderSchema);