// PayPal Payouts API (https://developer.paypal.com/docs/api/payments.payouts-batch/v1/).
// Needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET; PAYPAL_MODE=sandbox for testing.
export function paypalConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export async function sendPayPalPayouts(items, settings) {
  if (!paypalConfigured()) throw new Error("PayPal API credentials are not set (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
  const base = process.env.PAYPAL_MODE === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) throw new Error(`PayPal auth failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();
  const batchId = `tca-${Date.now()}`;
  const res = await fetch(`${base}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: batchId, email_subject: `${settings.siteName} affiliate commission`, email_message: "Thank you for promoting us!" },
      items: items.map((i) => ({
        recipient_type: "EMAIL",
        receiver: i.email,
        amount: { value: Number(i.amount).toFixed(2), currency: settings.currency },
        sender_item_id: i.id,
        note: `${settings.siteName} affiliate commission`,
      })),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal payout failed: ${json.message || res.status}`);
  return json.batch_header?.payout_batch_id || batchId;
}
