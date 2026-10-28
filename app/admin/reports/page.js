import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseRange, dateWhere, series } from "@/lib/range";
import { domainOf } from "@/lib/visits";
import { money, fullName } from "@/lib/format";
import { PageHeader, Stat, BarChart, Tabs, Empty } from "@/components/ui";
import RangePicker from "@/components/RangePicker";

const EARNED = ["UNPAID", "PAID"];

function Table({ title, head, rows }) {
  return (
    <div className="card overflow-x-auto">
      <div className="px-5 py-4 font-medium">{title}</div>
      <table className="table"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <Empty>No data for this period</Empty>}
    </div>
  );
}

export default async function Reports({ searchParams }) {
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  const range = parseRange(searchParams);
  const tab = searchParams.tab || "overview";
  const dw = dateWhere(range);
  const [refs, visits, payouts, newAffs] = await Promise.all([
    prisma.referral.findMany({ where: { ...dw, status: { in: EARNED } }, include: { affiliate: true } }),
    prisma.visit.findMany({ where: dw, select: { createdAt: true, referrer: true, campaign: true, converted: true, source: true, flagged: true, affiliateId: true } }),
    prisma.payout.aggregate({ where: { ...dw, status: "PAID" }, _sum: { amount: true }, _count: true }),
    prisma.affiliate.count({ where: dw }),
  ]);
  const sales = refs.filter((r) => ["sale", "recurring"].includes(r.type));
  const revenue = sales.reduce((x, r) => x + Number(r.orderTotal), 0);
  const commission = refs.reduce((x, r) => x + Number(r.amount), 0);
  const conv = visits.filter((v) => v.converted).length;
  const qs = `&range=${range.key}${searchParams.from ? `&from=${searchParams.from}` : ""}${searchParams.to ? `&to=${searchParams.to}` : ""}`;

  const group = (list, keyFn, init = () => ({ count: 0, amount: 0, revenue: 0 })) => {
    const map = new Map();
    for (const r of list) {
      const k = keyFn(r);
      if (k == null) continue;
      const g = map.get(k) || init();
      g.count++;
      g.amount += Number(r.amount || 0);
      g.revenue += Number(r.orderTotal || 0);
      map.set(k, g);
    }
    return [...map].sort((a, b) => b[1].amount - a[1].amount || b[1].count - a[1].count);
  };

  let body;
  if (tab === "affiliates") {
    const vByAff = group(visits, (v) => v.affiliateId);
    const vc = Object.fromEntries(vByAff.map(([k, g]) => [k, g.count]));
    body = <Table title="Affiliate performance" head={["Affiliate", "Visits", "Sales", "Conversion", "Revenue", "Commission"]}
      rows={group(refs, (r) => r.affiliateId).map(([id, g]) => {
        const a = refs.find((r) => r.affiliateId === id).affiliate;
        const salesN = sales.filter((r) => r.affiliateId === id).length;
        return [<Link key="a" className="text-cosmic-700" href={`/admin/affiliates/${id}`}>{fullName(a)}</Link>, vc[id] || 0, salesN, vc[id] ? `${((salesN / vc[id]) * 100).toFixed(1)}%` : "—", m(g.revenue), m(g.amount)];
      })} />;
  } else if (tab === "products") {
    const map = new Map();
    for (const r of sales) for (const l of Array.isArray(r.items) ? r.items : []) {
      const g = map.get(l.name) || { qty: 0, revenue: 0, commission: 0 };
      g.qty += Number(l.quantity || 1); g.revenue += Number(l.total || 0); g.commission += Number(l.commission || 0);
      map.set(l.name, g);
    }
    body = <Table title="Products sold by affiliates" head={["Product", "Units", "Revenue", "Commission"]}
      rows={[...map].sort((a, b) => b[1].revenue - a[1].revenue).map(([n, g]) => [n, g.qty, m(g.revenue), m(g.commission)])} />;
  } else if (tab === "campaigns") {
    const vc = group(visits, (v) => v.campaign || null);
    const rc = Object.fromEntries(group(refs, (r) => r.campaign || null));
    body = <Table title="Campaigns" head={["Campaign", "Visits", "Conversions", "Commission"]}
      rows={vc.map(([c, g]) => [c, g.count, rc[c]?.count || 0, m(rc[c]?.amount || 0)])} />;
  } else if (tab === "sources") {
    body = (
      <div className="grid gap-6 xl:grid-cols-2">
        <Table title="Referring websites" head={["Website", "Visits", "Converted"]}
          rows={group(visits, (v) => domainOf(v.referrer) || "direct / app").map(([d, g]) => [d, g.count, visits.filter((v) => (domainOf(v.referrer) || "direct / app") === d && v.converted).length])} />
        <Table title="How sales were credited" head={["Method", "Referrals", "Commission"]}
          rows={group(refs, (r) => `${r.type} · ${r.source}`).map(([k, g]) => [k, g.count, m(g.amount)])} />
      </div>
    );
  } else {
    body = (
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card p-5"><div className="mb-4 font-medium">Commission</div><BarChart data={series(refs, range, (r) => Number(r.amount))} format={m} /></div>
        <div className="card p-5"><div className="mb-4 font-medium">Affiliate revenue</div><BarChart data={series(sales, range, (r) => Number(r.orderTotal))} format={m} /></div>
        <div className="card p-5"><div className="mb-4 font-medium">Visits</div><BarChart data={series(visits, range)} /></div>
        <div className="card p-5"><div className="mb-4 font-medium">Sales</div><BarChart data={series(sales, range)} /></div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Reports" subtitle={range.label}>
        <RangePicker base="/admin/reports" range={range} extra={`&tab=${tab}`} />
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="Revenue" value={m(revenue)} />
        <Stat label="Commission" value={m(commission)} hint={revenue ? `${((commission / revenue) * 100).toFixed(1)}% of revenue` : ""} />
        <Stat label="Sales" value={sales.length} />
        <Stat label="Visits" value={visits.length} hint={`${visits.length ? ((conv / visits.length) * 100).toFixed(1) : 0}% converted · ${visits.filter((v) => v.flagged).length} flagged`} />
        <Stat label="Paid out" value={m(payouts._sum.amount)} hint={`${payouts._count} payouts`} />
        <Stat label="New affiliates" value={newAffs} />
      </div>
      <Tabs active={tab} items={[["overview", "Overview"], ["affiliates", "Affiliates"], ["products", "Products"], ["campaigns", "Campaigns"], ["sources", "Traffic & credit"]].map(([k, l]) => ({ key: k, label: l, href: `/admin/reports?tab=${k}${qs}` }))} />
      {body}
      <div className="card mt-6 flex flex-wrap items-center gap-2 p-5 text-sm">
        <span className="mr-2 font-medium">Export CSV ({range.label}):</span>
        {["affiliates", "referrals", "visits", "payouts", "customers"].map((t) => (
          <a key={t} href={`/api/admin/export/${t}?${qs.slice(1)}`} className="btn-secondary btn-sm capitalize">{t}</a>
        ))}
      </div>
    </>
  );
}
