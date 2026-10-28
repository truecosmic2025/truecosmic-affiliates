import crypto from "node:crypto";
import { logEvent } from "./db";

// Shared-secret HMAC used in both directions between this app and the WordPress connector plugin.
export function sign(body) {
  return crypto.createHmac("sha256", process.env.WP_SHARED_SECRET || "").update(body).digest("hex");
}

export function verifySignature(body, signature) {
  if (!process.env.WP_SHARED_SECRET || !signature) return false;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Calls an endpoint exposed by the connector plugin at /wp-json/tc-affiliates/v1/<path>.
// The shop (WooCommerce: products, coupons, email) and the CRM (FluentCRM) can be separate WordPress
// installs, each running the connector: WP_SITE_URL is the shop, CRM_SITE_URL the CRM (defaults to the shop).
export async function callWordPress(path, data, { site: which = "store" } = {}) {
  const site = which === "crm" ? process.env.CRM_SITE_URL || process.env.WP_SITE_URL : process.env.WP_SITE_URL;
  if (!site) throw new Error("WP_SITE_URL is not set");
  const body = JSON.stringify(data);
  const res = await fetch(`${site.replace(/\/$/, "")}/wp-json/tc-affiliates/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-TC-Signature": sign(body) },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WordPress ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Mail goes out through WordPress (wp_mail) so it uses the site's existing SMTP setup and branding.
export async function sendMail(to, subject, html) {
  try {
    await callWordPress("mail", { to, subject, html });
    await logEvent("mail", "ok", `${subject} -> ${to}`);
    return true;
  } catch (e) {
    await logEvent("mail", "error", e.message, { to, subject });
    if (process.env.NODE_ENV !== "production") console.log(`[mail] to=${to} subject=${subject}\n${html}`);
    return false;
  }
}

const norm = (u) => String(u || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

// Shop events (orders, products, visits, sign-ups) are only accepted from the shop site (WP_SITE_URL).
// Connector 1.3.2+ sends X-TC-Site; older versions don't, and are allowed through.
export function fromShop(req) {
  const site = req.headers.get("x-tc-site");
  if (!site || !process.env.WP_SITE_URL) return true;
  return norm(site) === norm(process.env.WP_SITE_URL);
}
