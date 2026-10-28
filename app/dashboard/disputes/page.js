import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { DISPUTE_STATUS, DISPUTE_TYPES, STATUS_CLASS } from "@/lib/disputes";
import { date } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";


export default async function MyDisputes({ searchParams }) {
  const { affiliate } = await requireAffiliate();
  const disputes = await prisma.dispute.findMany({ where: { affiliateId: affiliate.id }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { messages: true } } } });
  return (
    <>
      <PageHeader title="Disputes & queries" subtitle="Think a sale is missing, a commission is wrong, or a payout hasn't arrived? Raise it here and our accounts team will reply.">
        <Link href="/dashboard/disputes/new" className="btn-primary">Raise a query</Link>
      </PageHeader>
      {searchParams.error === "limit" && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">You've raised a lot of queries today. Please add to an existing one instead.</p>}
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Subject</th><th>Type</th><th>Raised</th><th>Last update</th><th>Messages</th><th>Status</th></tr></thead>
          <tbody>{disputes.map((d) => (
            <tr key={d.id}><td><Link href={`/dashboard/disputes/${d.id}`} className="font-medium text-cosmic-700">{d.subject}</Link></td>
              <td className="text-xs">{DISPUTE_TYPES[d.category]?.split(" (")[0]}</td><td>{date(d.createdAt)}</td><td>{date(d.updatedAt)}</td><td>{d._count.messages}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[d.status]}`}>{DISPUTE_STATUS[d.status]}</span></td></tr>
          ))}</tbody>
        </table>
        {!disputes.length && <Empty>No queries raised. Use the “Flag” link next to any referral or payout to raise one about it.</Empty>}
      </div>
    </>
  );
}
