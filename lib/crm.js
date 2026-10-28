import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { callWordPress } from "./wp";
import { affiliateLink } from "./format";

const STATUS_TAG = {
  ACTIVE: "Affiliate - Active",
  PENDING: "Affiliate - Pending",
  INACTIVE: "Affiliate - Inactive",
  REJECTED: "Affiliate - Rejected",
};

// Push an affiliate into FluentCRM (via the connector plugin). Tags drive FluentCRM automations,
// so welcome / approval / new-sale emails can be built there without touching this app.
export async function syncAffiliateToCrm(affiliateId, extraTags = []) {
  const settings = await getSettings();
  if (!settings.crmEnabled) return;
  const a = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!a) return;
  const [earned, unpaid, count] = await Promise.all([
    prisma.referral.aggregate({ where: { affiliateId, status: { in: ["UNPAID", "PAID"] } }, _sum: { amount: true } }),
    prisma.referral.aggregate({ where: { affiliateId, status: "UNPAID" }, _sum: { amount: true } }),
    prisma.referral.count({ where: { affiliateId, status: { in: ["UNPAID", "PAID"] } } }),
  ]);
  const addTags = [settings.crmAffiliateTag, STATUS_TAG[a.status], ...extraTags].filter(Boolean);
  const removeTags = Object.entries(STATUS_TAG).filter(([k]) => k !== a.status).map(([, v]) => v);
  const payload = {
    email: a.email,
    first_name: a.firstName || "",
    last_name: a.lastName || "",
    add_tags: addTags,
    remove_tags: removeTags,
    lists: settings.crmListName ? [settings.crmListName] : [],
    custom_values: {
      affiliate_code: a.code,
      affiliate_status: a.status.toLowerCase(),
      affiliate_link: affiliateLink(settings, a),
      affiliate_earnings: Number(earned._sum.amount || 0).toFixed(2),
      affiliate_unpaid: Number(unpaid._sum.amount || 0).toFixed(2),
      affiliate_referrals: String(count),
    },
  };
  try {
    const res = await callWordPress("crm/contact", payload, { site: "crm" });
    await prisma.affiliate.update({ where: { id: a.id }, data: { crmSyncedAt: new Date() } });
    await logEvent("crm:affiliate", "ok", a.email, { contactId: res?.contact_id });
  } catch (e) {
    await logEvent("crm:affiliate", "error", `${a.email}: ${e.message}`);
  }
}

export async function tagReferredCustomer(referral, affiliate) {
  const settings = await getSettings();
  if (!settings.crmEnabled || !referral.customerEmail) return;
  try {
    await callWordPress("crm/contact", {
      email: referral.customerEmail,
      first_name: referral.customerName?.split(" ")[0] || "",
      add_tags: [settings.crmReferredCustomerTag].filter(Boolean),
      custom_values: { referred_by: affiliate.code },
      only_if_exists: false,
    }, { site: "crm" });
    await logEvent("crm:customer", "ok", referral.customerEmail);
  } catch (e) {
    await logEvent("crm:customer", "error", `${referral.customerEmail}: ${e.message}`);
  }
}
