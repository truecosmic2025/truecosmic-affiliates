import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page, since, upper } from "@/lib/apiauth";
import { referralJson, fireWebhooks } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = withApiKey(async (req) => {
  const sp = req.nextUrl.searchParams;
  const where = { ...since(req), ...(sp.get("affiliate_id") ? { affiliateId: sp.get("affiliate_id") } : {}), ...(sp.get("status") ? { status: upper(sp.get("status")) } : {}), ...(sp.get("order_id") ? { orderId: sp.get("order_id") } : {}) };
  const rows = await prisma.referral.findMany({ where, orderBy: { createdAt: "desc" }, ...page(req) });
  return NextResponse.json({ data: rows.map(referralJson) });
});

export const POST = withApiKey(async (req) => {
  const b = await req.json();
  const a = await prisma.affiliate.findFirst({ where: { OR: [{ id: String(b.affiliate_id) }, { code: String(b.affiliate_id) }] } });
  if (!a) return NextResponse.json({ error: "affiliate not found" }, { status: 422 });
  const s = await getSettings();
  const r = await prisma.referral.create({
    data: {
      affiliateId: a.id, amount: Number(b.amount || 0), orderTotal: Number(b.order_total || 0), currency: b.currency || s.currency,
      description: b.description || null, orderId: b.order_id ? String(b.order_id) : null, status: upper(b.status) || "UNPAID",
      source: "api", type: b.type || "sale", customerEmail: b.customer_email?.toLowerCase() || null,
    },
  });
  await fireWebhooks("referral.created", referralJson(r));
  return NextResponse.json({ data: referralJson(r) }, { status: 201 });
});
