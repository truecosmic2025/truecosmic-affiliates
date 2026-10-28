import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page } from "@/lib/apiauth";

export const dynamic = "force-dynamic";

export const GET = withApiKey(async (req) => {
  const rows = await prisma.product.findMany({ where: { deleted: false }, orderBy: { createdAt: "desc" }, ...page(req) });
  return NextResponse.json({ data: rows.map((p) => ({ id: p.id, wc_id: p.wcId, name: p.name, kind: p.kind, price: Number(p.price), permalink: p.permalink, status: p.status, categories: p.categories, commission_enabled: p.commissionEnabled, rate_type: p.rateType?.toLowerCase() ?? null, rate: p.rate != null ? Number(p.rate) : null })) });
});
