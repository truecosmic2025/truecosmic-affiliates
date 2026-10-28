import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { summary } from "@/lib/stats";
import { money, fullName, date, affiliateLink } from "@/lib/format";
import { PageHeader, Badge, Stat, Empty } from "@/components/ui";
import RateFields from "@/components/RateFields";
import CopyField from "@/components/CopyField";
import ConfirmButton from "@/components/ConfirmButton";
import {
  updateAffiliate, deleteAffiliate, changeAffiliateStatus, rejectAffiliate, generateCoupon, setAffiliateProductRate,
  removeAffiliateProductRate, addLandingPage, removeLandingPage, addDirectLink, setDirectLinkStatus,
} from "@/app/actions/admin";

const ERR = { code: "That referral code is already taken.", parent: "An affiliate can't recruit themselves.", landing: "That landing page is invalid or already assigned." };

export default async function AffiliateDetail({ params, searchParams }) {
  const a = await prisma.affiliate.findUnique({
    where: { id: params.id },
    include: {
      parent: true, children: { orderBy: { createdAt: "desc" } }, group: true, landingPages: true, directLinks: true,
      productRates: { include: { product: true } }, _count: { select: { customers: true } },
    },
  });
  if (!a) notFound();
  const s = await getSettings();
  const [st, referrals, payouts, groups, products, others] = await Promise.all([
    summary({ affiliateId: a.id }),
    prisma.referral.findMany({ where: { affiliateId: a.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.payout.findMany({ where: { affiliateId: a.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.affiliateGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { deleted: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.affiliate.findMany({ where: { NOT: { id: a.id }, status: "ACTIVE" }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, email: true } }),
  ]);
  const m = (v) => money(v, s.currency);
  const reg = a.registration && typeof a.registration === "object" ? Object.entries(a.registration) : [];

  return (
    <>
      <PageHeader title={fullName(a)} subtitle={`${a.email} · joined ${date(a.createdAt)}${a.legacyId ? ` · AffiliateWP #${a.legacyId}` : ""}${a.crmSyncedAt ? ` · FluentCRM synced ${date(a.crmSyncedAt)}` : ""}`}>
        <Badge value={a.status} />
        {a.status !== "ACTIVE" && <form action={changeAffiliateStatus.bind(null, a.id, "ACTIVE")}><button className="btn-primary">Approve / activate</button></form>}
        {a.status === "ACTIVE" && <form action={changeAffiliateStatus.bind(null, a.id, "INACTIVE")}><button className="btn-secondary">Deactivate</button></form>}
      </PageHeader>
      {searchParams.saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved.</p>}
      {searchParams.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERR[searchParams.error]}</p>}
      {a.status === "PENDING" && (
        <form action={rejectAffiliate.bind(null, a.id)} className="card mb-6 flex flex-wrap items-end gap-2 p-5">
          <div className="flex-1"><label className="label">Reject with a reason (included in the email)</label><input name="reason" className="input" placeholder="Optional" /></div>
          <button className="btn-danger">Reject application</button>
        </form>
      )}
      {a.status === "REJECTED" && a.rejectionReason && <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm">Rejected: {a.rejectionReason}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Total earned" value={m(st.earned)} hint={`${st.referrals} referrals · ${m(st.revenue)} revenue`} />
        <Stat label="Unpaid" value={m(st.unpaid)} hint={st.pending ? `${m(st.pending)} pending` : ""} />
        <Stat label="Paid out" value={m(st.paid)} />
        <Stat label="Visits" value={st.visits} hint={`${st.conversionRate.toFixed(1)}% conversion`} />
        <Stat label="Customers" value={a._count.customers} hint={`${a.children.length} recruits`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <form action={updateAffiliate.bind(null, a.id)} className="card space-y-4 p-6 xl:col-span-2">
          <div className="font-medium">Details</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">First name</label><input name="firstName" defaultValue={a.firstName || ""} className="input" /></div>
            <div><label className="label">Last name</label><input name="lastName" defaultValue={a.lastName || ""} className="input" /></div>
            <div><label className="label">Payment email</label><input name="paymentEmail" defaultValue={a.paymentEmail || ""} className="input" /></div>
            <div><label className="label">Website</label><input name="website" defaultValue={a.website || ""} className="input" /></div>
            <div><label className="label">Referral code (custom slug)</label><input name="code" defaultValue={a.code} className="input font-mono" /></div>
            <div><label className="label">Status</label><select name="status" defaultValue={a.status} className="input"><option>ACTIVE</option><option>PENDING</option><option>INACTIVE</option><option>REJECTED</option></select></div>
            <div><label className="label">Group</label><select name="groupId" defaultValue={a.groupId || ""} className="input"><option value="">None</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
            <div><label className="label">Recruited by (multi-tier)</label><select name="parentId" defaultValue={a.parentId || ""} className="input"><option value="">Nobody</option>{others.map((o) => <option key={o.id} value={o.id}>{fullName(o)}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label">Coupon codes (comma separated)</label><input name="coupons" defaultValue={a.coupons.join(", ")} className="input" placeholder="JANE10, JANE-VIP" />
              <p className="mt-1 text-xs text-slate-400">Orders using these WooCommerce coupons credit this affiliate even without a link click.</p></div>
          </div>
          <RateFields rateType={a.rateType} rate={a.rate} hint={`Default is ${s.defaultRateType === "FLAT" ? m(s.defaultRate) : s.defaultRate + "%"}${a.group?.rate != null ? `, group “${a.group.name}” rate applies if blank` : ""}.`} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="emailOnReferral" defaultChecked={a.emailOnReferral} /> Email them about new referrals</label>
          <div><label className="label">Private notes</label><textarea name="notes" rows={3} defaultValue={a.notes || ""} className="input" /></div>
          {(a.promotionPlan || reg.length > 0) && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="mb-1 text-xs font-medium text-slate-500">Application answers</div>
              {a.promotionPlan && <p>{a.promotionPlan}</p>}
              {reg.map(([k, v]) => <p key={k}><span className="text-slate-500">{k}:</span> {String(v)}</p>)}
            </div>
          )}
          <button className="btn-primary">Save changes</button>
        </form>

        <div className="space-y-6">
          <div className="card space-y-3 p-6">
            <div className="font-medium">Links</div>
            <CopyField value={affiliateLink(s, a)} />
            <CopyField value={`${process.env.APP_URL}/r/${a.code}`} />
            {s.multiTier && <CopyField value={`${process.env.APP_URL}/join?ref=${a.code}`} />}
            {a.legacyId && <p className="text-xs text-slate-400">Old links using ?{s.referralVar}={a.legacyId} still credit this affiliate.</p>}
            {a.dynamicCoupon ? <p className="text-sm">Personal coupon: <span className="font-mono">{a.dynamicCoupon}</span></p>
              : <form action={generateCoupon.bind(null, a.id)}><button className="btn-secondary btn-sm">Create personal WooCommerce coupon</button></form>}
          </div>

          <div className="card">
            <div className="px-5 pt-4 font-medium">Landing pages</div>
            {a.landingPages.map((l) => (
              <div key={l.id} className="flex items-center justify-between border-t border-slate-100 px-5 py-2 text-sm">
                <span className="font-mono text-xs">{l.path}</span>
                <form action={removeLandingPage.bind(null, l.id, a.id)}><button className="text-xs text-red-600">remove</button></form>
              </div>
            ))}
            <form action={addLandingPage.bind(null, a.id)} className="flex gap-2 p-4"><input name="path" placeholder="/academy/jane/" className="input py-1 text-xs" /><button className="btn-secondary btn-sm">Add</button></form>
          </div>

          <div className="card">
            <div className="px-5 pt-4 font-medium">Direct link domains</div>
            {a.directLinks.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-t border-slate-100 px-5 py-2 text-sm">
                <span className="font-mono text-xs">{d.domain} <span className="text-slate-400">({d.status})</span></span>
                {d.status !== "approved" && <form action={setDirectLinkStatus.bind(null, d.id, "approved")}><button className="text-xs text-cosmic-600">approve</button></form>}
              </div>
            ))}
            <form action={addDirectLink.bind(null, a.id)} className="flex gap-2 p-4"><input name="domain" placeholder="janesblog.com" className="input py-1 text-xs" /><button className="btn-secondary btn-sm">Add</button></form>
          </div>

          <div className="card">
            <div className="px-5 pt-4 font-medium">Product-specific rates</div>
            {a.productRates.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-t border-slate-100 px-5 py-2 text-sm">
                <span>{r.product.name}: {r.rateType === "FLAT" ? m(r.rate) : `${Number(r.rate)}%`}</span>
                <form action={removeAffiliateProductRate.bind(null, r.id, a.id)}><button className="text-xs text-red-600">remove</button></form>
              </div>
            ))}
            <form action={setAffiliateProductRate.bind(null, a.id)} className="space-y-2 p-4">
              <select name="productId" className="input py-1 text-xs">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <div className="flex gap-2">
                <select name="rateType" className="input py-1 text-xs"><option value="PERCENTAGE">%</option><option value="FLAT">Flat</option></select>
                <input name="rate" type="number" step="0.01" min="0" className="input py-1 text-xs" placeholder="Rate" />
                <button className="btn-secondary btn-sm">Set</button>
              </div>
            </form>
          </div>

          {(a.parent || a.children.length > 0) && (
            <div className="card">
              <div className="px-5 pt-4 font-medium">Network</div>
              {a.parent && <p className="px-5 pt-2 text-sm">Recruited by <Link className="text-cosmic-700" href={`/admin/affiliates/${a.parent.id}`}>{fullName(a.parent)}</Link></p>}
              {a.children.map((c) => (
                <Link key={c.id} href={`/admin/affiliates/${c.id}`} className="flex justify-between border-t border-slate-100 px-5 py-2 text-sm hover:bg-slate-50"><span>{fullName(c)}</span><Badge value={c.status} /></Link>
              ))}
            </div>
          )}

          <div className="card">
            <div className="px-5 py-4 font-medium">Payouts</div>
            {payouts.map((p) => <div key={p.id} className="flex justify-between border-t border-slate-100 px-5 py-2 text-sm"><span>{date(p.createdAt)} · {p.method}</span><span>{m(p.amount)}</span></div>)}
            {!payouts.length && <Empty>No payouts yet</Empty>}
          </div>
          <form action={deleteAffiliate.bind(null, a.id)}><ConfirmButton className="btn-danger w-full" message="Delete this affiliate and all their referrals, visits and payouts? This cannot be undone.">Delete affiliate and their history</ConfirmButton></form>
        </div>
      </div>
      <div className="card mt-6 overflow-x-auto">
        <div className="flex justify-between px-5 py-4 font-medium">Recent referrals <Link href={`/admin/referrals?affiliate=${a.id}`} className="text-sm font-normal text-cosmic-600">View all</Link></div>
        <table className="table"><thead><tr><th>Date</th><th>Order</th><th>Type</th><th>Products</th><th>Order total</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>{referrals.map((r) => (
            <tr key={r.id}><td>{date(r.createdAt)}</td><td>{r.orderId || "—"}</td><td className="text-xs">{r.type}{r.source !== "link" ? ` · ${r.source}` : ""}</td><td className="max-w-xs truncate">{r.description}</td><td>{m(r.orderTotal)}</td><td>{m(r.amount)}</td><td><Badge value={r.status} /></td></tr>
          ))}</tbody>
        </table>
        {!referrals.length && <Empty>No referrals yet</Empty>}
      </div>
    </>
  );
}
