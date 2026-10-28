"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, logEvent } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { saveSettings, getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { setAffiliateStatus, createAffiliateCoupon } from "@/lib/affiliates";
import { registerAffiliate, RegistrationError } from "@/lib/registration";
import { syncAffiliateToCrm } from "@/lib/crm";
import { importAffiliates, importReferrals } from "@/lib/importer";
import { callWordPress, sendMail } from "@/lib/wp";
import { sendTemplate, fireWebhooks, referralJson } from "@/lib/notify";
import { approveRun, markGroupPaid, markPaid, releasePayout, syncPayPalRun, manualPayout } from "@/lib/payruns";
import { slugify, money } from "@/lib/format";
import { domainOf } from "@/lib/visits";
import { payableWhere } from "@/lib/payouts";
import { staffReply, accountsContact } from "@/lib/disputes";
import { PRESETS, SCOPES } from "@/lib/apiauth";

const str = (f, k) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};
const rateFields = (f, prefix = "") => {
  const rate = str(f, prefix + "rate");
  const rateType = str(f, prefix + "rateType");
  return rate && rateType ? { rate: Number(rate), rateType } : { rate: null, rateType: null };
};

// ---------- Affiliates ----------
export async function createAffiliate(f) {
  await requireAdmin();
  let a;
  try {
    a = await registerAffiliate(
      {
        email: str(f, "email"), firstName: str(f, "firstName"), lastName: str(f, "lastName"), paymentEmail: str(f, "paymentEmail"),
        code: str(f, "code"), groupId: str(f, "groupId"), parentRef: str(f, "parentRef"), ...rateFields(f),
      },
      { byAdmin: true, status: str(f, "status") || "ACTIVE" }
    );
  } catch (e) {
    if (e instanceof RegistrationError) redirect(`/admin/affiliates/new?error=${e.message}`);
    throw e;
  }
  redirect(`/admin/affiliates/${a.id}`);
}

export async function updateAffiliate(id, f) {
  await requireAdmin();
  const code = slugify(str(f, "code"));
  const clash = code && (await prisma.affiliate.findFirst({ where: { code, NOT: { id } } }));
  if (clash) redirect(`/admin/affiliates/${id}?error=code`);
  const parentId = str(f, "parentId");
  if (parentId === id) redirect(`/admin/affiliates/${id}?error=parent`);
  const before = await prisma.affiliate.findUnique({ where: { id } });
  await prisma.affiliate.update({
    where: { id },
    data: {
      firstName: str(f, "firstName"),
      lastName: str(f, "lastName"),
      paymentEmail: str(f, "paymentEmail"),
      website: str(f, "website"),
      notes: str(f, "notes"),
      groupId: str(f, "groupId"),
      parentId,
      emailOnReferral: f.get("emailOnReferral") === "on",
      coupons: (str(f, "coupons") || "").split(",").map((c) => c.trim()).filter(Boolean),
      aliases: [...new Set((str(f, "aliases") || "").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean))].filter((v) => v !== (code || before.code)),
      ...(code ? { code } : {}),
      ...rateFields(f),
    },
  });
  const status = str(f, "status");
  if (status && status !== before.status) await setAffiliateStatus(id, status, { reason: str(f, "rejectionReason") });
  else await syncAffiliateToCrm(id);
  revalidatePath(`/admin/affiliates/${id}`);
  redirect(`/admin/affiliates/${id}?saved=1`);
}

export async function changeAffiliateStatus(id, status) {
  await requireAdmin();
  await setAffiliateStatus(id, status);
  revalidatePath("/admin/affiliates");
  revalidatePath(`/admin/affiliates/${id}`);
}

export async function rejectAffiliate(id, f) {
  await requireAdmin();
  await setAffiliateStatus(id, "REJECTED", { reason: str(f, "reason") });
  redirect(`/admin/affiliates/${id}`);
}

export async function bulkAffiliates(f) {
  await requireAdmin();
  const ids = f.getAll("ids").map(String);
  const action = str(f, "bulk");
  if (!ids.length || !action) redirect("/admin/affiliates");
  if (action === "delete") await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
  else if (action === "crm") for (const id of ids) await syncAffiliateToCrm(id);
  else if (action.startsWith("group:")) await prisma.affiliate.updateMany({ where: { id: { in: ids } }, data: { groupId: action.slice(6) || null } });
  else for (const id of ids) await setAffiliateStatus(id, action);
  await logEvent("affiliates:bulk", "ok", `${action} x${ids.length}`);
  revalidatePath("/admin/affiliates");
  redirect(`/admin/affiliates?bulk=${ids.length}`);
}

export async function deleteAffiliate(id) {
  await requireAdmin();
  await prisma.affiliate.delete({ where: { id } });
  await logEvent("affiliate:deleted", "ok", id);
  redirect("/admin/affiliates");
}

export async function generateCoupon(id) {
  await requireAdmin();
  const a = await prisma.affiliate.findUnique({ where: { id } });
  await createAffiliateCoupon(a);
  revalidatePath(`/admin/affiliates/${id}`);
}

export async function setAffiliateProductRate(affiliateId, f) {
  await requireAdmin();
  const productId = str(f, "productId");
  const { rate, rateType } = rateFields(f);
  if (!productId) return;
  if (rate == null) await prisma.affiliateProductRate.deleteMany({ where: { affiliateId, productId } });
  else await prisma.affiliateProductRate.upsert({ where: { affiliateId_productId: { affiliateId, productId } }, create: { affiliateId, productId, rate, rateType }, update: { rate, rateType } });
  revalidatePath(`/admin/affiliates/${affiliateId}`);
}

export async function removeAffiliateProductRate(id, affiliateId) {
  await requireAdmin();
  await prisma.affiliateProductRate.delete({ where: { id } });
  revalidatePath(`/admin/affiliates/${affiliateId}`);
}

export async function addLandingPage(affiliateId, f) {
  await requireAdmin();
  let path = str(f, "path") || "";
  try { path = new URL(path, "https://x.invalid").pathname; } catch {}
  if (!path.endsWith("/")) path += "/";
  if (path === "/") redirect(`/admin/affiliates/${affiliateId}?error=landing`);
  const taken = await prisma.landingPage.findUnique({ where: { path } });
  if (taken) redirect(`/admin/affiliates/${affiliateId}?error=landing`);
  await prisma.landingPage.create({ data: { path, affiliateId } });
  revalidatePath(`/admin/affiliates/${affiliateId}`);
}

export async function removeLandingPage(id, affiliateId) {
  await requireAdmin();
  await prisma.landingPage.delete({ where: { id } });
  revalidatePath(`/admin/affiliates/${affiliateId}`);
}

export async function setDirectLinkStatus(id, status) {
  await requireAdmin();
  await prisma.directLink.update({ where: { id }, data: { status } });
  revalidatePath("/admin/direct-links");
}

export async function addDirectLink(affiliateId, f) {
  await requireAdmin();
  const domain = domainOf(/^https?:/.test(str(f, "domain") || "") ? str(f, "domain") : `https://${str(f, "domain")}`);
  if (domain && !(await prisma.directLink.findUnique({ where: { domain } }))) await prisma.directLink.create({ data: { domain, affiliateId, status: "approved" } });
  revalidatePath(`/admin/affiliates/${affiliateId}`);
}

export async function syncAllAffiliatesToCrm() {
  await requireAdmin();
  const all = await prisma.affiliate.findMany({ select: { id: true } });
  for (const a of all) await syncAffiliateToCrm(a.id);
  redirect(`/admin/settings?crm=${all.length}`);
}

// ---------- Referrals ----------
export async function setReferralStatus(id, status) {
  await requireAdmin();
  const r = await prisma.referral.update({ where: { id }, data: { status } });
  await logEvent("referral:status", "ok", `${id} -> ${status}`);
  await fireWebhooks("referral.updated", referralJson(r));
  await syncAffiliateToCrm(r.affiliateId);
  revalidatePath("/admin/referrals");
}

export async function bulkReferrals(f) {
  await requireAdmin();
  const ids = f.getAll("ids").map(String);
  const status = str(f, "bulk");
  if (ids.length && ["UNPAID", "REJECTED", "PENDING", "PAID"].includes(status)) {
    await prisma.referral.updateMany({ where: { id: { in: ids } }, data: { status } });
    const affs = await prisma.referral.findMany({ where: { id: { in: ids } }, distinct: ["affiliateId"], select: { affiliateId: true } });
    for (const a of affs) await syncAffiliateToCrm(a.affiliateId);
    await logEvent("referrals:bulk", "ok", `${status} x${ids.length}`);
  }
  revalidatePath("/admin/referrals");
}

export async function addManualReferral(f) {
  await requireAdmin();
  const affiliateId = str(f, "affiliateId");
  const s = await getSettings();
  const r = await prisma.referral.create({
    data: {
      affiliateId, amount: Number(str(f, "amount") || 0), description: str(f, "description"), orderId: str(f, "orderId"),
      currency: s.currency, status: "UNPAID", source: "manual", type: str(f, "type") || "sale",
    },
  });
  await fireWebhooks("referral.created", referralJson(r));
  await syncAffiliateToCrm(affiliateId);
  redirect("/admin/referrals");
}

// ---------- Payouts ----------
export async function approvePayRun(f) {
  const admin = await requireAdmin();
  const ids = f.getAll("affiliateId").map(String);
  const { run, error, paypalError } = await approveRun(admin.email, ids);
  if (error) redirect(`/admin/payouts?error=${encodeURIComponent(error)}`);
  redirect(`/admin/payouts?run=${run.id}${paypalError ? `&error=${encodeURIComponent(`PayPal group not sent and returned to the balance: ${paypalError.slice(0, 200)}`)}` : ""}`);
}

export async function payRunGroupPaid(runId, method, f) {
  await requireAdmin();
  const n = await markGroupPaid(runId, method, str(f, "reference"));
  redirect(`/admin/payouts?marked=${n}`);
}

export async function payoutPaid(id, f) {
  await requireAdmin();
  await markPaid(id, str(f, "reference"));
  revalidatePath("/admin/payouts");
}

export async function payoutFailed(id, f) {
  await requireAdmin();
  await releasePayout(id, str(f, "reason") || "Payment was not accepted");
  redirect("/admin/payouts?failed=1");
}

export async function checkPayPalRun(runId) {
  await requireAdmin();
  let target;
  try {
    const r = await syncPayPalRun(runId);
    target = r.error ? `/admin/payouts?error=${encodeURIComponent(r.error)}` : `/admin/payouts?synced=${r.paid}-${r.failed}-${r.waiting}`;
  } catch (e) {
    target = `/admin/payouts?error=${encodeURIComponent(e.message.slice(0, 200))}`;
  }
  redirect(target);
}

export async function createManualPayout(f) {
  const admin = await requireAdmin();
  const r = await manualPayout({
    affiliateId: str(f, "affiliateId"), amount: str(f, "amount"), method: str(f, "method") || "paypal", reference: str(f, "reference"),
    reason: str(f, "reason"), approvedBy: admin.email, sendViaPayPal: f.get("sendViaPayPal") === "on" && str(f, "method") === "paypal",
  });
  if (r.error) redirect(`/admin/payouts?error=${encodeURIComponent(r.error)}#manual`);
  redirect(`/admin/payouts?manual=1`);
}

// ---------- Products ----------
export async function updateProduct(id, f) {
  await requireAdmin();
  await prisma.product.update({
    where: { id },
    data: { commissionEnabled: f.get("commissionEnabled") === "on", kind: str(f, "kind") || "other", coach: str(f, "coach"), ...rateFields(f) },
  });
  revalidatePath("/admin/products");
}

export async function requestProductSync() {
  await requireAdmin();
  let target;
  try {
    const res = await callWordPress("sync-products", {});
    await logEvent("product:sync-request", "ok", JSON.stringify(res));
    target = `/admin/products?synced=${res.count ?? 0}`;
  } catch (e) {
    await logEvent("product:sync-request", "error", e.message);
    target = "/admin/products?syncError=1";
  }
  redirect(target);
}

// ---------- Commission rules: groups, category rates, tiers, bonuses ----------
export async function saveGroup(f) {
  await requireAdmin();
  const id = str(f, "id");
  const isDefault = f.get("isDefault") === "on";
  if (isDefault) await prisma.affiliateGroup.updateMany({ data: { isDefault: false } });
  const data = { name: str(f, "name") || "Group", isDefault, ...rateFields(f) };
  if (id) await prisma.affiliateGroup.update({ where: { id }, data });
  else await prisma.affiliateGroup.create({ data });
  revalidatePath("/admin/rules");
}

export async function deleteGroup(id) {
  await requireAdmin();
  await prisma.affiliateGroup.delete({ where: { id } });
  revalidatePath("/admin/rules");
}

export async function saveCategoryRate(f) {
  await requireAdmin();
  const category = str(f, "category");
  const { rate, rateType } = rateFields(f);
  if (!category || rate == null) return;
  await prisma.categoryRate.upsert({ where: { category }, create: { category, rate, rateType }, update: { rate, rateType } });
  revalidatePath("/admin/rules");
}

export async function deleteCategoryRate(id) {
  await requireAdmin();
  await prisma.categoryRate.delete({ where: { id } });
  revalidatePath("/admin/rules");
}

export async function saveTier(f) {
  await requireAdmin();
  const { rate, rateType } = rateFields(f);
  if (rate == null) return;
  await prisma.rateTier.create({ data: { metric: str(f, "metric") || "earnings", threshold: Number(str(f, "threshold") || 0), rate, rateType } });
  revalidatePath("/admin/rules");
}

export async function deleteTier(id) {
  await requireAdmin();
  await prisma.rateTier.delete({ where: { id } });
  revalidatePath("/admin/rules");
}

export async function saveBonus(f) {
  await requireAdmin();
  await prisma.bonus.create({ data: { name: str(f, "name") || "Bonus", metric: str(f, "metric") || "referrals", threshold: Number(str(f, "threshold") || 0), amount: Number(str(f, "amount") || 0) } });
  revalidatePath("/admin/rules");
}

export async function toggleBonus(id, active) {
  await requireAdmin();
  await prisma.bonus.update({ where: { id }, data: { active } });
  revalidatePath("/admin/rules");
}

// ---------- Creatives ----------
export async function saveCreative(f) {
  await requireAdmin();
  const id = str(f, "id");
  const data = {
    name: str(f, "name") || "Untitled", description: str(f, "description"), url: str(f, "url") || "", imageUrl: str(f, "imageUrl"),
    text: str(f, "text"), type: str(f, "type") || "image", groupIds: f.getAll("groupIds").map(String).filter(Boolean), active: f.get("active") !== "off",
  };
  if (id) await prisma.creative.update({ where: { id }, data });
  else await prisma.creative.create({ data });
  revalidatePath("/admin/creatives");
}

export async function deleteCreative(id) {
  await requireAdmin();
  await prisma.creative.delete({ where: { id } });
  revalidatePath("/admin/creatives");
}

// ---------- Settings ----------
export async function updateSettings(f) {
  await requireAdmin();
  const bool = (k) => f.get(k) === "on";
  const n = (k, d = 0) => (str(f, k) == null ? d : Number(str(f, k)));
  await saveSettings({
    siteName: str(f, "siteName"),
    academyUrl: str(f, "academyUrl"),
    currency: str(f, "currency"),
    storeCurrency: str(f, "storeCurrency") || "GBP",
    fxFallbackRate: str(f, "fxFallbackRate") == null ? null : n("fxFallbackRate"),
    referralVar: slugify(str(f, "referralVar")) || "ref",
    cookieDays: n("cookieDays", 30),
    defaultRateType: str(f, "defaultRateType"),
    defaultRate: n("defaultRate"),
    minimumPayout: n("minimumPayout"),
    payoutDay: Math.min(Math.max(n("payoutDay", 1), 1), 28),
    holdDays: Math.max(n("holdDays", 30), 0),
    newCustomersOnly: bool("newCustomersOnly"),
    accountsName: str(f, "accountsName") || "Accounts",
    accountsEmail: str(f, "accountsEmail") || "",
    autoApproveAffiliates: bool("autoApproveAffiliates"),
    referralsStartPending: bool("referralsStartPending"),
    newProductsEarnCommission: bool("newProductsEarnCommission"),
    allowSelfReferral: bool("allowSelfReferral"),
    crmEnabled: bool("crmEnabled"),
    crmAffiliateTag: str(f, "crmAffiliateTag"),
    crmReferredCustomerTag: str(f, "crmReferredCustomerTag"),
    crmListName: str(f, "crmListName"),
    creditLastReferrer: str(f, "credit") !== "first",
    directLinkTracking: bool("directLinkTracking"),
    landingPages: bool("landingPages"),
    flagPpcTraffic: bool("flagPpcTraffic"),
    flatRateBasis: str(f, "flatRateBasis") || "product",
    includeShipping: bool("includeShipping"),
    includeTax: bool("includeTax"),
    ignoreZeroReferrals: bool("ignoreZeroReferrals"),
    eventsNeedAgreedRate: bool("eventsNeedAgreedRate"),
    lifetimeCommissions: bool("lifetimeCommissions"),
    lifetimeRateType: str(f, "lifetimeRateType") || "",
    lifetimeRate: str(f, "lifetimeRate") == null ? null : n("lifetimeRate"),
    recurringReferrals: bool("recurringReferrals"),
    recurringRateType: str(f, "recurringRateType") || "",
    recurringRate: str(f, "recurringRate") == null ? null : n("recurringRate"),
    multiTier: bool("multiTier"),
    tierRates: (str(f, "tierRates") || "").split(",").map((x) => Number(x.trim())).filter((x) => x > 0).slice(0, 5),
    signupReferralAmount: n("signupReferralAmount"),
    requireTerms: bool("requireTerms"),
    termsUrl: str(f, "termsUrl") || "",
    registrationFields: f.getAll("registrationFields").map(String),
    maxSignupsPerIpPerDay: n("maxSignupsPerIpPerDay", 3),
    autoRegisterCustomers: bool("autoRegisterCustomers"),
    autoCreateCoupons: bool("autoCreateCoupons"),
    couponDiscountType: str(f, "couponDiscountType") || "percent",
    couponAmount: n("couponAmount", 10),
    wiseSourceCurrency: str(f, "wiseSourceCurrency") || "GBP",
    wiseColumns: str(f, "wiseColumns") || DEFAULT_SETTINGS.wiseColumns,
    showLeaderboard: bool("showLeaderboard"),
    leaderboardSize: n("leaderboardSize", 10),
    showCustomerDetails: bool("showCustomerDetails"),
  });
  redirect(`/admin/settings?saved=1#${str(f, "section") || ""}`);
}

export async function updateEmails(f) {
  await requireAdmin();
  const emails = {};
  for (const key of Object.keys(DEFAULT_SETTINGS.emails)) {
    emails[key] = { subject: String(f.get(`${key}.subject`) ?? "").trim(), body: String(f.get(`${key}.body`) ?? "") };
  }
  await saveSettings({ emails });
  redirect("/admin/emails?saved=1");
}

export async function sendTestEmail(key) {
  const admin = await requireAdmin();
  const sample = { id: "sample", firstName: "Sample", lastName: "Affiliate", email: admin.email, code: "sample" };
  await sendTemplate(key, admin.email, sample, { amount: "$25.00", products: "Sample Course", reason: "Sample reason", method: "PayPal" });
  redirect(`/admin/emails?tested=${key}`);
}

// ---------- API keys & outgoing webhooks ----------
export async function createApiKey(f) {
  await requireAdmin();
  const raw = `tca_${crypto.randomBytes(24).toString("hex")}`;
  const preset = PRESETS[str(f, "preset")] || PRESETS.accounts;
  await prisma.apiKey.create({ data: { name: str(f, "name") || "API key", keyHash: crypto.createHash("sha256").update(raw).digest("hex"), prefix: raw.slice(0, 12), scopes: preset.scopes } });
  redirect(`/admin/api?newkey=${raw}`);
}

export async function deleteApiKey(id) {
  await requireAdmin();
  await prisma.apiKey.delete({ where: { id } });
  revalidatePath("/admin/api");
}

export async function createWebhook(f) {
  await requireAdmin();
  const url = str(f, "url");
  if (!url || !/^https:\/\//.test(url)) redirect("/admin/api?error=url");
  const events = f.getAll("events").map(String);
  await prisma.webhook.create({ data: { url, events: events.length ? events : ["*"], secret: crypto.randomBytes(16).toString("hex") } });
  revalidatePath("/admin/api");
}

export async function deleteWebhook(id) {
  await requireAdmin();
  await prisma.webhook.delete({ where: { id } });
  revalidatePath("/admin/api");
}

export async function testWebhook(id) {
  await requireAdmin();
  const h = await prisma.webhook.findUnique({ where: { id } });
  const body = JSON.stringify({ event: "test", data: { hello: "from TrueCosmic Affiliates" }, sent_at: new Date().toISOString() });
  try {
    const res = await fetch(h.url, { method: "POST", headers: { "Content-Type": "application/json", "X-TC-Event": "test", "X-TC-Signature": crypto.createHmac("sha256", h.secret).update(body).digest("hex") }, body, signal: AbortSignal.timeout(8000) });
    await logEvent("webhook-out:test", res.ok ? "ok" : "error", `${h.url} -> ${res.status}`);
  } catch (e) {
    await logEvent("webhook-out:test", "error", `${h.url}: ${e.message}`);
  }
  redirect("/admin/logs");
}

// ---------- Import ----------
export async function runImport(prevState, f) {
  await requireAdmin();
  const type = str(f, "type");
  const file = f.get("file");
  if (!file || typeof file === "string" || !file.size) return { error: "Choose a CSV file first." };
  const text = await file.text();
  const dryRun = f.get("dryRun") === "on";
  const result = type === "referrals" ? await importReferrals(text, { dryRun }) : await importAffiliates(text, { dryRun });
  if (!dryRun && type === "affiliates" && f.get("syncCrm") === "on") {
    const all = await prisma.affiliate.findMany({ where: { notes: "Imported from AffiliateWP" }, select: { id: true } });
    for (const a of all) await syncAffiliateToCrm(a.id);
  }
  if (!dryRun) revalidatePath("/admin/import");
  return { type, dryRun, ...result };
}

export async function inviteImportedAffiliates() {
  await requireAdmin();
  const s = await getSettings();
  const list = await prisma.affiliate.findMany({ where: { status: "ACTIVE", notes: "Imported from AffiliateWP" } });
  for (const a of list) {
    await sendMail(
      a.email,
      `${s.siteName} affiliate programme has a new home`,
      `<p>Hi ${a.firstName || "there"},</p><p>We've moved our affiliate programme to a new dashboard. Your existing links still work and your earnings history has been carried over.</p><p>Sign in with your email here (no password needed): <a href="${process.env.APP_URL}/login">${process.env.APP_URL}/login</a></p>`
    );
  }
  redirect(`/admin/import?invited=${list.length}`);
}

// ---------- Promotions ----------
export async function savePromotion(f) {
  await requireAdmin();
  const { rate, rateType } = rateFields(f);
  if (rate == null) redirect("/admin/rules?error=promo");
  const day = (k, end) => (str(f, k) ? new Date(`${str(f, k)}T${end ? "23:59:59" : "00:00:00"}`) : null);
  await prisma.promotion.create({
    data: {
      name: str(f, "name") || "Promotion", rate, rateType, startsAt: day("startsAt"), endsAt: day("endsAt", true),
      categories: f.getAll("categories").map(String).filter(Boolean),
      productIds: f.getAll("productIds").map(String).filter(Boolean),
      groupIds: f.getAll("groupIds").map(String).filter(Boolean),
    },
  });
  await logEvent("promotion:created", "ok", str(f, "name"));
  revalidatePath("/admin/rules");
}

export async function togglePromotion(id, active) {
  await requireAdmin();
  await prisma.promotion.update({ where: { id }, data: { active } });
  revalidatePath("/admin/rules");
}

export async function deletePromotion(id) {
  await requireAdmin();
  await prisma.promotion.delete({ where: { id } });
  revalidatePath("/admin/rules");
}

// ---------- Disputes ----------
export async function replyDispute(id, f) {
  const admin = await requireAdmin();
  await staffReply(id, { body: str(f, "body"), status: str(f, "status"), staffName: admin.name || (await accountsContact()).name });
  redirect(`/admin/disputes/${id}?saved=1`);
}

// Resolution helpers: correct the flagged commission, or add the missing one, straight from the dispute
export async function resolveAdjustReferral(disputeId, f) {
  await requireAdmin();
  const d = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!d?.referralId) redirect(`/admin/disputes/${disputeId}`);
  const amount = str(f, "amount");
  const status = str(f, "status");
  const r = await prisma.referral.update({
    where: { id: d.referralId },
    data: { ...(amount != null ? { amount: Number(amount) } : {}), ...(status ? { status } : {}), notes: `Adjusted via dispute ${disputeId}` },
  });
  await fireWebhooks("referral.updated", referralJson(r));
  await syncAffiliateToCrm(r.affiliateId);
  await logEvent("dispute:adjust", "ok", `referral ${r.id} -> ${r.amount} ${r.status}`);
  redirect(`/admin/disputes/${disputeId}?adjusted=1`);
}

export async function resolveAddReferral(disputeId, f) {
  await requireAdmin();
  const d = await prisma.dispute.findUnique({ where: { id: disputeId } });
  const s = await getSettings();
  const r = await prisma.referral.create({
    data: {
      affiliateId: d.affiliateId, amount: Number(str(f, "amount") || 0), orderTotal: Number(str(f, "orderTotal") || 0), orderId: str(f, "orderId"),
      description: str(f, "description") || "Added after dispute", currency: s.currency, status: "UNPAID", source: "manual", notes: `Added via dispute ${disputeId}`,
    },
  });
  await prisma.dispute.update({ where: { id: disputeId }, data: { referralId: r.id } });
  await fireWebhooks("referral.created", referralJson(r));
  await syncAffiliateToCrm(d.affiliateId);
  redirect(`/admin/disputes/${disputeId}?adjusted=1`);
}

// ---------- Team (staff logins) ----------
export async function addStaff(f) {
  await requireAdmin();
  const email = str(f, "email")?.toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/team?error=email");
  await prisma.user.upsert({ where: { email }, create: { email, name: str(f, "name"), role: "ADMIN" }, update: { role: "ADMIN", name: str(f, "name") || undefined } });
  const s = await getSettings();
  await sendMail(email, `You've been given access to the ${s.siteName} affiliate admin`, `<p>Hi ${str(f, "name") || "there"},</p><p>You can now sign in to the affiliate admin with this email address (no password needed, we'll email you a link):</p><p><a href="${process.env.APP_URL}/login">${process.env.APP_URL}/login</a></p>`);
  await logEvent("team:added", "ok", email);
  redirect("/admin/team?added=1");
}

export async function removeStaff(id) {
  const me = await requireAdmin();
  const u = await prisma.user.findUnique({ where: { id }, include: { affiliate: true } });
  if (!u || u.id === me.id || u.email === process.env.ADMIN_EMAIL?.toLowerCase()) redirect("/admin/team?error=self");
  if (u.affiliate) await prisma.user.update({ where: { id }, data: { role: "AFFILIATE", passwordHash: null } });
  else await prisma.user.delete({ where: { id } });
  await logEvent("team:removed", "ok", u.email);
  redirect("/admin/team");
}

// Switch commission on or off for every product of one type (e.g. all event tickets)
export async function setKindCommission(kind, enabled) {
  await requireAdmin();
  const r = await prisma.product.updateMany({ where: { kind, deleted: false }, data: { commissionEnabled: enabled } });
  await logEvent("products:bulk-commission", "ok", `${kind}: commission ${enabled ? "on" : "off"} for ${r.count} products`);
  redirect(`/admin/products?kind=${kind}&bulk=${r.count}`);
}

// ---------- Coaches (event commission agreed case by case) ----------
export async function assignCoach(f) {
  await requireAdmin();
  const ids = f.getAll("ids").map(String);
  const coach = str(f, "coach");
  if (!ids.length) redirect("/admin/products?kind=event");
  const r = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { coach } });
  await logEvent("products:coach", "ok", `${coach || "(none)"} assigned to ${r.count} products`);
  redirect(`/admin/products?kind=event&bulk=${r.count}`);
}

export async function saveCoachDeal(f) {
  await requireAdmin();
  const coach = str(f, "coach");
  const { rate, rateType } = rateFields(f);
  if (!coach || rate == null) redirect("/admin/rules?error=coach#coaches");
  await prisma.coachDeal.upsert({ where: { coach }, create: { coach, rate, rateType, notes: str(f, "notes") }, update: { rate, rateType, notes: str(f, "notes") } });
  await logEvent("coach-deal:saved", "ok", `${coach}: ${rateType === "FLAT" ? "$" : ""}${rate}${rateType === "FLAT" ? " flat" : "%"}`);
  redirect("/admin/rules?saved=coach#coaches");
}

export async function deleteCoachDeal(id) {
  await requireAdmin();
  const d = await prisma.coachDeal.delete({ where: { id } });
  await logEvent("coach-deal:deleted", "ok", d.coach);
  revalidatePath("/admin/rules");
}

// Change what an existing key may do; its value and connector URL stay the same
export async function updateApiKeyScopes(id, f) {
  await requireAdmin();
  const chosen = f.getAll("scopes").map(String);
  const scopes = chosen.includes("full") ? ["full"] : chosen.filter((s) => SCOPES[s]);
  const k = await prisma.apiKey.update({ where: { id }, data: { scopes } });
  await logEvent("api-key:scopes", "ok", `${k.name}: ${scopes.join(", ") || "(none)"}`);
  redirect("/admin/api?scopes=1");
}
