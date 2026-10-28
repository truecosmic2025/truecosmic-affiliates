import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey } from "@/lib/apiauth";
import { payoutJson, referralBrief } from "@/lib/apijson";

export const dynamic = "force-dynamic";

// Read-only: one payout and the commissions it covers
export const GET = withApiKey(async (req, { params }) => {
  const p = await prisma.payout.findUnique({ where: { id: params.id }, include: { referrals: { orderBy: { createdAt: "asc" } } } });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ data: { ...payoutJson(p), referrals: p.referrals.map(referralBrief) } });
}, "payouts:read");
