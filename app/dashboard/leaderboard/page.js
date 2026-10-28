import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader, Empty } from "@/components/ui";

export default async function Leaderboard() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  if (!s.showLeaderboard) notFound();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const top = await prisma.referral.groupBy({
    by: ["affiliateId"], where: { type: { in: ["sale", "recurring"] }, status: { in: ["UNPAID", "PAID"] }, createdAt: { gte: start } },
    _count: true, orderBy: { _count: { affiliateId: "desc" } }, take: s.leaderboardSize,
  });
  const affs = await prisma.affiliate.findMany({ where: { id: { in: top.map((t) => t.affiliateId) } }, select: { id: true, firstName: true, lastName: true, code: true } });
  const byId = Object.fromEntries(affs.map((a) => [a.id, a]));
  return (
    <>
      <PageHeader title="Leaderboard" subtitle={`Top affiliates by sales in ${start.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`} />
      <div className="card max-w-xl">
        {top.map((t, i) => {
          const a = byId[t.affiliateId];
          const me = t.affiliateId === affiliate.id;
          return (
            <div key={t.affiliateId} className={`flex items-center gap-4 border-b border-slate-100 px-5 py-3 last:border-0 ${me ? "bg-cosmic-50" : ""}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${i < 3 ? "bg-cosmic-600 text-white" : "bg-slate-100 text-slate-600"}`}>{i + 1}</span>
              <span className="flex-1">{a?.firstName || a?.code}{a?.lastName ? ` ${a.lastName[0]}.` : ""}{me && " (you)"}</span>
              <span className="text-sm text-slate-500">{t._count} sales</span>
            </div>
          );
        })}
        {!top.length && <Empty>No sales yet this month. Be the first!</Empty>}
      </div>
    </>
  );
}
