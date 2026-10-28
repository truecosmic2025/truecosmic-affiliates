import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { payableWhere } from "@/lib/payouts";

export const dynamic = "force-dynamic";

// PayPal Payouts bulk upload format: recipient, amount, currency, sender item id, note (no header row)
export async function GET() {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });
  const s = await getSettings();
  const owed = await prisma.referral.groupBy({ by: ["affiliateId"], where: payableWhere(), _sum: { amount: true } });
  const affs = await prisma.affiliate.findMany({ where: { id: { in: owed.map((o) => o.affiliateId) } } });
  const byId = Object.fromEntries(affs.map((a) => [a.id, a]));
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = owed
    .filter((o) => byId[o.affiliateId] && Number(o._sum.amount) >= s.minimumPayout)
    .map((o) => {
      const a = byId[o.affiliateId];
      return [a.paymentEmail || a.email, Number(o._sum.amount).toFixed(2), s.currency, a.code, `${s.siteName} affiliate commission`].map(esc).join(",");
    });
  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="paypal-payouts-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
