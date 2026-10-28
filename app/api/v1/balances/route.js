import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page } from "@/lib/apiauth";
import { getSettings } from "@/lib/settings";
import { payableWhere, clearingWhere, inFlightWhere, nextPayoutDate } from "@/lib/payouts";
import { describe, payTo } from "@/lib/apijson";

export const dynamic = "force-dynamic";

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Read-only balances per affiliate:
//   cleared   - past the refund window, will go in the next pay run if >= minimum_payout
//   clearing  - still inside the refund window
//   in_payout - approved in a pay run, not yet confirmed paid
//   pending   - awaiting admin approval (e.g. flagged)
//   paid      - all-time paid commissions
// ?affiliate_id= for one affiliate; otherwise every affiliate with a non-zero balance.
export const GET = withApiKey(async (req) => {
  const s = await getSettings();
  const id = req.nextUrl.searchParams.get("affiliate_id");
  const sum = async (where) =>
    Object.fromEntries((await prisma.referral.groupBy({ by: ["affiliateId"], where: { ...(id ? { affiliateId: id } : {}), ...where }, _sum: { amount: true } })).map((g) => [g.affiliateId, r2(g._sum.amount)]));
  const [cleared, clearing, inPayout, pending, paid] = await Promise.all([sum(payableWhere()), sum(clearingWhere()), sum(inFlightWhere()), sum({ status: "PENDING" }), sum({ status: "PAID" })]);
  const ids = id ? [id] : [...new Set([...Object.keys(cleared), ...Object.keys(clearing), ...Object.keys(inPayout), ...Object.keys(pending)])];
  const affs = await prisma.affiliate.findMany({ where: { id: { in: ids } }, ...(id ? {} : page(req)) });
  if (id && !affs.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
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
  });
}, "balances:read");
