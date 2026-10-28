import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page, since } from "@/lib/apiauth";

export const dynamic = "force-dynamic";

export const GET = withApiKey(async (req) => {
  const sp = req.nextUrl.searchParams;
  const rows = await prisma.visit.findMany({ where: { ...since(req), ...(sp.get("affiliate_id") ? { affiliateId: sp.get("affiliate_id") } : {}) }, orderBy: { createdAt: "desc" }, ...page(req) });
  return NextResponse.json({ data: rows.map((v) => ({ id: v.id, affiliate_id: v.affiliateId, url: v.url, referrer: v.referrer, campaign: v.campaign, source: v.source, converted: v.converted, flagged: v.flagged, created_at: v.createdAt })) });
}, "visits:read");
