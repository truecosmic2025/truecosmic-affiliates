import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { parseRange, dateWhere } from "@/lib/range";
import { domainOf } from "@/lib/visits";
import { PageHeader, Empty } from "@/components/ui";
import RangePicker from "@/components/RangePicker";

export default async function MyVisits({ searchParams }) {
  const { affiliate } = await requireAffiliate();
  const range = parseRange(searchParams);
  const visits = await prisma.visit.findMany({ where: { affiliateId: affiliate.id, ...dateWhere(range) }, orderBy: { createdAt: "desc" }, take: 1000 });
  const campaigns = new Map();
  for (const v of visits) {
    const k = v.campaign || "(no campaign)";
    const c = campaigns.get(k) || { visits: 0, converted: 0 };
    c.visits++;
    if (v.converted) c.converted++;
    campaigns.set(k, c);
  }
  return (
    <>
      <PageHeader title="Visits & campaigns" subtitle="Add &utm_campaign=name (or use the campaign box on Products & links) to see which posts and channels work best.">
        <RangePicker base="/dashboard/visits" range={range} />
      </PageHeader>
      <div className="card mb-6 overflow-x-auto">
        <div className="px-5 py-4 font-medium">Campaigns</div>
        <table className="table"><thead><tr><th>Campaign</th><th>Visits</th><th>Converted</th><th>Conversion rate</th></tr></thead>
          <tbody>{[...campaigns].sort((a, b) => b[1].visits - a[1].visits).map(([k, c]) => <tr key={k}><td>{k}</td><td>{c.visits}</td><td>{c.converted}</td><td>{((c.converted / c.visits) * 100).toFixed(1)}%</td></tr>)}</tbody>
        </table>
        {!campaigns.size && <Empty>No visits in this period</Empty>}
      </div>
      <div className="card overflow-x-auto">
        <div className="px-5 py-4 font-medium">Visits</div>
        <table className="table"><thead><tr><th>When</th><th>Page</th><th>Came from</th><th>Campaign</th><th>Converted</th></tr></thead>
          <tbody>{visits.slice(0, 300).map((v) => (
            <tr key={v.id}><td className="whitespace-nowrap">{v.createdAt.toLocaleString("en-GB")}</td><td className="max-w-xs truncate text-xs">{v.url}</td><td className="text-xs">{domainOf(v.referrer) || "direct"}</td><td>{v.campaign}</td><td>{v.converted ? "✓" : ""}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
