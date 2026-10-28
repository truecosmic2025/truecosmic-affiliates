import { prisma } from "./db";
import { payableWhere, clearingWhere, inFlightWhere } from "./payouts";

const EARNED = ["UNPAID", "PAID"];

export async function summary(where = {}, since) {
  const created = since ? { createdAt: { gte: since } } : {};
  const [earned, unpaid, paid, pending, referrals, visits, conversions, payable, clearing, inFlight] = await Promise.all([
    prisma.referral.aggregate({ where: { ...where, ...created, status: { in: EARNED } }, _sum: { amount: true, orderTotal: true } }),
    prisma.referral.aggregate({ where: { ...where, status: "UNPAID" }, _sum: { amount: true } }),
    prisma.referral.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true } }),
    prisma.referral.aggregate({ where: { ...where, status: "PENDING" }, _sum: { amount: true } }),
    prisma.referral.count({ where: { ...where, ...created, status: { in: EARNED } } }),
    prisma.visit.count({ where: { ...where, ...created } }),
    prisma.visit.count({ where: { ...where, ...created, converted: true } }),
    prisma.referral.aggregate({ where: { ...where, ...payableWhere() }, _sum: { amount: true } }),
    prisma.referral.aggregate({ where: { ...where, ...clearingWhere() }, _sum: { amount: true } }),
    prisma.referral.aggregate({ where: { ...where, ...inFlightWhere() }, _sum: { amount: true } }),
  ]);
  return {
    earned: Number(earned._sum.amount || 0),
    revenue: Number(earned._sum.orderTotal || 0),
    unpaid: Number(unpaid._sum.amount || 0),
    paid: Number(paid._sum.amount || 0),
    pending: Number(pending._sum.amount || 0),
    payable: Number(payable._sum.amount || 0),
    clearing: Number(clearing._sum.amount || 0),
    inFlight: Number(inFlight._sum.amount || 0),
    referrals,
    visits,
    conversionRate: visits ? (conversions / visits) * 100 : 0,
  };
}

// Daily commission totals for the last `days` days
export async function dailyEarnings(where = {}, days = 30) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const rows = await prisma.referral.findMany({
    where: { ...where, status: { in: EARNED }, createdAt: { gte: since } },
    select: { amount: true, createdAt: true },
  });
  const buckets = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const r of rows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    if (k in buckets) buckets[k] += Number(r.amount);
  }
  return Object.entries(buckets).map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));
}
