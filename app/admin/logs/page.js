import { prisma } from "@/lib/db";
import { PageHeader, Badge, Empty } from "@/components/ui";

export default async function Logs({ searchParams }) {
  const status = searchParams.status;
  const rows = await prisma.eventLog.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageHeader title="Activity log" subtitle="Webhooks from WordPress, FluentCRM syncs, imports and emails">
        <a href="/admin/logs" className="btn-secondary btn-sm">All</a>
        <a href="/admin/logs?status=error" className="btn-secondary btn-sm">Errors only</a>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Event</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="whitespace-nowrap">{r.createdAt.toLocaleString("en-GB")}</td><td className="font-mono text-xs">{r.kind}</td><td><Badge value={r.status} /></td><td className="max-w-xl break-words text-xs">{r.message}</td></tr>
          ))}</tbody>
        </table>
        {!rows.length && <Empty>Nothing logged yet</Empty>}
      </div>
    </>
  );
}
