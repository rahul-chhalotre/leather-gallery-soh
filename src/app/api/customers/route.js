// import { NextResponse } from "next/server";
// import { 
//   // getCustomer, 
//   syncCustomersSequentially, 
//   createDraftOrder 
// } from "../../services/shopify/index.js";

// ---------------- GET: Fetch customers from Cin7 ----------------
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
//     console.error("❌ Error fetching customers:", error);
//     return NextResponse.json(
//       { success: false, message: error.message },
//       { status: 500 }
//     );
//   }
// }

// ---------------- POST: Unified handler ----------------
// export async function POST() {
//   try {
//     // 👇 Call whichever function you want here.
//     // Example 1: Sync customers
//     const syncResult = await syncCustomersSequentially();

//     // Example 2: Create draft order afterwards (optional)
//     const draftOrder = await createDraftOrder();

//     return NextResponse.json({
//       success: true,
//       message: "Customers synced and draft order created successfully",
//       data: {
//         syncResult,
//         draftOrder,
//       },
//     });

//   } catch (error) {
//     console.error("❌ Error in unified POST handler:", error);
//     return NextResponse.json(
//       { success: false, message: error.message },
//       { status: 500 }
//     );
//   }
// }





