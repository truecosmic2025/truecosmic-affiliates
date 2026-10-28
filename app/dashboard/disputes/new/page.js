import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { DISPUTE_TYPES } from "@/lib/disputes";
import { money, date } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { raiseDispute } from "@/app/actions/affiliate";

export default async function NewDispute({ searchParams }) {
  const { affiliate } = await requireAffiliate();
  const [referrals, payouts] = await Promise.all([
    prisma.referral.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.payout.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  const preRef = referrals.find((r) => r.id === searchParams.referral);
  const prePay = payouts.find((p) => p.id === searchParams.payout);
  const defaultType = prePay ? "payout" : preRef ? (preRef.status === "REJECTED" ? "rejected" : "amount") : "missing";
  return (
    <>
      <PageHeader title="Raise a query" subtitle="Tell us what's wrong and we'll look into it. You'll get a copy by email and replies appear in your Disputes tab." />
      {searchParams.error && <p className="mb-4 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-700">Please add a subject and describe the problem.</p>}
      <form action={raiseDispute} className="card max-w-2xl space-y-4 p-6">
        <div><label className="label">What's it about?</label>
          <select name="category" defaultValue={defaultType} className="input">{Object.entries(DISPUTE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label className="label">Related referral (optional)</label>
          <select name="referralId" defaultValue={preRef?.id || ""} className="input"><option value="">None / not listed</option>
            {referrals.map((r) => <option key={r.id} value={r.id}>{date(r.createdAt)} · {r.description?.slice(0, 50) || "commission"} · {money(r.amount, r.currency)} ({r.status.toLowerCase()})</option>)}</select></div>
        <div><label className="label">Related payout (optional)</label>
          <select name="payoutId" defaultValue={prePay?.id || ""} className="input"><option value="">None</option>
            {payouts.map((p) => <option key={p.id} value={p.id}>{date(p.createdAt)} · {money(p.amount, p.currency)} via {p.method}</option>)}</select></div>
        <div><label className="label">Order number or customer details (for a missing sale)</label><input name="orderRef" className="input" placeholder="e.g. order #10452, or the buyer's first name and date" /></div>
        <div><label className="label">Subject *</label><input name="subject" required maxLength={200} className="input" defaultValue={preRef ? `Query about ${preRef.description?.slice(0, 60) || "a commission"}` : prePay ? `Query about my ${date(prePay.createdAt)} payout` : ""} /></div>
        <div><label className="label">Details *</label><textarea name="message" required rows={6} maxLength={5000} className="input" placeholder="What happened, and what did you expect?" /></div>
        <button className="btn-primary">Send to accounts team</button>
      </form>
    </>
  );
}
