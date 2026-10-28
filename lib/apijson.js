import { describe, payTo } from "./payoutMethods";

export function disputeJson(d, { full = false } = {}) {
  const out = {
    id: d.id, affiliate_id: d.affiliateId, category: d.category, subject: d.subject, status: d.status, order_ref: d.orderRef,
    referral_id: d.referralId, payout_id: d.payoutId, created_at: d.createdAt, updated_at: d.updatedAt,
  };
  if (d.affiliate) out.affiliate = { id: d.affiliate.id, code: d.affiliate.code, name: [d.affiliate.firstName, d.affiliate.lastName].filter(Boolean).join(" "), email: d.affiliate.email };
  if (full) {
    out.messages = (d.messages || []).map((m) => ({ id: m.id, author: m.author, author_name: m.authorName, body: m.body, created_at: m.createdAt }));
    if (d.referral) out.referral = referralBrief(d.referral);
    if (d.payout) out.payout = payoutJson(d.payout);
  }
  return out;
}

function referralBrief(r) {
  return {
    id: r.id, order_id: r.orderId, description: r.description, status: r.status.toLowerCase(), type: r.type, source: r.source,
    amount: Number(r.amount), currency: r.currency, order_total: Number(r.orderTotal), clears_at: r.clearsAt, created_at: r.createdAt,
    original: r.fxRate ? { currency: r.originalCurrency, amount: Number(r.amountOriginal), order_total: Number(r.orderTotalOriginal), fx_rate: Number(r.fxRate), fx_date: r.fxDate, fx_source: r.fxSource } : null,
  };
}

export function payoutJson(p) {
  return {
    id: p.id, affiliate_id: p.affiliateId, amount: Number(p.amount), currency: p.currency, method: p.method, status: p.status.toLowerCase(),
    kind: p.kind, reason: p.reason, reference: p.reference, run_id: p.runId, failure_reason: p.failureReason,
    pay_to: p.payTo ? describe(p.payTo) : null, paid_at: p.paidAt, created_at: p.createdAt,
  };
}

export { referralBrief, describe, payTo };
