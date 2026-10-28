import { prisma } from "@/lib/db";
import { fullName } from "@/lib/format";
import { parseRange, dateWhere } from "@/lib/range";
import { PageHeader, Empty } from "@/components/ui";
import RangePicker from "@/components/RangePicker";

export default async function Visits({ searchParams }) {
  const range = parseRange(searchParams);
  const where = { ...dateWhere(range), ...(searchParams.flagged ? { flagged: { not: null } } : {}), ...(searchParams.source ? { source: searchParams.source } : {}) };
  const [visits, total, converted] = await Promise.all([
    prisma.visit.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, include: { affiliate: true } }),
    prisma.visit.count({ where }),
    prisma.visit.count({ where: { ...where, converted: true } }),
  ]);
  return (
    <>
      <PageHeader title="Visits" subtitle={`${total} clicks · ${converted} converted (${total ? ((converted / total) * 100).toFixed(1) : 0}%). Repeat clicks from the same visitor within 30 minutes count once.`}>
        <RangePicker base="/admin/visits" range={range} />
      </PageHeader>
      <div className="mb-3 flex flex-wrap gap-1 text-xs">
        {["link", "short", "direct", "landing"].map((s) => <a key={s} href={`/admin/visits?source=${s}&range=${range.key}`} className={`rounded-full px-3 py-1 ring-1 ring-slate-200 ${searchParams.source === s ? "bg-cosmic-600 text-white" : "bg-white"}`}>{s}</a>)}
        <a href={`/admin/visits?flagged=1&range=${range.key}`} className="rounded-full bg-white px-3 py-1 text-red-700 ring-1 ring-red-200">flagged</a>
        <a href={`/api/admin/export/visits?range=${range.key}`} className="btn-secondary btn-sm ml-auto">Export CSV</a>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Affiliate</th><th>Landing page</th><th>Came from</th><th>Campaign</th><th>Type</th><th>Converted</th></tr></thead>
          <tbody>{visits.map((v) => (
            <tr key={v.id} className={v.flagged ? "bg-red-50/40" : ""}>
              <td className="whitespace-nowrap">{v.createdAt.toLocaleString("en-GB")}</td>
              <td>{fullName(v.affiliate)}</td>
              <td className="max-w-xs truncate text-xs">{v.url}</td>
              <td className="max-w-xs truncate text-xs">{v.referrer || "direct"}</td>
              <td>{v.campaign}</td>
              <td className="text-xs">{v.source}{v.flagged && <span className="ml-1 font-medium text-red-600">⚑ {v.flagged}</span>}</td>
              <td>{v.converted ? "✓" : ""}</td>
            </tr>
          ))}</tbody>
        </table>
        {!visits.length && <Empty>No visits in this period</Empty>}
      </div>
    </>
  );
}
