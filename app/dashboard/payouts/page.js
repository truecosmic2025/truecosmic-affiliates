import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";

export default async function MyPayouts() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  const rows = await prisma.payout.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Payouts" subtitle={`Paid to ${affiliate.paymentEmail || affiliate.email} once your balance reaches ${money(s.minimumPayout, s.currency)}. Change this under Account.`} />
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p.id}><td>{date(p.createdAt)}</td><td>{money(p.amount, p.currency)}</td><td className="capitalize">{p.method}</td><td><Badge value={p.status} /></td></tr>)}</tbody>
        </table>
        {!rows.length && <Empty>No payouts yet</Empty>}
      </div>
    </>
  );
}
