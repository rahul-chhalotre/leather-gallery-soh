// app/api/location/route.js

const API_AUTH_ACCOUNT_ID = "f8354924-2075-4fd3-8578-a64bf0b1b4c2";
const API_AUTH_APPLICATION_KEY = "f4daba60-021e-66e9-43c2-df6a73740a65";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const page = searchParams.get("page") || 1;
  const limit = searchParams.get("limit") || 1000;
  const deprecated = searchParams.get("deprecated") || false;
  const name = searchParams.get("name") || "";

  const url = `https://inventory.dearsystems.com/ExternalApi/v2/ref/location?Page=${page}&Limit=${limit}&Deprecated=${deprecated}&Name=${name}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "api-auth-accountid": API_AUTH_ACCOUNT_ID,
        "api-auth-applicationkey": API_AUTH_APPLICATION_KEY,
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Error fetching locations: ${response.statusText}` }),
        { status: response.status }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Location API fetch error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
