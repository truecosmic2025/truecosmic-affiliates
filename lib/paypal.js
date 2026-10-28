// PayPal Payouts API (https://developer.paypal.com/docs/api/payments.payouts-batch/v1/).
// Needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET; PAYPAL_MODE=sandbox for testing. PAYPAL_API_URL overrides the host (tests).
export function paypalConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function apiBase() {
  return process.env.PAYPAL_API_URL || (process.env.PAYPAL_MODE === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");
}

async function accessToken() {
  if (!paypalConfigured()) throw new Error("PayPal API credentials are not set (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return (await res.json()).access_token;
}

// items: [{ email, amount, senderItemId, note }]. senderBatchId makes the call idempotent: PayPal rejects a repeat.
export async function sendPayPalPayouts(items, settings, senderBatchId) {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": senderBatchId },
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: senderBatchId, email_subject: `${settings.siteName} affiliate payout`, email_message: "Thank you for promoting TrueCosmic Academy!" },
      items: items.map((i) => ({
        recipient_type: "EMAIL",
        receiver: i.email,
        amount: { value: Number(i.amount).toFixed(2), currency: settings.currency },
        sender_item_id: i.senderItemId,
        note: i.note || `${settings.siteName} affiliate commission`,
      })),
    }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal payout failed: ${json.message || json.name || res.status}`);
  return json.batch_header?.payout_batch_id;
}

// Returns [{ senderItemId, payoutItemId, status, error }]; status is PayPal's transaction_status
export async function getPayPalBatch(batchId) {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}/v1/payments/payouts/${encodeURIComponent(batchId)}?page_size=1000`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal status check failed: ${json.message || res.status}`);
  return (json.items || []).map((i) => ({
    senderItemId: i.payout_item?.sender_item_id,
    payoutItemId: i.payout_item_id,
    status: i.transaction_status,
    error: i.errors?.message || i.errors?.name || null,
  }));
}

export const PAYPAL_DONE = ["SUCCESS"];
export const PAYPAL_FAILED = ["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"];
