import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { summary } from "@/lib/stats";
import { money, fullName, date, affiliateLink } from "@/lib/format";
import { PageHeader, Badge, Stat, Empty } from "@/components/ui";
import RateFields from "@/components/RateFields";
import CopyField from "@/components/CopyField";
import { updateAffiliate, deleteAffiliate, changeAffiliateStatus } from "@/app/actions/admin";
import ConfirmButton from "@/components/ConfirmButton";

export default async function AffiliateDetail({ params, searchParams }) {
  const a = await prisma.affiliate.findUnique({ where: { id: params.id } });
  if (!a) notFound();
  const s = await getSettings();
  const [st, referrals, payouts] = await Promise.all([
    summary({ affiliateId: a.id }),
    prisma.referral.findMany({ where: { affiliateId: a.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.payout.findMany({ where: { affiliateId: a.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const m = (v) => money(v, s.currency);

  return (
    <>
      <PageHeader title={fullName(a)} subtitle={`${a.email} · joined ${date(a.createdAt)}${a.crmSyncedAt ? ` · FluentCRM synced ${date(a.crmSyncedAt)}` : ""}`}>
        <Badge value={a.status} />
        {a.status !== "ACTIVE" && <form action={changeAffiliateStatus.bind(null, a.id, "ACTIVE")}><button className="btn-primary">Approve / activate</button></form>}
        {a.status === "ACTIVE" && <form action={changeAffiliateStatus.bind(null, a.id, "INACTIVE")}><button className="btn-secondary">Deactivate</button></form>}
      </PageHeader>
      {searchParams.saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved.</p>}
      {searchParams.error === "code" && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">That referral code is already taken.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total earned" value={m(st.earned)} hint={`${st.referrals} sales · ${m(st.revenue)} revenue`} />
        <Stat label="Unpaid" value={m(st.unpaid)} />
        <Stat label="Paid out" value={m(st.paid)} />
        <Stat label="Visits" value={st.visits} hint={`${st.conversionRate.toFixed(1)}% conversion`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <form action={updateAffiliate.bind(null, a.id)} className="card space-y-4 p-6 xl:col-span-2">
          <div className="font-medium">Details</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">First name</label><input name="firstName" defaultValue={a.firstName || ""} className="input" /></div>
            <div><label className="label">Last name</label><input name="lastName" defaultValue={a.lastName || ""} className="input" /></div>
            <div><label className="label">Payment email</label><input name="paymentEmail" defaultValue={a.paymentEmail || ""} className="input" /></div>
            <div><label className="label">Website</label><input name="website" defaultValue={a.website || ""} className="input" /></div>
            <div><label className="label">Referral code</label><input name="code" defaultValue={a.code} className="input font-mono" /></div>
            <div><label className="label">Status</label>
              <select name="status" defaultValue={a.status} className="input"><option>ACTIVE</option><option>PENDING</option><option>INACTIVE</option><option>REJECTED</option></select>
            </div>
            <div className="sm:col-span-2"><label className="label">Coupon codes (comma separated)</label><input name="coupons" defaultValue={a.coupons.join(", ")} className="input" placeholder="JANE10, JANE-VIP" />
              <p className="mt-1 text-xs text-slate-400">Orders using these WooCommerce coupons credit this affiliate even without a link click.</p></div>
          </div>
          <RateFields rateType={a.rateType} rate={a.rate} hint={`Default is ${s.defaultRateType === "FLAT" ? m(s.defaultRate) : s.defaultRate + "%"}. Product-level rates take priority.`} />
          <div><label className="label">Private notes</label><textarea name="notes" rows={3} defaultValue={a.notes || ""} className="input" /></div>
          {a.promotionPlan && <div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="text-xs font-medium text-slate-500">How they plan to promote</div>{a.promotionPlan}</div>}
          <button className="btn-primary">Save changes</button>
        </form>
        <div className="space-y-6">
          <div className="card space-y-3 p-6">
            <div className="font-medium">Referral links</div>
            <CopyField value={affiliateLink(s, a)} />
            <CopyField value={`${process.env.APP_URL}/r/${a.code}`} />
            {a.legacyId && <p className="text-xs text-slate-400">Old AffiliateWP links using ?{s.referralVar}={a.legacyId} still credit this affiliate.</p>}
          </div>
          <div className="card">
            <div className="px-5 py-4 font-medium">Payouts</div>
            {payouts.map((p) => (
              <div key={p.id} className="flex justify-between border-t border-slate-100 px-5 py-2 text-sm"><span>{date(p.createdAt)}</span><span>{m(p.amount)}</span></div>
            ))}
            {!payouts.length && <Empty>No payouts yet</Empty>}
          </div>
          <form action={deleteAffiliate.bind(null, a.id)}><ConfirmButton className="btn-danger w-full" message="Delete this affiliate and all their referrals, visits and payouts? This cannot be undone.">Delete affiliate and their history</ConfirmButton></form>
        </div>
      </div>
      <div className="card mt-6 overflow-x-auto">
        <div className="flex justify-between px-5 py-4 font-medium">Recent referrals <Link href={`/admin/referrals?affiliate=${a.id}`} className="text-sm font-normal text-cosmic-600">View all</Link></div>
        <table className="table"><thead><tr><th>Date</th><th>Order</th><th>Products</th><th>Order total</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>{referrals.map((r) => (
            <tr key={r.id}><td>{date(r.createdAt)}</td><td>{r.orderId || "—"}</td><td className="max-w-xs truncate">{r.description}</td><td>{m(r.orderTotal)}</td><td>{m(r.amount)}</td><td><Badge value={r.status} /></td></tr>
          ))}</tbody>
        </table>
        {!referrals.length && <Empty>No referrals yet</Empty>}
      </div>
    </>
  );
}
