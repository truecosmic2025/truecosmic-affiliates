import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, fullName, date } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";

export default async function Customers({ searchParams }) {
  const s = await getSettings();
  const q = searchParams.q?.trim();
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    include: { affiliate: true, referrals: { where: { status: { in: ["UNPAID", "PAID"] } }, select: { orderTotal: true, type: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <>
      <PageHeader title="Customers" subtitle={s.lifetimeCommissions ? "Customers are linked to the affiliate who first referred them; that affiliate earns on all their future orders (lifetime commissions)." : "Customers who bought through an affiliate. Turn on lifetime commissions in Settings to credit their future orders too."} />
      <form className="mb-4 flex max-w-md gap-2"><input name="q" defaultValue={q} placeholder="Search email or name" className="input" /><button className="btn-secondary">Search</button></form>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Customer</th><th>Linked affiliate</th><th>Referred orders</th><th>Revenue</th><th>First seen</th></tr></thead>
          <tbody>{customers.map((c) => {
            const orders = c.referrals.filter((r) => ["sale", "recurring"].includes(r.type));
            return (
              <tr key={c.id}><td>{c.name || "—"}<div className="text-xs text-slate-400">{c.email}</div></td>
                <td>{c.affiliate ? <Link href={`/admin/affiliates/${c.affiliate.id}`} className="text-cosmic-700">{fullName(c.affiliate)}</Link> : "—"}</td>
                <td>{orders.length}</td><td>{money(orders.reduce((x, r) => x + Number(r.orderTotal), 0), s.currency)}</td><td>{date(c.createdAt)}</td></tr>
            );
          })}</tbody>
        </table>
        {!customers.length && <Empty>No customers yet</Empty>}
      </div>
    </>
  );
}
