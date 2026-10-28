import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import Link from "next/link";
import { PageHeader, Badge, Empty } from "@/components/ui";

const TYPE = { sale: "Sale", recurring: "Renewal", tier: "Network", bonus: "Bonus", signup: "Sign-up" };

export default async function MyReferrals() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  const rows = await prisma.referral.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <>
      <PageHeader title="Referrals" subtitle="Every commission credited to you. Unpaid = earned and waiting for the monthly payout. Pending = awaiting review. Something wrong? Use ⚑ Flag.">
        <Link href="/dashboard/disputes/new?category=missing" className="btn-secondary">Report a missing sale</Link>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Date</th><th>Type</th><th>Purchase</th>{s.showCustomerDetails && <th>Customer</th>}<th>Order total</th><th>Commission</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="whitespace-nowrap">{date(r.createdAt)}</td><td className="text-xs">{TYPE[r.type] || r.type}{r.source === "coupon" ? " · coupon" : r.source === "lifetime" ? " · lifetime" : ""}</td>
              <td>{r.description}</td>{s.showCustomerDetails && <td className="text-xs">{r.customerName || "—"}</td>}
              <td>{Number(r.orderTotal) ? money(r.orderTotal, r.currency) : "—"}</td><td className="font-medium">{money(r.amount, r.currency)}</td><td><Badge value={r.status} />{r.status === "UNPAID" && r.clearsAt && r.clearsAt > new Date() && <div className="mt-1 text-xs text-slate-400">clears {date(r.clearsAt)}</div>}</td>
              <td><Link href={`/dashboard/disputes/new?referral=${r.id}`} className="text-xs text-slate-500 hover:text-red-600" title="Raise a query about this commission">⚑ Flag</Link></td></tr>
          ))}</tbody>
        </table>
        {!rows.length && <Empty>No referrals yet</Empty>}
      </div>
    </>
  );
}
