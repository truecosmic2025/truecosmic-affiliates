import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { DISPUTE_STATUS, DISPUTE_TYPES } from "@/lib/disputes";
import { money, fullName, date } from "@/lib/format";
import { PageHeader, Badge } from "@/components/ui";
import DisputeThread from "@/components/DisputeThread";
import { replyDispute, resolveAdjustReferral, resolveAddReferral } from "@/app/actions/admin";

export default async function DisputeDetail({ params, searchParams }) {
  const d = await prisma.dispute.findUnique({ where: { id: params.id }, include: { affiliate: true, referral: true, payout: true, messages: { orderBy: { createdAt: "asc" } } } });
  if (!d) notFound();
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  return (
    <>
      <PageHeader title={d.subject} subtitle={`${DISPUTE_TYPES[d.category]} · raised ${date(d.createdAt)} by ${fullName(d.affiliate)} (${d.affiliate.email})`}>
        <Link href={`/admin/affiliates/${d.affiliateId}`} className="btn-secondary">View affiliate</Link>
        <Link href="/admin/disputes" className="btn-secondary">All disputes</Link>
      </PageHeader>
      {searchParams.saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved. The affiliate has been emailed.</p>}
      {searchParams.adjusted && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Commission updated. Add a reply below to let the affiliate know.</p>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DisputeThread messages={d.messages} staffLabel={s.accountsName} />
          <form key={d.messages.length} action={replyDispute.bind(null, d.id)} className="card mt-4 space-y-3 p-5">
            <textarea name="body" rows={4} className="input" placeholder={`Reply to ${d.affiliate.firstName || "the affiliate"} (emailed to them)`} />
            <div className="flex flex-wrap items-center gap-2">
              <select name="status" defaultValue={d.status === "open" ? "in_review" : d.status} className="input w-auto">{Object.entries(DISPUTE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <button className="btn-primary">Send reply / update status</button>
            </div>
          </form>
        </div>
        <div className="space-y-4">
          <div className="card space-y-2 p-5 text-sm">
            <div className="font-medium">Details</div>
            <div>Status: <strong>{DISPUTE_STATUS[d.status]}</strong></div>
            {d.orderRef && <div>Order mentioned: <strong>{d.orderRef}</strong></div>}
            {d.referral && <div>Referral: {date(d.referral.createdAt)} · {d.referral.description} · order {d.referral.orderId || "—"} · {m(d.referral.amount)} · <Badge value={d.referral.status} /></div>}
            {d.payout && <div>Payout: {date(d.payout.createdAt)} · {m(d.payout.amount)} via {d.payout.method} {d.payout.reference && `(${d.payout.reference})`} · <Badge value={d.payout.status} /></div>}
          </div>
          {d.referral ? (
            <form action={resolveAdjustReferral.bind(null, d.id)} className="card space-y-3 p-5">
              <div className="font-medium">Correct this commission</div>
              <div className="flex gap-2">
                <input name="amount" type="number" step="0.01" min="0" defaultValue={Number(d.referral.amount)} className="input" />
                <select name="status" defaultValue={d.referral.status} className="input"><option>PENDING</option><option>UNPAID</option><option>PAID</option><option>REJECTED</option></select>
              </div>
              <button className="btn-secondary w-full">Update commission</button>
            </form>
          ) : (
            <form action={resolveAddReferral.bind(null, d.id)} className="card space-y-2 p-5">
              <div className="font-medium">Add the missing commission</div>
              <input name="orderId" defaultValue={d.orderRef?.replace(/[^0-9]/g, "") || ""} placeholder="WooCommerce order number" className="input" />
              <input name="description" placeholder="Product(s)" className="input" />
              <div className="flex gap-2"><input name="orderTotal" type="number" step="0.01" min="0" placeholder="Order total" className="input" /><input name="amount" type="number" step="0.01" min="0" required placeholder="Commission" className="input" /></div>
              <button className="btn-secondary w-full">Credit affiliate</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
