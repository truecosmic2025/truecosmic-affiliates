import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma, logEvent } from "@/lib/db";
import { describe } from "@/lib/payoutMethods";
import { sendTemplate } from "@/lib/notify";
import { syncAffiliateToCrm } from "@/lib/crm";

export const dynamic = "force-dynamic";

// Link from the "confirm your new payout details" email. Works without being logged in: the token is the proof.
export async function GET(req) {
  const base = process.env.APP_URL || req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("token") || "";
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const a = await prisma.affiliate.findFirst({ where: { pendingPayoutTokenHash: tokenHash } });
  if (!a || !a.pendingPayout || !a.pendingPayoutExpires || a.pendingPayoutExpires < new Date()) {
    return NextResponse.redirect(new URL("/dashboard/account?payoutError=That%20confirmation%20link%20has%20expired.%20Please%20submit%20the%20change%20again.", base));
  }
  const { method, details } = a.pendingPayout;
  const updated = await prisma.affiliate.update({
    where: { id: a.id },
    data: {
      payoutMethod: method,
      payoutDetails: details,
      ...(method === "paypal" ? { paymentEmail: details.email } : {}),
      pendingPayout: null, pendingPayoutTokenHash: null, pendingPayoutExpires: null,
    },
  });
  await logEvent("payout-details:changed", "ok", `${a.code}: ${describe({ method, details })}`);
  await sendTemplate("payoutDetailsChanged", a.email, updated, { new_details: describe({ method, details }) });
  await syncAffiliateToCrm(a.id);
  return NextResponse.redirect(new URL("/dashboard/account?payoutConfirmed=1", base));
}
