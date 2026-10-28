import { prisma } from "./db";
import { getSettings } from "./settings";
import { payableWhere, clearingWhere, inFlightWhere, nextPayoutDate } from "./payouts";
import { describe, payTo } from "./payoutMethods";

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Balances per affiliate (shared by the REST API and the MCP server):
//   cleared   - past the refund window, goes in the next pay run if >= minimum_payout
//   clearing  - still inside the refund window
//   in_payout - approved in a pay run, not yet confirmed paid
//   pending   - awaiting admin approval (e.g. flagged)
//   paid      - all-time paid commissions
// With affiliateId: that affiliate (null if not found); otherwise every affiliate with a non-zero balance.
export async function getBalances({ affiliateId, take = 100, skip = 0 } = {}) {
  const s = await getSettings();
  const sum = async (where) =>
    Object.fromEntries((await prisma.referral.groupBy({ by: ["affiliateId"], where: { ...(affiliateId ? { affiliateId } : {}), ...where }, _sum: { amount: true } })).map((g) => [g.affiliateId, r2(g._sum.amount)]));
  const [cleared, clearing, inPayout, pending, paid] = await Promise.all([sum(payableWhere()), sum(clearingWhere()), sum(inFlightWhere()), sum({ status: "PENDING" }), sum({ status: "PAID" })]);
  const ids = affiliateId ? [affiliateId] : [...new Set([...Object.keys(cleared), ...Object.keys(clearing), ...Object.keys(inPayout), ...Object.keys(pending)])];
  const affs = await prisma.affiliate.findMany({ where: { id: { in: ids } }, ...(affiliateId ? {} : { take, skip }) });
  if (affiliateId && !affs.length) return null;
  return {
    currency: s.currency,
    minimum_payout: Number(s.minimumPayout),
    next_payout_date: nextPayoutDate(s).toISOString().slice(0, 10),
    clearing_days: Number(s.holdDays),
    data: affs.map((a) => ({
      affiliate_id: a.id, code: a.code, email: a.email,
      cleared: cleared[a.id] || 0, clearing: clearing[a.id] || 0, in_payout: inPayout[a.id] || 0, pending: pending[a.id] || 0, paid: paid[a.id] || 0,
      due_next_run: (cleared[a.id] || 0) >= Number(s.minimumPayout),
      pay_to: describe(payTo(a)),
    })),
  };
}
