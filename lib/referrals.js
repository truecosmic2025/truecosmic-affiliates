import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { calculateCommission, tierCommissions } from "./commission";
import { findAffiliateByRef, findAffiliateByCoupon } from "./affiliates";
import { upsertProduct } from "./products";
import { syncAffiliateToCrm, tagReferredCustomer } from "./crm";
import { sendTemplate, notifyAdmin, fireWebhooks, referralJson } from "./notify";
import { money } from "./format";

const EARNED = ["UNPAID", "PAID"];

export async function affiliateStats(affiliateId) {
  const agg = await prisma.referral.aggregate({ where: { affiliateId, status: { in: EARNED }, type: { not: "bonus" } }, _sum: { amount: true }, _count: true });
  return { earnings: Number(agg._sum.amount || 0), referrals: agg._count };
}

// Everything rateFor() needs beyond the product and affiliate
export async function commissionContext(affiliate, kind) {
  const [group, apr, cats, tiers, stats] = await Promise.all([
    affiliate.groupId ? prisma.affiliateGroup.findUnique({ where: { id: affiliate.groupId } }) : prisma.affiliateGroup.findFirst({ where: { isDefault: true } }),
    prisma.affiliateProductRate.findMany({ where: { affiliateId: affiliate.id } }),
    prisma.categoryRate.findMany(),
    prisma.rateTier.findMany(),
    affiliateStats(affiliate.id),
  ]);
  return {
    kind,
    group,
    affiliateProductRates: Object.fromEntries(apr.map((r) => [r.productId, r])),
    categoryRates: Object.fromEntries(cats.map((c) => [c.category.toLowerCase(), c])),
    tiers,
    stats,
  };
}

async function upsertCustomer(order) {
  const email = order.customer?.email?.toLowerCase();
  if (!email) return null;
  return prisma.customer.upsert({ where: { email }, create: { email, name: order.customer?.name || null }, update: { name: order.customer?.name || undefined } });
}

// Works out who (if anyone) gets credit for an order, in AffiliateWP's order of precedence.
async function attribute(order, settings, customer) {
  // 1. Subscription renewal: the affiliate who referred the original order
  if (order.is_renewal && order.parent_order_id && settings.recurringReferrals) {
    const parent = await prisma.referral.findFirst({ where: { orderId: String(order.parent_order_id), type: "sale" }, include: { affiliate: true } });
    if (parent) return { affiliate: parent.affiliate, source: "renewal", kind: "recurring", type: "recurring" };
    return null;
  }
  if (order.is_renewal) return null;
  // 2. Referral link / direct link / landing page cookie
  if (order.ref) {
    const a = await findAffiliateByRef(order.ref);
    if (a) {
      let source = "link";
      if (order.visit_id) {
        const v = await prisma.visit.findUnique({ where: { id: String(order.visit_id) } });
        if (v?.source && v.source !== "short") source = v.source;
      }
      return { affiliate: a, source, kind: "sale", type: "sale" };
    }
  }
  // 3. Affiliate coupon
  if (order.coupons?.length) {
    const a = await findAffiliateByCoupon(order.coupons);
    if (a) return { affiliate: a, source: "coupon", kind: "sale", type: "sale" };
  }
  // 4. Lifetime commissions: customer already linked to an affiliate
  if (settings.lifetimeCommissions && customer?.affiliateId) {
    const a = await prisma.affiliate.findUnique({ where: { id: customer.affiliateId } });
    if (a) return { affiliate: a, source: "lifetime", kind: "lifetime", type: "sale" };
  }
  return null;
}

// order: { id, number, total, shipping, tax, currency, customer: {email, name}, items: [{product_id, name, quantity, total, categories}],
//          coupons, ref, visit_id, campaign, is_renewal, parent_order_id }
export async function recordOrder(order) {
  const orderId = String(order.id);
  const existing = await prisma.referral.findFirst({ where: { orderId, type: { in: ["sale", "recurring"] } } });
  if (existing) return { skipped: "already recorded", referral: existing };

  const settings = await getSettings();
  const customer = await upsertCustomer(order);
  const who = await attribute(order, settings, customer);
  if (!who) return { skipped: "no affiliate" };
  const { affiliate } = who;
  if (affiliate.status !== "ACTIVE") return { skipped: `affiliate ${affiliate.status.toLowerCase()}` };

  const customerEmail = customer?.email;
  if (!settings.allowSelfReferral && customerEmail && [affiliate.email, affiliate.paymentEmail].map((e) => e?.toLowerCase()).includes(customerEmail)) {
    await logEvent("referral", "skipped", `self-referral blocked for ${affiliate.email} on order ${orderId}`);
    return { skipped: "self referral" };
  }

  // Make sure every product in the order is known (catches products created before the connector was installed)
  for (const item of order.items || []) {
    if (item.product_id && !(await prisma.product.findUnique({ where: { wcId: Number(item.product_id) } }))) {
      await upsertProduct({ id: item.product_id, name: item.name, categories: item.categories || [], price: item.total });
    }
  }
  const wcIds = (order.items || []).map((i) => Number(i.product_id)).filter(Boolean);
  const products = await prisma.product.findMany({ where: { wcId: { in: wcIds } } });
  const productsByWcId = Object.fromEntries(products.map((p) => [p.wcId, p]));
  const items = (order.items || []).map((i) => ({ productId: Number(i.product_id), name: i.name, quantity: i.quantity, total: Number(i.total) }));
  const ctx = await commissionContext(affiliate, who.kind);
  const { amount, base, lines } = calculateCommission({ items, productsByWcId, affiliate, settings, ctx, order });
  if (amount <= 0 && settings.ignoreZeroReferrals) return { skipped: "zero commission" };

  let visit = null;
  if (order.visit_id) {
    visit = await prisma.visit.findUnique({ where: { id: String(order.visit_id) } });
    if (visit && visit.affiliateId !== affiliate.id) visit = null;
  }
  const flagged = visit?.flagged || null;
  const referral = await prisma.referral.create({
    data: {
      affiliateId: affiliate.id,
      visitId: visit?.id || null,
      customerId: customer?.id || null,
      orderId,
      orderTotal: Number(order.total || 0),
      amount,
      currency: order.currency || settings.currency,
      status: settings.referralsStartPending || flagged ? "PENDING" : "UNPAID",
      type: who.type,
      description: lines.map((l) => l.name).join(", ").slice(0, 500),
      items: lines,
      customerEmail,
      customerName: order.customer?.name || null,
      source: who.source,
      campaign: order.campaign || visit?.campaign || null,
      flagged,
    },
  });
  if (visit) await prisma.visit.update({ where: { id: visit.id }, data: { converted: true } });
  // First purchase links the customer to this affiliate for lifetime commissions
  if (customer && !customer.affiliateId && settings.lifetimeCommissions) {
    await prisma.customer.update({ where: { id: customer.id }, data: { affiliateId: affiliate.id } });
  }
  await logEvent("referral:created", "ok", `${affiliate.code} earned ${amount} on order #${order.number || orderId} (${who.source}${flagged ? ", flagged " + flagged : ""})`);

  await afterReferral(referral, affiliate, settings, ["Affiliate - Has Sales"]);
  await tagReferredCustomer(referral, affiliate);
  if (settings.multiTier) await payUpline(referral, affiliate, base, settings);
  return { referral };
}

async function afterReferral(referral, affiliate, settings, tags = []) {
  const amount = money(referral.amount, referral.currency);
  if (affiliate.emailOnReferral) await sendTemplate("newReferral", affiliate.email, affiliate, { amount, products: referral.description || "" });
  await notifyAdmin("adminNewReferral", affiliate, { amount, products: referral.description || "" });
  await fireWebhooks("referral.created", referralJson(referral));
  await checkBonuses(affiliate);
  await syncAffiliateToCrm(affiliate.id, tags);
}

// Multi-tier: the affiliate's recruiter (and theirs...) earn a % of the same order
async function payUpline(referral, affiliate, base, settings) {
  let current = affiliate;
  for (const t of tierCommissions(base, settings.tierRates)) {
    if (!current.parentId) break;
    const parent = await prisma.affiliate.findUnique({ where: { id: current.parentId } });
    if (!parent) break;
    if (parent.status === "ACTIVE") {
      const r = await prisma.referral.create({
        data: {
          affiliateId: parent.id, orderId: referral.orderId, orderTotal: referral.orderTotal, amount: t.amount, currency: referral.currency,
          status: referral.status, type: "tier", tierLevel: t.level, parentReferralId: referral.id, source: "network",
          description: `Level ${t.level} from ${affiliate.firstName || affiliate.code}: ${referral.description || ""}`.slice(0, 500),
          customerId: referral.customerId, customerEmail: referral.customerEmail,
        },
      });
      await afterReferral(r, parent, settings, ["Affiliate - Has Network Sales"]);
    }
    current = parent;
  }
}

// Performance bonuses (referral count or earnings milestones) and the sign-up bonus, each paid once
export async function checkBonuses(affiliate, { signup = false } = {}) {
  const bonuses = await prisma.bonus.findMany({ where: { active: true, metric: signup ? "signup" : { in: ["referrals", "earnings"] } } });
  if (!bonuses.length) return;
  const stats = await affiliateStats(affiliate.id);
  const settings = await getSettings();
  for (const b of bonuses) {
    const reached = b.metric === "signup" || (b.metric === "referrals" ? stats.referrals : stats.earnings) >= Number(b.threshold);
    if (!reached) continue;
    try {
      await prisma.bonusAward.create({ data: { bonusId: b.id, affiliateId: affiliate.id } });
    } catch {
      continue; // already awarded
    }
    const r = await prisma.referral.create({
      data: { affiliateId: affiliate.id, amount: b.amount, currency: settings.currency, status: "UNPAID", type: "bonus", source: "bonus", description: `Bonus: ${b.name}` },
    });
    await logEvent("bonus:awarded", "ok", `${affiliate.code}: ${b.name}`);
    await fireWebhooks("referral.created", referralJson(r));
  }
}

// A referred visitor created an account on the site (signup referrals)
export async function recordSignup({ ref, email, user_id }) {
  const settings = await getSettings();
  if (!Number(settings.signupReferralAmount)) return { skipped: "signup referrals off" };
  const affiliate = await findAffiliateByRef(ref);
  if (!affiliate || affiliate.status !== "ACTIVE") return { skipped: "no affiliate" };
  if (email && email.toLowerCase() === affiliate.email) return { skipped: "self referral" };
  const orderId = `signup-${user_id}`;
  if (await prisma.referral.findFirst({ where: { orderId } })) return { skipped: "already recorded" };
  const r = await prisma.referral.create({
    data: {
      affiliateId: affiliate.id, orderId, amount: Number(settings.signupReferralAmount), currency: settings.currency,
      status: settings.referralsStartPending ? "PENDING" : "UNPAID", type: "signup", source: "link",
      description: "New account sign-up", customerEmail: email?.toLowerCase() || null,
    },
  });
  await afterReferral(r, affiliate, settings);
  return { referral: r };
}

export async function reverseOrder(orderId, reason = "refunded") {
  const refs = await prisma.referral.findMany({ where: { orderId: String(orderId) } });
  if (!refs.length) return { skipped: "no referral" };
  const rejected = [];
  for (const r of refs) {
    if (r.status === "PAID") {
      await logEvent("referral:reverse", "skipped", `order ${orderId} ${reason} but commission ${r.id} already paid - review manually`);
      continue;
    }
    await prisma.referral.update({ where: { id: r.id }, data: { status: "REJECTED", notes: `Order ${reason}` } });
    rejected.push(r.id);
    await fireWebhooks("referral.updated", { id: r.id, status: "rejected", reason });
    await syncAffiliateToCrm(r.affiliateId);
  }
  await logEvent("referral:reverse", "ok", `order ${orderId} ${reason}: ${rejected.length} rejected`);
  return rejected.length ? { rejected: rejected[0], count: rejected.length } : { skipped: "already paid" };
}
