import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page, since } from "@/lib/apiauth";
import { disputeJson } from "@/lib/apijson";

export const dynamic = "force-dynamic";

// ?status=open|in_review|resolved|declined|active (open + in_review) &affiliate_id= &since= &limit= &offset=
export const GET = withApiKey(async (req) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const where = {
    ...since(req),
    ...(status === "active" ? { status: { in: ["open", "in_review"] } } : status ? { status } : {}),
    ...(sp.get("affiliate_id") ? { affiliateId: sp.get("affiliate_id") } : {}),
  };
  const rows = await prisma.dispute.findMany({ where, include: { affiliate: true }, orderBy: { updatedAt: "desc" }, ...page(req) });
  return NextResponse.json({ data: rows.map((d) => disputeJson(d)) });
}, "disputes:read");
