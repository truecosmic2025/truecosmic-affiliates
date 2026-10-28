import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey } from "@/lib/apiauth";
import { disputeJson } from "@/lib/apijson";
import { DISPUTE_STATUS, staffReply, accountsContact } from "@/lib/disputes";

export const dynamic = "force-dynamic";

const load = (id) => prisma.dispute.findUnique({ where: { id }, include: { affiliate: true, referral: true, payout: true, messages: { orderBy: { createdAt: "asc" } } } });

export const GET = withApiKey(async (req, { params }) => {
  const d = await load(params.id);
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ data: disputeJson(d, { full: true }) });
}, "disputes:read");

// { "status": "open" | "in_review" | "resolved" | "declined" }. The affiliate is emailed about the change.
export const PATCH = withApiKey(async (req, { params }) => {
  const b = await req.json().catch(() => ({}));
  if (!DISPUTE_STATUS[b.status]) return NextResponse.json({ error: `status must be one of ${Object.keys(DISPUTE_STATUS).join(", ")}` }, { status: 422 });
  if (!(await prisma.dispute.findUnique({ where: { id: params.id } }))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await staffReply(params.id, { status: b.status, staffName: (await accountsContact()).name });
  return NextResponse.json({ data: disputeJson(await load(params.id), { full: true }) });
}, "disputes:write");
