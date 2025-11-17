export const handler = async () => {
  console.log("[Scheduler] Triggered update-sales-background...");

  const res = await fetch(`https://leather-gallery.netlify.app/.netlify/functions/update-sync-order-background`, {
    method: "GET",
  });

  const data = await res.text();
  console.log("[Scheduler] Background trigger response:", data);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Background update triggered" }),
  };
};
