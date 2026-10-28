import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";

export default async function MyReferrals() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  const rows = await prisma.referral.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <>
      <PageHeader title="Referrals" subtitle="Every sale credited to you. Unpaid = earned and waiting for the next payout." />
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Date</th><th>Purchase</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td className="whitespace-nowrap">{date(r.createdAt)}</td><td>{r.description}</td><td>{money(r.amount, r.currency)}</td><td><Badge value={r.status} /></td></tr>)}</tbody>
        </table>
        {!rows.length && <Empty>No referrals yet</Empty>}
      </div>
    </>
  );
}
