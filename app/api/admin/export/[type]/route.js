import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { parseRange, dateWhere } from "@/lib/range";

export const dynamic = "force-dynamic";

const esc = (v) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const EXPORTS = {
  affiliates: async (dw) => {
    const rows = await prisma.affiliate.findMany({ where: dw, include: { group: true, parent: true } });
    return [["id", "legacy_id", "code", "email", "first_name", "last_name", "payment_email", "status", "rate_type", "rate", "group", "recruited_by", "coupons", "website", "created_at"],
      ...rows.map((a) => [a.id, a.legacyId, a.code, a.email, a.firstName, a.lastName, a.paymentEmail, a.status, a.rateType, a.rate, a.group?.name, a.parent?.code, a.coupons.join("|"), a.website, a.createdAt])];
  },
  referrals: async (dw) => {
    const rows = await prisma.referral.findMany({ where: dw, include: { affiliate: true }, orderBy: { createdAt: "desc" } });
    return [["id", "affiliate_code", "affiliate_email", "order_id", "type", "source", "status", "amount", "order_total", "currency", "description", "customer_email", "campaign", "flagged", "created_at"],
      ...rows.map((r) => [r.id, r.affiliate.code, r.affiliate.email, r.orderId, r.type, r.source, r.status, r.amount, r.orderTotal, r.currency, r.description, r.customerEmail, r.campaign, r.flagged, r.createdAt])];
  },
  visits: async (dw) => {
    const rows = await prisma.visit.findMany({ where: dw, include: { affiliate: true }, orderBy: { createdAt: "desc" } });
    return [["id", "affiliate_code", "url", "referrer", "campaign", "source", "converted", "flagged", "created_at"],
      ...rows.map((v) => [v.id, v.affiliate.code, v.url, v.referrer, v.campaign, v.source, v.converted, v.flagged, v.createdAt])];
  },
  payouts: async (dw) => {
    const rows = await prisma.payout.findMany({ where: dw, include: { affiliate: true }, orderBy: { createdAt: "desc" } });
    return [["id", "affiliate_code", "pay_to", "amount", "currency", "method", "status", "reference", "notes", "created_at"],
      ...rows.map((p) => [p.id, p.affiliate.code, p.affiliate.paymentEmail || p.affiliate.email, p.amount, p.currency, p.method, p.status, p.reference, p.notes, p.createdAt])];
  },
  customers: async (dw) => {
    const rows = await prisma.customer.findMany({ where: dw, include: { affiliate: true, _count: { select: { referrals: true } } } });
    return [["email", "name", "linked_affiliate", "referred_orders", "first_seen"], ...rows.map((c) => [c.email, c.name, c.affiliate?.code, c._count.referrals, c.createdAt])];
  },
};

export async function GET(req, { params }) {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });
  const fn = EXPORTS[params.type];
  if (!fn) return new Response("Unknown export", { status: 404 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const rows = await fn(sp.range || sp.from || sp.to ? dateWhere(parseRange(sp, "all")) : {});
  return new Response(rows.map((r) => r.map(esc).join(",")).join("\n") + "\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${params.type}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
