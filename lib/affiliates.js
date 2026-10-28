import { prisma, logEvent } from "./db";
import { slugify } from "./format";
import { syncAffiliateToCrm } from "./crm";
import { callWordPress } from "./wp";
import { getSettings } from "./settings";
import { sendTemplate, fireWebhooks, affiliateJson } from "./notify";

// Resolves a ?ref= value: affiliate code, or the old numeric AffiliateWP id so existing links keep working.
export async function findAffiliateByRef(ref) {
  if (!ref) return null;
  const value = String(ref).trim();
  let a = await prisma.affiliate.findFirst({ where: { code: { equals: value, mode: "insensitive" } } });
  if (!a) a = await prisma.affiliate.findFirst({ where: { aliases: { has: value.toLowerCase() } } });
  if (!a && /^\d+$/.test(value)) a = await prisma.affiliate.findUnique({ where: { legacyId: Number(value) } });
  return a;
}

export async function findAffiliateByCoupon(codes = []) {
  const wanted = codes.map((c) => String(c).toLowerCase());
  if (!wanted.length) return null;
  const all = await prisma.affiliate.findMany({ where: { coupons: { isEmpty: false } } });
  return all.find((a) => a.coupons.some((c) => wanted.includes(c.toLowerCase()))) || null;
}

export async function uniqueCode(base) {
  let root = slugify(base) || "partner";
  let code = root;
  let i = 1;
  while (await prisma.affiliate.findUnique({ where: { code } })) code = `${root}-${++i}`;
  return code;
}

// Creates a WooCommerce coupon for the affiliate (AffiliateWP "dynamic coupons")
export async function createAffiliateCoupon(affiliate) {
  const s = await getSettings();
  const code = `${affiliate.code}${s.couponDiscountType === "percent" ? s.couponAmount : ""}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  try {
    await callWordPress("coupons/create", { code, discount_type: s.couponDiscountType, amount: s.couponAmount, affiliate_code: affiliate.code });
    const a = await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { dynamicCoupon: code, coupons: Array.from(new Set([...affiliate.coupons, code])) },
    });
    await logEvent("coupon:created", "ok", `${code} for ${affiliate.code}`);
    return a;
  } catch (e) {
    await logEvent("coupon:created", "error", `${affiliate.code}: ${e.message}`);
    return affiliate;
  }
}

export async function setAffiliateStatus(id, status, { reason } = {}) {
  const before = await prisma.affiliate.findUnique({ where: { id } });
  let a = await prisma.affiliate.update({ where: { id }, data: { status, ...(status === "REJECTED" ? { rejectionReason: reason || null } : {}) } });
  await logEvent("affiliate:status", "ok", `${a.email} ${before.status} -> ${status}`);
  if (before.status !== "ACTIVE" && status === "ACTIVE") await onActivated(a);
  if (status === "REJECTED" && before.status !== "REJECTED") await sendTemplate("rejected", a.email, a, { reason: reason || "" });
  await fireWebhooks("affiliate.updated", affiliateJson(a));
  await syncAffiliateToCrm(a.id);
  return a;
}

export async function onActivated(a) {
  const s = await getSettings();
  if (s.autoCreateCoupons && !a.dynamicCoupon) a = await createAffiliateCoupon(a);
  await sendTemplate("approved", a.email, a);
  await fireWebhooks("affiliate.approved", affiliateJson(a));
  const { checkBonuses } = await import("./referrals");
  await checkBonuses(a, { signup: true });
}
