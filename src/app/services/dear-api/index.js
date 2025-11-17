const DEAR_API_BASE = "https://inventory.dearsystems.com/ExternalApi/v2";
const ACCOUNT_ID = process.env.DEAR_API_ACCOUNT_ID;
const APP_KEY = process.env.DEAR_API_APPLICATION_KEY;

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