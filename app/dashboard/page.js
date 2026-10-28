import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { summary, dailyEarnings } from "@/lib/stats";
import { money, affiliateLink, date } from "@/lib/format";
import { Stat, PageHeader, BarChart, Badge, Empty } from "@/components/ui";
import CopyField from "@/components/CopyField";

export default async function Dashboard() {
  const { affiliate: a } = await requireAffiliate();
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  const where = { affiliateId: a.id };
  const [all, month, daily, recent, newProducts] = await Promise.all([
    summary(where),
    summary(where, new Date(Date.now() - 30 * 864e5)),
    dailyEarnings(where, 30),
    prisma.referral.findMany({ where, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.product.findMany({ where: { deleted: false, status: "publish", commissionEnabled: true }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const rate = a.rate != null ? (a.rateType === "FLAT" ? m(a.rate) : `${Number(a.rate)}%`) : s.defaultRateType === "FLAT" ? m(s.defaultRate) : `${s.defaultRate}%`;

  return (
    <>
      <PageHeader title={`Welcome back${a.firstName ? `, ${a.firstName}` : ""}`} subtitle={`You earn ${rate} on every sale you refer · ${s.cookieDays}-day cookie`} />
      <div className="card mb-6 p-5">
        <div className="mb-2 text-sm font-medium">Your main referral link</div>
        <CopyField value={affiliateLink(s, a)} />
        <p className="mt-2 text-xs text-slate-400">Add <code>?{s.referralVar}={a.code}</code> to any truecosmic.com page to make it your link, or use the Products & links page.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Earned (30 days)" value={m(month.earned)} hint={`${month.referrals} ${month.referrals === 1 ? "sale" : "sales"}`} />
        <Stat label="Waiting to be paid" value={m(all.unpaid)} hint={`Paid when you reach ${m(s.minimumPayout)}`} />
        <Stat label="Paid to you" value={m(all.paid)} hint="All time" />
        <Stat label="Clicks (30 days)" value={month.visits} hint={`${month.conversionRate.toFixed(1)}% became sales`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2"><div className="mb-4 font-medium">Your earnings, last 30 days</div><BarChart data={daily} format={m} /></div>
        <div className="card">
          <div className="flex justify-between px-5 py-4 font-medium">New in the academy <Link href="/dashboard/links" className="text-sm font-normal text-cosmic-600">All products</Link></div>
          {newProducts.map((p) => (
            <div key={p.id} className="border-t border-slate-100 px-5 py-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{p.name}</span><Badge value={p.kind} /></div>
              <div className="text-xs text-slate-400">Added {date(p.createdAt)} · {m(p.price)}</div>
            </div>
          ))}
          {!newProducts.length && <Empty>Products will appear here</Empty>}
        </div>
      </div>
      <div className="card mt-6 overflow-x-auto">
        <div className="flex justify-between px-5 py-4 font-medium">Latest referrals <Link href="/dashboard/referrals" className="text-sm font-normal text-cosmic-600">View all</Link></div>
        <table className="table"><thead><tr><th>Date</th><th>Purchase</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>{recent.map((r) => <tr key={r.id}><td>{date(r.createdAt)}</td><td>{r.description}</td><td>{m(r.amount)}</td><td><Badge value={r.status} /></td></tr>)}</tbody>
        </table>
        {!recent.length && <Empty>Your first sale will show up here. Share your link to get started!</Empty>}
      </div>
    </>
  );
}
