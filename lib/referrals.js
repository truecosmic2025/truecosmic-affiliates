import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { calculateCommission } from "./commission";
import { findAffiliateByRef, findAffiliateByCoupon } from "./affiliates";
import { upsertProduct } from "./products";
import { syncAffiliateToCrm, tagReferredCustomer } from "./crm";
import { sendMail } from "./wp";
import { money } from "./format";

// order: { id, number, status, total, currency, customer: {email, name}, items: [{product_id, name, quantity, total, categories?}],
//          coupons: [], ref, visit_id }
export async function recordOrder(order) {
  const orderId = String(order.id);
  const existing = await prisma.referral.findUnique({ where: { orderId } });
  if (existing) return { skipped: "already recorded", referral: existing };

  const settings = await getSettings();
  let affiliate = null;
  let source = "link";
  if (order.ref) affiliate = await findAffiliateByRef(order.ref);
  if (!affiliate && order.coupons?.length) {
    affiliate = await findAffiliateByCoupon(order.coupons);
    if (affiliate) source = "coupon";
  }
  if (!affiliate) return { skipped: "no affiliate" };
  if (affiliate.status !== "ACTIVE") return { skipped: `affiliate ${affiliate.status.toLowerCase()}` };
  const customerEmail = order.customer?.email?.toLowerCase();
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
  const { amount, lines } = calculateCommission({ items, productsByWcId, affiliate, settings });
  if (amount <= 0) return { skipped: "zero commission" };

  let visitId = null;
  if (order.visit_id) {
    const v = await prisma.visit.findUnique({ where: { id: String(order.visit_id) } });
    if (v && v.affiliateId === affiliate.id) visitId = v.id;
  }
  const referral = await prisma.referral.create({
    data: {
      affiliateId: affiliate.id,
      visitId,
      orderId,
      orderTotal: Number(order.total || 0),
      amount,
      currency: order.currency || settings.currency,
      status: settings.referralsStartPending ? "PENDING" : "UNPAID",
      description: lines.map((l) => l.name).join(", ").slice(0, 500),
      items: lines,
      customerEmail,
      customerName: order.customer?.name || null,
      source,
    },
  });
  if (visitId) await prisma.visit.update({ where: { id: visitId }, data: { converted: true } });
  await logEvent("referral:created", "ok", `${affiliate.code} earned ${amount} on order #${order.number || orderId}`);

  await sendMail(
    affiliate.email,
    `New referral: you earned ${money(amount, referral.currency)}`,
    `<p>Hi ${affiliate.firstName || "there"},</p><p>Someone bought <strong>${referral.description}</strong> through your link. You earned <strong>${money(amount, referral.currency)}</strong>.</p><p><a href="${process.env.APP_URL}/dashboard">View your dashboard</a></p>`
  );
  await syncAffiliateToCrm(affiliate.id, ["Affiliate - Has Sales"]);
  await tagReferredCustomer(referral, affiliate);
  return { referral };
}

export async function reverseOrder(orderId, reason = "refunded") {
  const r = await prisma.referral.findUnique({ where: { orderId: String(orderId) } });
  if (!r) return { skipped: "no referral" };
  if (r.status === "PAID") {
    await logEvent("referral:reverse", "skipped", `order ${orderId} ${reason} but commission already paid - review manually`);
    return { skipped: "already paid" };
  }
  await prisma.referral.update({ where: { id: r.id }, data: { status: "REJECTED", description: `${r.description || ""} [${reason}]` } });
  await logEvent("referral:reverse", "ok", `order ${orderId} ${reason}`);
  await syncAffiliateToCrm(r.affiliateId);
  return { rejected: r.id };
}
