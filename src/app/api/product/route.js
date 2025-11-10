const API_AUTH_ACCOUNT_ID = "f8354924-2075-4fd3-8578-a64bf0b1b4c2";
const API_AUTH_APPLICATION_KEY = "f4daba60-021e-66e9-43c2-df6a73740a65";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const includeBOM = searchParams.get("IncludeBOM") || "true";

  if (!id) {
    return new Response(JSON.stringify({ error: "Product ID is required" }), {
      status: 400,
    });
  }

  const url = `https://inventory.dearsystems.com/ExternalApi/v2/product?ID=${id}&IncludeBOM=${includeBOM}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "api-auth-accountid": API_AUTH_ACCOUNT_ID,
        "api-auth-applicationkey": API_AUTH_APPLICATION_KEY,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch BOM data: ${response.statusText}` }),
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("response",data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dear Product API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
