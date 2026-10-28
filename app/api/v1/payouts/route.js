import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page, since, upper } from "@/lib/apiauth";
import { payoutJson } from "@/lib/apijson";

export const dynamic = "force-dynamic";

// Read-only. ?affiliate_id= &status=processing|paid|failed &kind=run|manual &run_id= &since=
export const GET = withApiKey(async (req) => {
  const sp = req.nextUrl.searchParams;
  const where = {
    ...since(req),
    ...(sp.get("affiliate_id") ? { affiliateId: sp.get("affiliate_id") } : {}),
    ...(sp.get("status") ? { status: upper(sp.get("status")) } : {}),
    ...(sp.get("kind") ? { kind: sp.get("kind") } : {}),
    ...(sp.get("run_id") ? { runId: sp.get("run_id") } : {}),
  };
  const rows = await prisma.payout.findMany({ where, orderBy: { createdAt: "desc" }, ...page(req) });
  return NextResponse.json({ data: rows.map(payoutJson) });
}, "payouts:read");
