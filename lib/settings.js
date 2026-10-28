import { prisma } from "./db";

export const DEFAULT_SETTINGS = {
  siteName: "TrueCosmic Academy",
  academyUrl: "https://www.truecosmic.com/academy/",
  currency: "GBP",
  referralVar: "ref",
  cookieDays: 30,
  defaultRateType: "PERCENTAGE",
  defaultRate: 20,
  autoApproveAffiliates: false,
  referralsStartPending: false, // true = new commissions need manual approval before they're payable
  newProductsEarnCommission: true,
  minimumPayout: 25,
  allowSelfReferral: false,
  crmEnabled: true,
  crmAffiliateTag: "Affiliate",
  crmReferredCustomerTag: "Referred Customer",
  crmListName: "Affiliates",
};

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
}

export async function saveSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}
