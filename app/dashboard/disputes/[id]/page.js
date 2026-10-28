import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { DISPUTE_STATUS, DISPUTE_TYPES } from "@/lib/disputes";
import { money, date } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import DisputeThread from "@/components/DisputeThread";
import { replyToDispute } from "@/app/actions/affiliate";

export default async function MyDispute({ params, searchParams }) {
  const { affiliate } = await requireAffiliate();
  const d = await prisma.dispute.findFirst({ where: { id: params.id, affiliateId: affiliate.id }, include: { messages: { orderBy: { createdAt: "asc" } }, referral: true, payout: true } });
  if (!d) notFound();
  return (
    <>
      <PageHeader title={d.subject} subtitle={`${DISPUTE_TYPES[d.category]} · raised ${date(d.createdAt)} · status: ${DISPUTE_STATUS[d.status]}`}>
        <Link href="/dashboard/disputes" className="btn-secondary">All queries</Link>
      </PageHeader>
      {searchParams.sent && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Sent. Our accounts team has been emailed and you'll get an email when they reply.</p>}
      {(d.referral || d.payout || d.orderRef) && (
        <div className="card mb-4 space-y-1 p-4 text-sm">
          {d.referral && <div>Referral: {date(d.referral.createdAt)} · {d.referral.description} · {money(d.referral.amount, d.referral.currency)} ({d.referral.status.toLowerCase()})</div>}
          {d.payout && <div>Payout: {date(d.payout.createdAt)} · {money(d.payout.amount, d.payout.currency)} via {d.payout.method}</div>}
          {d.orderRef && <div>Order details: {d.orderRef}</div>}
        </div>
      )}
      <DisputeThread messages={d.messages} />
      <form key={d.messages.length} action={replyToDispute.bind(null, d.id)} className="card mt-4 max-w-2xl space-y-3 p-5">
        <textarea name="body" required rows={4} maxLength={5000} className="input" placeholder={["resolved", "declined"].includes(d.status) ? "Replying will reopen this query" : "Add more information"} />
        <button className="btn-primary">Send reply</button>
      </form>
    </>
  );
}
