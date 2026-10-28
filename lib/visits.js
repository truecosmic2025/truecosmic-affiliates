import crypto from "node:crypto";
import { prisma } from "./db";

export function hashIp(ip) {
  return ip ? crypto.createHash("sha256").update(ip + (process.env.SESSION_SECRET || "")).digest("hex").slice(0, 32) : null;
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function pathOf(url) {
  try {
    const p = new URL(url).pathname;
    return p.endsWith("/") ? p : p + "/";
  } catch {
    return null;
  }
}

export async function recordVisit(affiliate, { url, referrer, campaign, ip, source = "link", flagged = null }) {
  const ipHash = hashIp(ip);
  // De-dupe refreshes: same visitor + affiliate within 30 minutes counts once
  if (ipHash) {
    const recent = await prisma.visit.findFirst({
      where: { affiliateId: affiliate.id, ipHash, createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return recent;
  }
  return prisma.visit.create({
    data: { affiliateId: affiliate.id, url: url?.slice(0, 500), referrer: referrer?.slice(0, 500), campaign: campaign?.slice(0, 100), ipHash, source, flagged },
  });
}

// Data the WordPress plugin caches so it only phones home when a visit can actually be credited
export async function trackingConfig(settings) {
  const [landing, direct] = await Promise.all([
    settings.landingPages ? prisma.landingPage.findMany({ include: { affiliate: { select: { status: true } } } }) : [],
    settings.directLinkTracking ? prisma.directLink.findMany({ where: { status: "approved" }, include: { affiliate: { select: { status: true } } } }) : [],
  ]);
  return {
    referral_var: settings.referralVar,
    cookie_days: settings.cookieDays,
    credit_last: !!settings.creditLastReferrer,
    landing_paths: landing.filter((l) => l.affiliate.status === "ACTIVE").map((l) => l.path),
    direct_domains: direct.filter((d) => d.affiliate.status === "ACTIVE").map((d) => d.domain),
    signup_referrals: Number(settings.signupReferralAmount) > 0,
    auto_register_customers: !!settings.autoRegisterCustomers,
  };
}
