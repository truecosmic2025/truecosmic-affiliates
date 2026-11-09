import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { summary } from "@/lib/stats";
import { parseRange, dateWhere, series } from "@/lib/range";
import { rateFor } from "@/lib/commission";
import { commissionContext } from "@/lib/referrals";
import { money, affiliateLink, date } from "@/lib/format";
import { nextPayoutDate } from "@/lib/payouts";
import { Stat, BarChart, Badge, Empty } from "@/components/ui";
import RangePicker from "@/components/RangePicker";
import CopyField from "@/components/CopyField";
import QrCode from "@/components/QrCode";
import Icon from "@/components/Icon";

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

  const toMinimum = Math.min(100, Math.round((all.payable / Math.max(1, Number(s.minimumPayout))) * 100));
  const steps = [
    { done: true, label: "Join the programme" },
    { done: !!(a.payoutMethod || a.paymentEmail), label: "Choose how you get paid", href: "/dashboard/account" },
    { done: all.visits > 0, label: "Get your first click", href: "/dashboard/links" },
    { done: all.referrals > 0, label: "Make your first sale", href: "/dashboard/links" },
  ];
  const doneCount = steps.filter((x) => x.done).length;

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-cosmic-900 via-[#3b1d8f] to-cosmic-600 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-[260px] flex-1">
            <p className="text-sm font-medium text-cosmic-100">Affiliate Hub</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back{a.firstName ? `, ${a.firstName}` : ""}</h1>
            <p className="mt-2 max-w-xl text-sm text-cosmic-100">
              You earn <strong className="text-white">{rate}</strong> on every sale you refer{r.via === "tier" ? " (tier bonus rate)" : ""}. Your link remembers visitors for {s.cookieDays} days{s.lifetimeCommissions ? ", and you earn on your customers' future orders too" : ""}.
            </p>
            <div className="mt-5 max-w-xl rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-cosmic-100">Your referral link</div>
              <div className="[&_.input]:border-white/20 [&_.input]:bg-white [&_.input]:text-slate-800"><CopyField value={link} /></div>
              <p className="mt-2 text-xs text-cosmic-100">Works on any truecosmic.com page: add <code className="rounded bg-white/15 px-1">?{s.referralVar}={a.code}</code>.{a.dynamicCoupon && <> Your coupon: <span className="font-mono font-semibold text-white">{a.dynamicCoupon}</span></>}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-2xl bg-white p-2"><QrCode value={link} size={112} /></div>
            <span className="text-xs text-cosmic-100">Scan or save your QR code</span>
          </div>
        </div>
      </section>

      {doneCount < steps.length && (
        <section className="card mb-6 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="section-title">Getting started</div>
            <div className="text-xs font-medium text-slate-500">{doneCount} of {steps.length} done</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((st) => {
              const body = (
                <>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${st.done ? "bg-emerald-500 text-white" : "border-2 border-[#D6D0E6] text-transparent"}`}><Icon name="check" className="h-3.5 w-3.5" /></span>
                  <span className={st.done ? "text-slate-400 line-through" : "font-medium text-slate-800"}>{st.label}</span>
                </>
              );
              return st.done || !st.href
                ? <div key={st.label} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm">{body}</div>
                : <Link key={st.label} href={st.href} className="flex items-center gap-3 rounded-xl bg-cosmic-50 px-3 py-3 text-sm ring-1 ring-cosmic-100 hover:ring-cosmic-200">{body}</Link>;
            })}
          </div>
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Your results</h2>
        <RangePicker base="/dashboard" range={range} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="trend" label={`Earned · ${range.label}`} value={m(period.earned)} hint={`${period.referrals} sale${period.referrals === 1 ? "" : "s"}`} />
        <Stat icon="cursor" tone="sky" label={`Clicks · ${range.label}`} value={period.visits} hint={`${period.conversionRate.toFixed(1)}% became sales`} />
        <Stat icon="wallet" tone="green" label="Paid to you" value={m(all.paid)} hint={all.inFlight ? `${m(all.inFlight)} on its way now` : "All time"} />
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="muted font-medium">Next payout</div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Icon name="calendar" className="h-[18px] w-[18px]" /></span>
          </div>
          <div className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-slate-900">{m(all.payable)}</div>
          <div className="mt-1 text-xs text-slate-500">{all.payable >= s.minimumPayout ? `Ready for ${date(nextPayoutDate(s))}` : `${m(Math.max(0, s.minimumPayout - all.payable))} to go until ${m(s.minimumPayout)}`}</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={toMinimum} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to minimum payout"><div className="h-full rounded-full bg-gradient-to-r from-cosmic-500 to-cosmic-600" style={{ width: `${toMinimum}%` }} /></div>
          {all.clearing > 0 && <div className="mt-2 text-xs text-slate-500">+ {m(all.clearing)} still in the 30-day refund window</div>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="card p-5"><div className="section-title mb-4">Earnings</div><BarChart data={series(refs, range, (x) => Number(x.amount))} format={m} /></div>
        <div className="card p-5"><div className="section-title mb-4">Clicks</div><BarChart data={series(visits, range)} /></div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card overflow-x-auto xl:col-span-2">
          <div className="flex items-center justify-between px-5 py-4"><span className="section-title">Latest sales</span><Link href="/dashboard/referrals" className="text-sm font-medium text-cosmic-600">View all</Link></div>
          <table className="table"><thead><tr><th>Date</th><th>Purchase</th><th>You earn</th><th>Status</th></tr></thead>
            <tbody>{recent.map((x) => <tr key={x.id}><td className="whitespace-nowrap text-slate-500">{date(x.createdAt)}</td><td className="font-medium">{x.description}</td><td className="font-semibold">{m(x.amount)}</td><td><Badge value={x.status} /></td></tr>)}</tbody>
          </table>
          {!recent.length && <Empty>Your first sale will show up here. Share your link to get started.</Empty>}
        </div>
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4"><span className="section-title">New to promote</span><Link href="/dashboard/links" className="text-sm font-medium text-cosmic-600">All products</Link></div>
          {newProducts.map((p) => (
            <Link key={p.id} href="/dashboard/links" className="flex items-center gap-3 border-t border-slate-100 px-5 py-3 text-sm hover:bg-slate-50">
              {p.image
                ? <img src={p.image} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 object-cover ring-1 ring-slate-200" />
                : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cosmic-50 text-cosmic-600"><Icon name="spark" className="h-5 w-5" /></span>}
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="text-xs text-slate-500">{m(p.price)} · added {date(p.createdAt)}</span></span>
              <Badge value={p.kind} />
            </Link>
          ))}
          {!newProducts.length && <Empty>New products will appear here</Empty>}
        </div>
      </div>
    </>
  );
}
