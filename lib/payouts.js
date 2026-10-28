// Monthly payout schedule and the clearing (refund-window) rule.

export function clearsAtFor(date, settings) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(settings.holdDays || 0));
  return d;
}

// Referrals that can go into a payout made at `asOf`: unpaid and past their refund window
export function payableWhere(asOf = new Date()) {
  return { status: "UNPAID", payoutId: null, OR: [{ clearsAt: null }, { clearsAt: { lte: asOf } }] };
}

// Locked into a payout that has been approved but not yet confirmed paid
export function inFlightWhere() {
  return { status: "UNPAID", payoutId: { not: null } };
}

// Unpaid but still inside the refund window
export function clearingWhere(asOf = new Date()) {
  return { status: "UNPAID", payoutId: null, clearsAt: { gt: asOf } };
}

// Next payout run on settings.payoutDay (clamped to 1-28 so every month has it)
export function nextPayoutDate(settings, from = new Date()) {
  const day = Math.min(Math.max(Number(settings.payoutDay) || 1, 1), 28);
  const d = new Date(from.getFullYear(), from.getMonth(), day);
  if (d < new Date(from.getFullYear(), from.getMonth(), from.getDate())) d.setMonth(d.getMonth() + 1);
  return d;
}

export function isPayoutDay(settings, on = new Date()) {
  return on.getDate() === Math.min(Math.max(Number(settings.payoutDay) || 1, 1), 28);
}
