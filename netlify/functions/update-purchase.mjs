export const handler = async (event, context) => {
  console.log("[Scheduler] Triggered update-purchase-background...");

  const res = await fetch(`https://leather-gallery.netlify.app/.netlify/functions/update-purchase-background`, {
    method: "POST",
  });

  const data = await res.text();
  console.log("[Scheduler] Background trigger response:", data);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Background update triggered" }),
  };
};
