// How each affiliate wants to be paid. PayPal is paid automatically through the API;
// Wise, Payoneer and Other are exported and confirmed by an admin.
export const METHODS = {
  paypal: { label: "PayPal", fields: [{ key: "email", label: "PayPal email", type: "email", required: true }] },
  wise: {
    label: "Wise",
    fields: [
      { key: "name", label: "Account holder name (as on Wise)", required: true },
      { key: "email", label: "Wise account email", type: "email", required: true },
      { key: "currency", label: "Receive in", options: ["USD", "GBP", "EUR", "CAD", "AUD"], required: true },
    ],
  },
  payoneer: { label: "Payoneer", fields: [{ key: "email", label: "Payoneer account email", type: "email", required: true }] },
  other: { label: "Other", fields: [{ key: "instructions", label: "How should we pay you?", textarea: true, required: true }] },
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Returns { method, details } or { error }
export function validateDetails(method, get) {
  const m = METHODS[method];
  if (!m) return { error: "Choose a payout method." };
  const details = {};
  for (const f of m.fields) {
    const v = String(get(f.key) || "").trim().slice(0, f.textarea ? 1000 : 200);
    if (f.required && !v) return { error: `${f.label} is required.` };
    if (f.type === "email" && v && !EMAIL.test(v)) return { error: `${f.label} doesn't look like an email address.` };
    if (f.options && v && !f.options.includes(v)) return { error: `Choose a valid option for ${f.label}.` };
    details[f.key] = f.type === "email" ? v.toLowerCase() : v;
  }
  return { method, details };
}

// Where a payout goes right now. PayPal uses paymentEmail so admin edits and imports keep working.
export function payTo(a) {
  const method = METHODS[a.payoutMethod] ? a.payoutMethod : "paypal";
  const details = { ...(a.payoutDetails && typeof a.payoutDetails === "object" ? a.payoutDetails : {}) };
  if (method === "paypal") details.email = a.paymentEmail || details.email || a.email;
  return { method, details };
}

export function describe({ method, details }) {
  const d = details || {};
  if (method === "wise") return `Wise · ${d.name || "?"} · ${d.email || "?"} · ${d.currency || "USD"}`;
  if (method === "other") return `Other · ${d.instructions || ""}`;
  return `${METHODS[method]?.label || method} · ${d.email || "?"}`;
}
