

const API_AUTH_ACCOUNT_ID = "f8354924-2075-4fd3-8578-a64bf0b1b4c2";
const API_AUTH_APPLICATION_KEY = "f4daba60-021e-66e9-43c2-df6a73740a65";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const page = searchParams.get("page") || 1;
  const limit = searchParams.get("limit") || 100;
  const skuSearch = searchParams.get("sku") || "";
  const location = searchParams.get("location") || "";
  const nameSearch = searchParams.get("name") || "";

  const url = `https://inventory.dearsystems.com/ExternalApi/v2/ref/productavailability?Page=${page}&Limit=${limit}&SKU=${skuSearch}&Location=${location}&Name=${nameSearch}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "api-auth-accountid": API_AUTH_ACCOUNT_ID,
        "api-auth-applicationkey": API_AUTH_APPLICATION_KEY,
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch data: ${response.statusText}` }), {
        status: response.status,
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Product Availability API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
