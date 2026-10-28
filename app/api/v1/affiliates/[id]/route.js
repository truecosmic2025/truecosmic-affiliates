import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, upper } from "@/lib/apiauth";
import { affiliateJson } from "@/lib/notify";
import { setAffiliateStatus } from "@/lib/affiliates";
import { summary } from "@/lib/stats";

export const dynamic = "force-dynamic";

const find = (id) => prisma.affiliate.findFirst({ where: { OR: [{ id }, { code: id }, ...(/^\d+$/.test(id) ? [{ legacyId: Number(id) }] : [])] } });

export const GET = withApiKey(async (req, { params }) => {
  const a = await find(params.id);
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ data: { ...affiliateJson(a), stats: await summary({ affiliateId: a.id }) } });
});

export const PATCH = withApiKey(async (req, { params }) => {
  const a = await find(params.id);
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  const b = await req.json();
  const data = {};
  if ("payment_email" in b) data.paymentEmail = b.payment_email;
  if ("first_name" in b) data.firstName = b.first_name;
  if ("last_name" in b) data.lastName = b.last_name;
  if ("group_id" in b) data.groupId = b.group_id;
  if ("rate" in b || "rate_type" in b) Object.assign(data, { rate: b.rate ?? null, rateType: b.rate == null ? null : upper(b.rate_type) || "PERCENTAGE" });
  if ("coupons" in b) data.coupons = b.coupons;
  let updated = Object.keys(data).length ? await prisma.affiliate.update({ where: { id: a.id }, data }) : a;
  if (b.status && upper(b.status) !== a.status) updated = await setAffiliateStatus(a.id, upper(b.status), { reason: b.reason });
  return NextResponse.json({ data: affiliateJson(updated) });
});
