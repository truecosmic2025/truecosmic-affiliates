"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, logEvent } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { saveSettings, getSettings } from "@/lib/settings";
import { setAffiliateStatus, uniqueCode } from "@/lib/affiliates";
import { syncAffiliateToCrm } from "@/lib/crm";
import { importAffiliates, importReferrals } from "@/lib/importer";
import { callWordPress } from "@/lib/wp";
import { slugify } from "@/lib/format";

const str = (f, k) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};
const rateFields = (f) => {
  const rate = str(f, "rate");
  const rateType = str(f, "rateType");
  return rate && rateType ? { rate: Number(rate), rateType } : { rate: null, rateType: null };
};

// ---------- Affiliates ----------
export async function createAffiliate(f) {
  await requireAdmin();
  const email = str(f, "email")?.toLowerCase();
  if (!email) redirect("/admin/affiliates/new?error=email");
  if (await prisma.affiliate.findUnique({ where: { email } })) redirect("/admin/affiliates/new?error=exists");
  const firstName = str(f, "firstName");
  const user = await prisma.user.upsert({ where: { email }, create: { email, name: firstName }, update: {} });
  const a = await prisma.affiliate.create({
    data: {
      email,
      firstName,
      lastName: str(f, "lastName"),
      paymentEmail: str(f, "paymentEmail") || email,
      code: await uniqueCode(str(f, "code") || firstName || email.split("@")[0]),
      status: str(f, "status") || "ACTIVE",
      userId: user.id,
      ...rateFields(f),
    },
  });
  await logEvent("affiliate:created", "ok", email);
  await syncAffiliateToCrm(a.id);
  redirect(`/admin/affiliates/${a.id}`);
}

export async function updateAffiliate(id, f) {
  await requireAdmin();
  const code = slugify(str(f, "code"));
  const clash = code && (await prisma.affiliate.findFirst({ where: { code, NOT: { id } } }));
  if (clash) redirect(`/admin/affiliates/${id}?error=code`);
  const before = await prisma.affiliate.findUnique({ where: { id } });
  await prisma.affiliate.update({
    where: { id },
    data: {
      firstName: str(f, "firstName"),
      lastName: str(f, "lastName"),
      paymentEmail: str(f, "paymentEmail"),
      website: str(f, "website"),
      notes: str(f, "notes"),
      coupons: (str(f, "coupons") || "").split(",").map((c) => c.trim()).filter(Boolean),
      ...(code ? { code } : {}),
      ...rateFields(f),
    },
  });
  const status = str(f, "status");
  if (status && status !== before.status) await setAffiliateStatus(id, status);
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

export async function deleteAffiliate(id) {
  await requireAdmin();
  await prisma.affiliate.delete({ where: { id } });
  await logEvent("affiliate:deleted", "ok", id);
  redirect("/admin/affiliates");
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
  await syncAffiliateToCrm(r.affiliateId);
  revalidatePath("/admin/referrals");
}

export async function addManualReferral(f) {
  await requireAdmin();
  const affiliateId = str(f, "affiliateId");
  const s = await getSettings();
  await prisma.referral.create({
    data: {
      affiliateId,
      amount: Number(str(f, "amount") || 0),
      description: str(f, "description"),
      orderId: str(f, "orderId"),
      currency: s.currency,
      status: "UNPAID",
      source: "manual",
    },
  });
  await syncAffiliateToCrm(affiliateId);
  redirect("/admin/referrals");
}

// ---------- Payouts ----------
export async function createPayouts(f) {
  await requireAdmin();
  const ids = f.getAll("affiliateId").map(String);
  const method = str(f, "method") || "paypal";
  const reference = str(f, "reference");
  const created = [];
  for (const affiliateId of ids) {
    const refs = await prisma.referral.findMany({ where: { affiliateId, status: "UNPAID" } });
    if (!refs.length) continue;
    const amount = refs.reduce((s, r) => s + Number(r.amount), 0);
    const payout = await prisma.payout.create({
      data: { affiliateId, amount, currency: refs[0].currency, method, reference, status: "PAID" },
    });
    await prisma.referral.updateMany({ where: { id: { in: refs.map((r) => r.id) } }, data: { status: "PAID", payoutId: payout.id } });
    created.push(payout.id);
    await syncAffiliateToCrm(affiliateId, ["Affiliate - Paid"]);
  }
  await logEvent("payouts:created", "ok", `${created.length} payouts`);
  redirect(`/admin/payouts?created=${created.length}`);
}

// ---------- Products ----------
export async function updateProduct(id, f) {
  await requireAdmin();
  await prisma.product.update({
    where: { id },
    data: { commissionEnabled: f.get("commissionEnabled") === "on", kind: str(f, "kind") || "other", ...rateFields(f) },
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

// ---------- Creatives ----------
export async function saveCreative(f) {
  await requireAdmin();
  const id = str(f, "id");
  const data = { name: str(f, "name") || "Untitled", description: str(f, "description"), url: str(f, "url") || "", imageUrl: str(f, "imageUrl"), text: str(f, "text"), active: f.get("active") !== "off" };
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
  await saveSettings({
    siteName: str(f, "siteName"),
    academyUrl: str(f, "academyUrl"),
    currency: str(f, "currency"),
    referralVar: str(f, "referralVar") || "ref",
    cookieDays: Number(str(f, "cookieDays") || 30),
    defaultRateType: str(f, "defaultRateType"),
    defaultRate: Number(str(f, "defaultRate") || 0),
    minimumPayout: Number(str(f, "minimumPayout") || 0),
    autoApproveAffiliates: bool("autoApproveAffiliates"),
    referralsStartPending: bool("referralsStartPending"),
    newProductsEarnCommission: bool("newProductsEarnCommission"),
    allowSelfReferral: bool("allowSelfReferral"),
    crmEnabled: bool("crmEnabled"),
    crmAffiliateTag: str(f, "crmAffiliateTag"),
    crmReferredCustomerTag: str(f, "crmReferredCustomerTag"),
    crmListName: str(f, "crmListName"),
  });
  redirect("/admin/settings?saved=1");
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
  const { sendMail } = await import("@/lib/wp");
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
