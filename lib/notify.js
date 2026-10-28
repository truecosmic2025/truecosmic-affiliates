import crypto from "node:crypto";
import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { sendMail } from "./wp";
import { affiliateLink, fullName } from "./format";

import { render } from "./notify-render.mjs";
export { render };

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Sends one of the editable email templates (Settings → Emails). Empty subject = template switched off.
export async function sendTemplate(key, to, affiliate, extra = {}) {
  const s = await getSettings();
  const t = s.emails?.[key];
  if (!t?.subject || !to) return false;
  const app = process.env.APP_URL || "";
  const vars = {
    site: s.siteName,
    login_url: `${app}/login`,
    dashboard_url: `${app}/dashboard`,
    ...(affiliate
      ? {
          name: escapeHtml(fullName(affiliate)),
          first_name: escapeHtml(affiliate.firstName || "there"),
          email: escapeHtml(affiliate.email),
          link: affiliateLink(s, affiliate),
          code: affiliate.code,
          admin_url: `${app}/admin/affiliates/${affiliate.id}`,
        }
      : {}),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, escapeHtml(v)])),
  };
  return sendMail(to, render(t.subject, vars).replace(/&amp;/g, "&"), render(t.body, vars));
}

export async function notifyAdmin(key, affiliate, extra) {
  if (process.env.ADMIN_EMAIL) await sendTemplate(key, process.env.ADMIN_EMAIL, affiliate, extra);
}

// Outgoing webhooks (Settings → API & webhooks) for Make, Zapier, n8n, etc.
export async function fireWebhooks(event, data) {
  const hooks = await prisma.webhook.findMany({ where: { active: true } });
  for (const h of hooks.filter((h) => h.events.includes("*") || h.events.includes(event))) {
    const body = JSON.stringify({ event, data, sent_at: new Date().toISOString() });
    try {
      const res = await fetch(h.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TC-Event": event, "X-TC-Signature": crypto.createHmac("sha256", h.secret).update(body).digest("hex") },
        body,
        signal: AbortSignal.timeout(8000),
      });
      await logEvent(`webhook-out:${event}`, res.ok ? "ok" : "error", `${h.url} -> ${res.status}`);
    } catch (e) {
      await logEvent(`webhook-out:${event}`, "error", `${h.url}: ${e.message}`);
    }
  }
}

// Plain JSON for API responses and webhooks
export function affiliateJson(a) {
  return {
    id: a.id, legacy_id: a.legacyId, code: a.code, email: a.email, first_name: a.firstName, last_name: a.lastName,
    payment_email: a.paymentEmail, status: a.status.toLowerCase(), rate_type: a.rateType?.toLowerCase() ?? null,
    rate: a.rate != null ? Number(a.rate) : null, group_id: a.groupId, parent_id: a.parentId, coupons: a.coupons, created_at: a.createdAt,
  };
}

export function referralJson(r) {
  return {
    id: r.id, affiliate_id: r.affiliateId, order_id: r.orderId, amount: Number(r.amount), order_total: Number(r.orderTotal),
    currency: r.currency, status: r.status.toLowerCase(), type: r.type, source: r.source, tier_level: r.tierLevel,
    description: r.description, customer_email: r.customerEmail, campaign: r.campaign, created_at: r.createdAt,
  };
}
