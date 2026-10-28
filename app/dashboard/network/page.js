import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { PageHeader, Badge, Stat, Empty } from "@/components/ui";
import CopyField from "@/components/CopyField";

export default async function MyNetwork() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  const [recruits, tierEarned] = await Promise.all([
    prisma.affiliate.findMany({ where: { parentId: affiliate.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { children: true } } } }),
    prisma.referral.aggregate({ where: { affiliateId: affiliate.id, type: "tier", status: { in: ["UNPAID", "PAID"] } }, _sum: { amount: true } }),
  ]);
  return (
    <>
      <PageHeader title="My network" subtitle={`Recruit other affiliates and earn ${(s.tierRates || []).map((r, i) => `${r}% on level ${i + 1}`).join(", ")} of their sales.`} />
      <div className="card mb-6 space-y-2 p-5"><div className="text-sm font-medium">Your recruitment link</div><CopyField value={`${process.env.APP_URL}/join?ref=${affiliate.code}`} qr /></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2"><Stat label="Direct recruits" value={recruits.length} /><Stat label="Network earnings" value={money(tierEarned._sum.amount, s.currency)} /></div>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Name</th><th>Joined</th><th>Their recruits</th><th>Status</th></tr></thead>
          <tbody>{recruits.map((r) => <tr key={r.id}><td>{r.firstName} {r.lastName?.[0] ? `${r.lastName[0]}.` : ""}</td><td>{date(r.createdAt)}</td><td>{r._count.children}</td><td><Badge value={r.status} /></td></tr>)}</tbody>
        </table>
        {!recruits.length && <Empty>Nobody yet. Share your recruitment link!</Empty>}
      </div>
    </>
  );
}
