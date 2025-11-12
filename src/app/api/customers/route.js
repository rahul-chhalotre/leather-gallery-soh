import { NextResponse } from "next/server";
import { getCustomerList, syncCustomersSequentially } from "../../services/shopify/index.js";

// ---------------- GET: Fetch customers from Cin7 ----------------
export async function GET() {
  try {
    const customers = await getCustomerList(); // only fetch
    return NextResponse.json({
      success: true,
      message: "Fetched customers from Cin7 successfully",
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error("❌ Error fetching customers:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// ---------------- POST: Sync customers one-by-one to Shopify ----------------
export async function POST() {
  try {
    const result = await syncCustomersSequentially(); // sequential sync
    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Error syncing customers to Shopify:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}











// import { NextResponse } from "next/server";
// import { getCustomer, syncCustomers } from "../../services/shopify/index.js";

// export async function GET() {
//   try {
//     const customers = await getCustomer();
//     return NextResponse.json({
//       success: true,
//       message: "Fetched customers from Cin7 successfully",
//       count: customers.length,
//       customers,
//     });
//   } catch (error) {
//     console.error("Error fetching customers:", error);
//     return NextResponse.json({ success: false, message: error.message }, { status: 500 });
//   }
// }

// export async function POST() {
//   try {
//     // Fetch customers from Cin7 and sync to Shopify
//     const customers = await getCustomer();
//     const result = await syncCustomers(customers);

//     return NextResponse.json(result);
//   } catch (error) {
//     console.error("Error syncing customers to Shopify:", error);
//     return NextResponse.json({ success: false, message: error.message }, { status: 500 });
//   }
// }