import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { nextPayoutDate } from "@/lib/payouts";
import { payTo, describe } from "@/lib/payoutMethods";
import Link from "next/link";
import { PageHeader, Badge, Empty } from "@/components/ui";

export default async function MyPayouts() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  const rows = await prisma.payout.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Payouts" subtitle={`We pay once a month (next run ${date(nextPayoutDate(s))}) to ${describe(payTo(affiliate))}; change this under Account. Each commission clears ${s.holdDays} days after the sale (our refund window), and we pay once your cleared balance reaches ${money(s.minimumPayout, s.currency)}.`} />
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p.id}><td>{date(p.createdAt)}</td><td>{money(p.amount, p.currency)}{p.kind === "manual" && p.reason && <div className="text-xs text-slate-400">{p.reason}</div>}</td><td className="capitalize">{p.method}</td><td><Badge value={p.status} /></td><td><Link href={`/dashboard/disputes/new?payout=${p.id}`} className="text-xs text-slate-500 hover:text-red-600">⚑ Flag</Link></td></tr>)}</tbody>
        </table>
        {!rows.length && <Empty>No payouts yet</Empty>}
      </div>
    </>
  );
}
