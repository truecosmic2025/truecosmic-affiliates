import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiKey, page, upper } from "@/lib/apiauth";
import { affiliateJson } from "@/lib/notify";
import { registerAffiliate, RegistrationError } from "@/lib/registration";

export const dynamic = "force-dynamic";

export const GET = withApiKey(async (req) => {
  const sp = req.nextUrl.searchParams;
  const where = { ...(sp.get("status") ? { status: upper(sp.get("status")) } : {}), ...(sp.get("email") ? { email: sp.get("email").toLowerCase() } : {}) };
  const rows = await prisma.affiliate.findMany({ where, orderBy: { createdAt: "desc" }, ...page(req) });
  return NextResponse.json({ data: rows.map(affiliateJson) });
}, "affiliates:read");

export const POST = withApiKey(async (req) => {
  const b = await req.json();
  try {
    const a = await registerAffiliate(
      { email: b.email, firstName: b.first_name, lastName: b.last_name, paymentEmail: b.payment_email, code: b.code, rateType: upper(b.rate_type), rate: b.rate ?? null, groupId: b.group_id, parentRef: b.parent_code },
      { byAdmin: true, status: upper(b.status) || "ACTIVE" }
    );
    return NextResponse.json({ data: affiliateJson(a) }, { status: 201 });
  } catch (e) {
    if (e instanceof RegistrationError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}, "affiliates:write");
