import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/wp";
import { findAffiliateByRef } from "@/lib/affiliates";
import { recordVisit } from "@/lib/visits";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Called server-side by the WordPress connector when someone lands on the site with ?ref=
export async function POST(req) {
  const body = await req.text();
  if (!verifySignature(body, req.headers.get("x-tc-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const { ref, url, referrer, campaign, ip } = JSON.parse(body);
  const affiliate = await findAffiliateByRef(ref);
  if (!affiliate || affiliate.status !== "ACTIVE") return NextResponse.json({ ok: false, reason: "unknown or inactive affiliate" });
  const visit = await recordVisit(affiliate, { url, referrer, campaign, ip });
  const s = await getSettings();
  return NextResponse.json({ ok: true, visit_id: visit.id, code: affiliate.code, cookie_days: s.cookieDays });
}
