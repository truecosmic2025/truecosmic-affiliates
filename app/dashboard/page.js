import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { summary } from "@/lib/stats";
import { parseRange, dateWhere, series } from "@/lib/range";
import { rateFor } from "@/lib/commission";
import { commissionContext } from "@/lib/referrals";
import { money, affiliateLink, date } from "@/lib/format";
import { Stat, PageHeader, BarChart, Badge, Empty } from "@/components/ui";
import RangePicker from "@/components/RangePicker";
import CopyField from "@/components/CopyField";
import QrCode from "@/components/QrCode";

export default async function Dashboard({ searchParams }) {
  const { affiliate: a } = await requireAffiliate();
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  const range = parseRange(searchParams);
  const where = { affiliateId: a.id };
  const [all, period, refs, visits, recent, newProducts, ctx] = await Promise.all([
    summary(where),
    summary(where, range.from),
    prisma.referral.findMany({ where: { ...where, ...dateWhere(range), status: { in: ["UNPAID", "PAID"] } }, select: { amount: true, createdAt: true } }),
    prisma.visit.findMany({ where: { ...where, ...dateWhere(range) }, select: { createdAt: true } }),
    prisma.referral.findMany({ where, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.product.findMany({ where: { deleted: false, status: "publish", commissionEnabled: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    commissionContext(a, "sale"),
  ]);
  const r = rateFor({ product: null, affiliate: a, settings: s, ctx });
  const rate = r.type === "FLAT" ? m(r.rate) : `${r.rate}%`;
  const link = affiliateLink(s, a);

  return (
    <>
      <PageHeader title={`Welcome back${a.firstName ? `, ${a.firstName}` : ""}`} subtitle={`You earn ${rate} on sales you refer${r.via === "tier" ? " (tier bonus rate!)" : ""} · ${s.cookieDays}-day cookie${s.lifetimeCommissions ? " · lifetime commissions on your customers" : ""}`}>
        <RangePicker base="/dashboard" range={range} />
      </PageHeader>
      <div className="card mb-6 flex flex-wrap items-center gap-5 p-5">
        <div className="min-w-[260px] flex-1">
          <div className="mb-2 text-sm font-medium">Your main referral link</div>
          <CopyField value={link} />
          <p className="mt-2 text-xs text-slate-400">Add <code>?{s.referralVar}={a.code}</code> to any truecosmic.com page, or use <Link href="/dashboard/links" className="text-cosmic-600">Products & links</Link>.{a.dynamicCoupon && <> Your coupon: <span className="font-mono font-medium text-slate-600">{a.dynamicCoupon}</span></>}</p>
        </div>
        <QrCode value={link} size={96} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Earned (${range.label})`} value={m(period.earned)} hint={`${period.referrals} referrals`} />
        <Stat label="Waiting to be paid" value={m(all.unpaid)} hint={all.pending ? `${m(all.pending)} pending approval · paid at ${m(s.minimumPayout)}` : `Paid when you reach ${m(s.minimumPayout)}`} />
        <Stat label="Paid to you" value={m(all.paid)} hint="All time" />
        <Stat label={`Clicks (${range.label})`} value={period.visits} hint={`${period.conversionRate.toFixed(1)}% became sales`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="card p-5"><div className="mb-4 font-medium">Earnings</div><BarChart data={series(refs, range, (x) => Number(x.amount))} format={m} /></div>
        <div className="card p-5"><div className="mb-4 font-medium">Clicks</div><BarChart data={series(visits, range)} /></div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card overflow-x-auto xl:col-span-2">
          <div className="flex justify-between px-5 py-4 font-medium">Latest referrals <Link href="/dashboard/referrals" className="text-sm font-normal text-cosmic-600">View all</Link></div>
          <table className="table"><thead><tr><th>Date</th><th>Purchase</th><th>Commission</th><th>Status</th></tr></thead>
            <tbody>{recent.map((x) => <tr key={x.id}><td>{date(x.createdAt)}</td><td>{x.description}</td><td>{m(x.amount)}</td><td><Badge value={x.status} /></td></tr>)}</tbody>
          </table>
          {!recent.length && <Empty>Your first sale will show up here. Share your link to get started!</Empty>}
        </div>
        <div className="card">
          <div className="flex justify-between px-5 py-4 font-medium">New in the academy <Link href="/dashboard/links" className="text-sm font-normal text-cosmic-600">All</Link></div>
          {newProducts.map((p) => (
            <div key={p.id} className="border-t border-slate-100 px-5 py-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{p.name}</span><Badge value={p.kind} /></div>
              <div className="text-xs text-slate-400">Added {date(p.createdAt)} · {m(p.price)}</div>
            </div>
          ))}
          {!newProducts.length && <Empty>Products will appear here</Empty>}
        </div>
      </div>
    </>
  );
}
