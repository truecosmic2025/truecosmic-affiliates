import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { payableWhere } from "./payouts";
import { payTo, describe, METHODS } from "./payoutMethods";
import { paypalConfigured, sendPayPalPayouts, getPayPalBatch, PAYPAL_DONE, PAYPAL_FAILED } from "./paypal";
import { sendTemplate, fireWebhooks } from "./notify";
import { syncAffiliateToCrm } from "./crm";
import { money } from "./format";

const round2 = (n) => Math.round(n * 100) / 100;

// Who would be paid if a run were approved now: cleared balances at or above the minimum, grouped by method
export async function eligibleRun(settings) {
  const owed = await prisma.referral.groupBy({ by: ["affiliateId"], where: payableWhere(), _sum: { amount: true }, _count: true });
  const affs = await prisma.affiliate.findMany({ where: { id: { in: owed.map((o) => o.affiliateId) } } });
  const byId = Object.fromEntries(affs.map((a) => [a.id, a]));
  const rows = owed
    .map((o) => ({ affiliate: byId[o.affiliateId], amount: round2(Number(o._sum.amount || 0)), count: o._count }))
    .filter((r) => r.affiliate && r.affiliate.status === "ACTIVE")
    .map((r) => ({ ...r, payTo: payTo(r.affiliate), eligible: r.amount >= Number(settings.minimumPayout) }))
    .sort((a, b) => b.amount - a.amount);
  const groups = Object.fromEntries(Object.keys(METHODS).map((m) => [m, rows.filter((r) => r.eligible && r.payTo.method === m)]));
  const total = round2(rows.filter((r) => r.eligible).reduce((x, r) => x + r.amount, 0));
  return { rows, groups, total, belowMinimum: rows.filter((r) => !r.eligible) };
}

// One approval for the whole run. Creates a payout per affiliate (locking their cleared referrals to it),
// then sends the PayPal group through the API. Wise / Payoneer / Other wait for export and confirmation.
export async function approveRun(approvedBy, affiliateIds) {
  const settings = await getSettings();
  const { groups } = await eligibleRun(settings);
  const chosen = Object.values(groups).flat().filter((r) => affiliateIds.includes(r.affiliate.id));
  if (!chosen.length) return { error: "Nobody selected is due a payout." };
  const summary = {};
  for (const r of chosen) {
    const g = (summary[r.payTo.method] ||= { count: 0, total: 0 });
    g.count++;
    g.total = round2(g.total + r.amount);
  }
  const run = await prisma.payoutRun.create({
    data: { approvedBy, total: round2(chosen.reduce((x, r) => x + r.amount, 0)), currency: settings.currency, summary },
  });
  const payouts = [];
  for (const r of chosen) {
    // Re-read inside a transaction so a referral can't land in two payouts
    const p = await prisma.$transaction(async (tx) => {
      const refs = await tx.referral.findMany({ where: { affiliateId: r.affiliate.id, ...payableWhere() } });
      if (!refs.length) return null;
      const amount = round2(refs.reduce((x, f) => x + Number(f.amount), 0));
      const payout = await tx.payout.create({
        data: { affiliateId: r.affiliate.id, amount, currency: settings.currency, method: r.payTo.method, payTo: r.payTo, status: "PROCESSING", runId: run.id, kind: "run" },
      });
      await tx.referral.updateMany({ where: { id: { in: refs.map((f) => f.id) } }, data: { payoutId: payout.id } });
      return payout;
    });
    if (p) payouts.push({ ...p, affiliate: r.affiliate });
  }
  await logEvent("payrun:approved", "ok", `${run.id} by ${approvedBy}: ${payouts.length} payouts, ${settings.currency} ${run.total}`);

  let paypalError = null;
  const pp = payouts.filter((p) => p.method === "paypal");
  if (pp.length && paypalConfigured()) {
    try {
      const batchId = await sendPayPalPayouts(
        pp.map((p) => ({ email: p.payTo.details.email, amount: Number(p.amount), senderItemId: p.id })),
        settings,
        `run-${run.id}`
      );
      await prisma.payoutRun.update({ where: { id: run.id }, data: { paypalBatchId: batchId } });
      await prisma.payout.updateMany({ where: { id: { in: pp.map((p) => p.id) } }, data: { externalId: batchId, reference: `PayPal batch ${batchId}` } });
      await logEvent("payrun:paypal", "ok", `run ${run.id}: batch ${batchId}, ${pp.length} items`);
    } catch (e) {
      // Nothing was sent: put these balances back so the next run picks them up
      paypalError = e.message;
      for (const p of pp) await releasePayout(p.id, `PayPal API: ${e.message}`, { notify: false });
      await logEvent("payrun:paypal", "error", `run ${run.id}: ${e.message}`);
    }
  }
  for (const p of payouts) await fireWebhooks("payout.created", { id: p.id, run_id: run.id, affiliate_id: p.affiliateId, amount: Number(p.amount), currency: p.currency, method: p.method, status: "processing" });
  return { run, paypalError };
}

// Manual payout outside the monthly run: prize, settlement or correction. Doesn't touch commission balances.
export async function manualPayout({ affiliateId, amount, method, reference, reason, approvedBy, sendViaPayPal }) {
  const settings = await getSettings();
  const a = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!a) return { error: "Affiliate not found." };
  if (!(Number(amount) > 0)) return { error: "Enter an amount above zero." };
  if (!reason?.trim()) return { error: "A reason is required for manual payouts." };
  const dest = method === payTo(a).method ? payTo(a) : { method, details: method === "paypal" ? { email: a.paymentEmail || a.email } : payTo(a).details };
  const payout = await prisma.payout.create({
    data: {
      affiliateId: a.id, amount: round2(Number(amount)), currency: settings.currency, method, payTo: dest, kind: "manual",
      reason: reason.trim().slice(0, 500), reference: reference || null, notes: `Manual payout approved by ${approvedBy}`,
      status: sendViaPayPal ? "PROCESSING" : "PAID", paidAt: sendViaPayPal ? null : new Date(),
    },
  });
  if (sendViaPayPal) {
    try {
      const batchId = await sendPayPalPayouts([{ email: dest.details.email, amount: Number(payout.amount), senderItemId: payout.id, note: reason.trim().slice(0, 150) }], settings, `manual-${payout.id}`);
      await prisma.payout.update({ where: { id: payout.id }, data: { externalId: batchId, reference: reference || `PayPal batch ${batchId}` } });
    } catch (e) {
      await prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED", failureReason: `PayPal API: ${e.message}` } });
      await logEvent("payout:manual", "error", `${a.code}: ${e.message}`);
      return { error: `PayPal didn't accept the payment: ${e.message}`, payout };
    }
  } else {
    await notifyPaid(payout, a);
  }
  await logEvent("payout:manual", "ok", `${a.code} ${settings.currency} ${payout.amount} via ${method}: ${reason}`);
  await fireWebhooks("payout.created", { id: payout.id, affiliate_id: a.id, amount: Number(payout.amount), currency: payout.currency, method, kind: "manual", status: payout.status.toLowerCase() });
  return { payout };
}

async function notifyPaid(payout, affiliate) {
  const label = METHODS[payout.method]?.label || payout.method;
  await sendTemplate("payoutSent", affiliate.email, affiliate, { amount: money(payout.amount, payout.currency), method: label });
  await syncAffiliateToCrm(affiliate.id, ["Affiliate - Paid"]);
}

export async function markPaid(payoutId, reference) {
  const p = await prisma.payout.findUnique({ where: { id: payoutId }, include: { affiliate: true } });
  if (!p || p.status !== "PROCESSING") return null;
  await prisma.$transaction([
    prisma.payout.update({ where: { id: p.id }, data: { status: "PAID", paidAt: new Date(), ...(reference ? { reference } : {}) } }),
    prisma.referral.updateMany({ where: { payoutId: p.id }, data: { status: "PAID" } }),
  ]);
  await notifyPaid(p, p.affiliate);
  await fireWebhooks("payout.paid", { id: p.id, affiliate_id: p.affiliateId, amount: Number(p.amount), method: p.method, reference: reference || p.reference });
  return p;
}

// Payout didn't arrive: its commissions go back into the cleared balance for the next run
export async function releasePayout(payoutId, reason, { notify = true } = {}) {
  const p = await prisma.payout.findUnique({ where: { id: payoutId }, include: { affiliate: true } });
  if (!p || !["PROCESSING", "PAID"].includes(p.status)) return null;
  await prisma.$transaction([
    prisma.payout.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: reason?.slice(0, 500) || "Failed" } }),
    prisma.referral.updateMany({ where: { payoutId: p.id }, data: { status: "UNPAID", payoutId: null } }),
  ]);
  if (notify) {
    await sendTemplate("payoutFailed", p.affiliate.email, p.affiliate, { amount: money(p.amount, p.currency), method: METHODS[p.method]?.label || p.method, reason: reason || "the payment was not accepted" });
    await fireWebhooks("payout.failed", { id: p.id, affiliate_id: p.affiliateId, amount: Number(p.amount), method: p.method, reason });
  }
  await logEvent("payout:failed", "ok", `${p.id} (${p.affiliate.code}): ${reason}`);
  await syncAffiliateToCrm(p.affiliateId);
  return p;
}

export async function markGroupPaid(runId, method, reference) {
  const list = await prisma.payout.findMany({ where: { runId, method, status: "PROCESSING" } });
  for (const p of list) await markPaid(p.id, reference);
  return list.length;
}

// Ask PayPal how each item in the run's batch went
export async function syncPayPalRun(runId) {
  const run = await prisma.payoutRun.findUnique({ where: { id: runId } });
  if (!run?.paypalBatchId) return { error: "This run has no PayPal batch." };
  const items = await getPayPalBatch(run.paypalBatchId);
  let paid = 0, failed = 0, waiting = 0;
  for (const i of items) {
    const p = await prisma.payout.findFirst({ where: { id: i.senderItemId, runId } });
    if (!p || p.status !== "PROCESSING") continue;
    if (PAYPAL_DONE.includes(i.status)) {
      await prisma.payout.update({ where: { id: p.id }, data: { externalId: i.payoutItemId } });
      await markPaid(p.id);
      paid++;
    } else if (PAYPAL_FAILED.includes(i.status)) {
      await releasePayout(p.id, `PayPal ${i.status.toLowerCase()}${i.error ? `: ${i.error}` : ""}`);
      failed++;
    } else waiting++; // PENDING, UNCLAIMED (no PayPal account yet), ONHOLD
  }
  await logEvent("payrun:paypal-sync", "ok", `run ${runId}: ${paid} paid, ${failed} failed, ${waiting} waiting`);
  return { paid, failed, waiting };
}

export { describe };
