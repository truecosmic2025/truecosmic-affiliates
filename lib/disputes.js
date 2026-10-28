import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { sendTemplate } from "./notify";
import { money, date } from "./format";
import { fireWebhooks } from "./notify";

export const DISPUTE_TYPES = {
  missing: "Missing commission (a sale I referred isn't showing)",
  amount: "Commission amount looks wrong",
  rejected: "Commission was rejected",
  payout: "Payout problem (late, missing or wrong amount)",
  other: "Something else",
};

export const DISPUTE_STATUS = { open: "Open", in_review: "In review", resolved: "Resolved", declined: "Declined" };

export async function accountsContact() {
  const s = await getSettings();
  return { name: s.accountsName || "Accounts", email: s.accountsEmail || process.env.ADMIN_EMAIL };
}

function about(d) {
  const s = [];
  if (d.referral) s.push(`Referral ${date(d.referral.createdAt)} · ${d.referral.description || "commission"} · ${money(d.referral.amount, d.referral.currency)} (${d.referral.status.toLowerCase()})${d.referral.orderId ? ` · order ${d.referral.orderId}` : ""}`);
  if (d.payout) s.push(`Payout ${date(d.payout.createdAt)} · ${money(d.payout.amount, d.payout.currency)} via ${d.payout.method}`);
  if (d.orderRef) s.push(`Order the affiliate mentions: ${d.orderRef}`);
  return s.join(" | ") || "General query";
}

export async function openDispute(affiliate, { category, subject, message, referralId, payoutId, orderRef }) {
  // Affiliates may only attach their own referrals and payouts
  const referral = referralId ? await prisma.referral.findFirst({ where: { id: referralId, affiliateId: affiliate.id } }) : null;
  const payout = payoutId ? await prisma.payout.findFirst({ where: { id: payoutId, affiliateId: affiliate.id } }) : null;
  const d = await prisma.dispute.create({
    data: {
      affiliateId: affiliate.id,
      referralId: referral?.id || null,
      payoutId: payout?.id || null,
      category: DISPUTE_TYPES[category] ? category : "other",
      subject: subject.slice(0, 200),
      orderRef: orderRef?.slice(0, 100) || null,
      messages: { create: { author: "affiliate", authorName: affiliate.firstName || affiliate.code, body: message.slice(0, 5000) } },
    },
    include: { referral: true, payout: true },
  });
  const acc = await accountsContact();
  const vars = {
    accounts_name: acc.name,
    dispute_subject: d.subject,
    dispute_type: DISPUTE_TYPES[d.category],
    dispute_about: about(d),
    dispute_message: message,
    dispute_url: `${process.env.APP_URL}/admin/disputes/${d.id}`,
  };
  await sendTemplate("disputeToAccounts", acc.email, affiliate, vars);
  await sendTemplate("disputeReceived", affiliate.email, affiliate, { ...vars, dispute_url: `${process.env.APP_URL}/dashboard/disputes/${d.id}` });
  await logEvent("dispute:opened", "ok", `${affiliate.code}: ${d.subject} -> ${acc.email}`);
  await fireWebhooks("dispute.opened", { id: d.id, affiliate_id: affiliate.id, category: d.category, subject: d.subject, referral_id: d.referralId, payout_id: d.payoutId });
  return d;
}

export async function affiliateReply(affiliate, disputeId, body) {
  const d = await prisma.dispute.findFirst({ where: { id: disputeId, affiliateId: affiliate.id } });
  if (!d) return null;
  await prisma.disputeMessage.create({ data: { disputeId: d.id, author: "affiliate", authorName: affiliate.firstName || affiliate.code, body: body.slice(0, 5000) } });
  // A reply on a closed dispute reopens it
  await prisma.dispute.update({ where: { id: d.id }, data: { status: ["resolved", "declined"].includes(d.status) ? "open" : d.status } });
  const acc = await accountsContact();
  await sendTemplate("disputeAffiliateReply", acc.email, affiliate, { dispute_subject: d.subject, dispute_message: body, dispute_url: `${process.env.APP_URL}/admin/disputes/${d.id}`, accounts_name: acc.name });
  return d;
}

export async function staffReply(disputeId, { body, status, staffName }) {
  const d = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { affiliate: true } });
  if (!d) return null;
  if (body) await prisma.disputeMessage.create({ data: { disputeId: d.id, author: "staff", authorName: staffName, body: body.slice(0, 5000) } });
  const newStatus = DISPUTE_STATUS[status] ? status : d.status;
  await prisma.dispute.update({ where: { id: d.id }, data: { status: newStatus } });
  const acc = await accountsContact();
  if (body || newStatus !== d.status) {
    await sendTemplate("disputeReply", d.affiliate.email, d.affiliate, {
      accounts_name: staffName || acc.name,
      dispute_subject: d.subject,
      dispute_status: DISPUTE_STATUS[newStatus],
      dispute_message: body || `Status changed to ${DISPUTE_STATUS[newStatus]}.`,
      dispute_url: `${process.env.APP_URL}/dashboard/disputes/${d.id}`,
    });
  }
  await logEvent("dispute:updated", "ok", `${d.id} ${d.status} -> ${newStatus}`);
  return d;
}

export const STATUS_CLASS = {
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  in_review: "bg-sky-50 text-sky-700 ring-sky-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  declined: "bg-slate-100 text-slate-600 ring-slate-200",
};
