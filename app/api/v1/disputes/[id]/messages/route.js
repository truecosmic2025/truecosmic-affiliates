import { NextResponse } from "next/server";
import { prisma, logEvent } from "@/lib/db";
import { withApiKey } from "@/lib/apiauth";
import { disputeJson } from "@/lib/apijson";
import { DISPUTE_STATUS, staffReply, accountsContact } from "@/lib/disputes";

export const dynamic = "force-dynamic";

// Post a reply as the accounts team: { "body": "...", "status": "resolved" (optional), "author_name": "Franklin" (optional) }
// The reply is emailed to the affiliate and appears in their Disputes tab.
export const POST = withApiKey(async (req, { params }, key) => {
  const b = await req.json().catch(() => ({}));
  const body = String(b.body || "").trim();
  if (!body) return NextResponse.json({ error: "body is required" }, { status: 422 });
  if (body.length > 5000) return NextResponse.json({ error: "body must be 5000 characters or fewer" }, { status: 422 });
  if (b.status && !DISPUTE_STATUS[b.status]) return NextResponse.json({ error: `status must be one of ${Object.keys(DISPUTE_STATUS).join(", ")}` }, { status: 422 });
  if (!(await prisma.dispute.findUnique({ where: { id: params.id } }))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const staffName = String(b.author_name || (await accountsContact()).name).slice(0, 80);
  await staffReply(params.id, { body, status: b.status, staffName });
  await logEvent("api:dispute-reply", "ok", `${params.id} by key "${key.name}"`);
  const d = await prisma.dispute.findUnique({ where: { id: params.id }, include: { affiliate: true, referral: true, payout: true, messages: { orderBy: { createdAt: "asc" } } } });
  return NextResponse.json({ data: disputeJson(d, { full: true }) }, { status: 201 });
}, "disputes:write");
