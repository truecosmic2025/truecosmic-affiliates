import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page, since } from "@/lib/apiauth";

export const dynamic = "force-dynamic";

export const GET = withApiKey(async (req) => {
  const sp = req.nextUrl.searchParams;
  const rows = await prisma.payout.findMany({ where: { ...since(req), ...(sp.get("affiliate_id") ? { affiliateId: sp.get("affiliate_id") } : {}) }, orderBy: { createdAt: "desc" }, ...page(req) });
  return NextResponse.json({ data: rows.map((p) => ({ id: p.id, affiliate_id: p.affiliateId, amount: Number(p.amount), currency: p.currency, method: p.method, status: p.status.toLowerCase(), reference: p.reference, created_at: p.createdAt })) });
});
