import Link from "next/link";
import { prisma } from "@/lib/db";
import { DISPUTE_STATUS, DISPUTE_TYPES, STATUS_CLASS, accountsContact } from "@/lib/disputes";
import { fullName, date } from "@/lib/format";
import { PageHeader, Tabs, Empty } from "@/components/ui";

export default async function Disputes({ searchParams }) {
  const status = searchParams.status || "active";
  const where = status === "active" ? { status: { in: ["open", "in_review"] } } : status === "all" ? {} : { status };
  const [disputes, counts, acc] = await Promise.all([
    prisma.dispute.findMany({ where, orderBy: { updatedAt: "desc" }, include: { affiliate: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.dispute.groupBy({ by: ["status"], _count: true }),
    accountsContact(),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));
  return (
    <>
      <PageHeader title="Disputes" subtitle={`Queries raised by affiliates. New ones are emailed to ${acc.name} (${acc.email}); change this in Settings → Payout rules.`} />
      <Tabs active={status} items={[
        { key: "active", label: `Needs attention (${(c.open || 0) + (c.in_review || 0)})`, href: "/admin/disputes" },
        ...Object.entries(DISPUTE_STATUS).map(([k, l]) => ({ key: k, label: `${l} (${c[k] || 0})`, href: `/admin/disputes?status=${k}` })),
        { key: "all", label: "All", href: "/admin/disputes?status=all" },
      ]} />
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Subject</th><th>Affiliate</th><th>Type</th><th>Last message</th><th>Updated</th><th>Status</th></tr></thead>
          <tbody>{disputes.map((d) => (
            <tr key={d.id}>
              <td><Link href={`/admin/disputes/${d.id}`} className="font-medium text-cosmic-700">{d.subject}</Link></td>
              <td>{fullName(d.affiliate)}</td>
              <td className="text-xs">{DISPUTE_TYPES[d.category]?.split(" (")[0]}</td>
              <td className="max-w-xs truncate text-xs text-slate-500">{d.messages[0]?.author === "staff" ? "You: " : ""}{d.messages[0]?.body}</td>
              <td className="whitespace-nowrap">{date(d.updatedAt)}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[d.status]}`}>{DISPUTE_STATUS[d.status]}</span></td>
            </tr>
          ))}</tbody>
        </table>
        {!disputes.length && <Empty>Nothing here</Empty>}
      </div>
    </>
  );
}
