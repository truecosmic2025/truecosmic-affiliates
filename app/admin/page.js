import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { summary, dailyEarnings } from "@/lib/stats";
import { money, fullName, date } from "@/lib/format";
import { Stat, PageHeader, BarChart, Badge, Empty } from "@/components/ui";

export default async function AdminHome() {
  const s = await getSettings();
  const since = new Date(Date.now() - 30 * 864e5);
  const [all, month, daily, pendingApps, top, recent, products] = await Promise.all([
    summary(),
    summary({}, since),
    dailyEarnings({}, 30),
    prisma.affiliate.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.referral.groupBy({ by: ["affiliateId"], where: { status: { in: ["UNPAID", "PAID"] }, createdAt: { gte: since } }, _sum: { amount: true, orderTotal: true }, _count: true, orderBy: { _sum: { amount: "desc" } }, take: 5 }),
    prisma.referral.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { affiliate: true } }),
    prisma.product.count({ where: { deleted: false } }),
  ]);
  const topAffs = await prisma.affiliate.findMany({ where: { id: { in: top.map((t) => t.affiliateId) } } });
  const byId = Object.fromEntries(topAffs.map((a) => [a.id, a]));
  const m = (v) => money(v, s.currency);

  return (
    <>
      <PageHeader title="Overview" subtitle="Last 30 days unless noted">
        <Link href="/admin/affiliates/new" className="btn-primary">Add affiliate</Link>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Affiliate-driven revenue" value={m(month.revenue)} hint={`${month.referrals} ${month.referrals === 1 ? "sale" : "sales"}`} />
        <Stat label="Commission earned" value={m(month.earned)} hint={`All time ${m(all.earned)}`} />
        <Stat label="Unpaid commission" value={m(all.unpaid)} hint={all.pending ? `${m(all.pending)} awaiting approval` : "All time"} />
        <Stat label="Visits / conversion" value={`${month.visits}`} hint={`${month.conversionRate.toFixed(1)}% converted`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 font-medium">Daily commission</div>
          <BarChart data={daily} format={m} />
        </div>
        <div className="card">
          <div className="border-b border-slate-100 px-5 py-4 font-medium">Applications waiting</div>
          {pendingApps.length ? pendingApps.map((a) => (
            <Link key={a.id} href={`/admin/affiliates/${a.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
              <span>{fullName(a)}<span className="block text-xs text-slate-400">{a.email}</span></span>
              <span className="text-xs text-slate-400">{date(a.createdAt)}</span>
            </Link>
          )) : <Empty>No pending applications</Empty>}
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="card overflow-x-auto">
          <div className="px-5 py-4 font-medium">Top affiliates (30 days)</div>
          <table className="table"><thead><tr><th>Affiliate</th><th>Sales</th><th>Revenue</th><th>Commission</th></tr></thead>
            <tbody>{top.map((t) => (
              <tr key={t.affiliateId}><td><Link className="text-cosmic-600" href={`/admin/affiliates/${t.affiliateId}`}>{byId[t.affiliateId] ? fullName(byId[t.affiliateId]) : "—"}</Link></td><td>{t._count}</td><td>{m(t._sum.orderTotal)}</td><td>{m(t._sum.amount)}</td></tr>
            ))}</tbody>
          </table>
          {!top.length && <Empty>No sales yet</Empty>}
        </div>
        <div className="card overflow-x-auto">
          <div className="px-5 py-4 font-medium">Latest referrals</div>
          <table className="table"><thead><tr><th>Affiliate</th><th>For</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{recent.map((r) => (
              <tr key={r.id}><td>{fullName(r.affiliate)}</td><td className="max-w-[200px] truncate">{r.description}</td><td>{m(r.amount)}</td><td><Badge value={r.status} /></td></tr>
            ))}</tbody>
          </table>
          {!recent.length && <Empty>No referrals yet</Empty>}
        </div>
      </div>
      <p className="mt-6 muted">{products} products synced from WooCommerce · <Link href="/admin/products" className="text-cosmic-600">manage</Link></p>
    </>
  );
}
