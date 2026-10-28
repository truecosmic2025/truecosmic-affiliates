import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySignature } from "@/lib/wp";
import { findAffiliateByRef } from "@/lib/affiliates";
import { recordVisit, domainOf, pathOf } from "@/lib/visits";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Called server-side by the WordPress connector when a visit might be creditable:
//   mode "ref"     - ?ref= link (or pretty /ref/x/ link)
//   mode "landing" - visitor landed on a page assigned to an affiliate
//   mode "direct"  - visitor came from a website an affiliate registered (no ref needed)
export async function POST(req) {
  const body = await req.text();
  if (!verifySignature(body, req.headers.get("x-tc-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const { ref, url, referrer, campaign, ip, mode = "ref", current_ref, ppc } = JSON.parse(body);
  const s = await getSettings();

  let affiliate = null;
  if (mode === "landing" && s.landingPages) {
    const lp = await prisma.landingPage.findUnique({ where: { path: pathOf(url) || "" }, include: { affiliate: true } });
    affiliate = lp?.affiliate;
  } else if (mode === "direct" && s.directLinkTracking) {
    const d = domainOf(referrer);
    const dl = d && (await prisma.directLink.findUnique({ where: { domain: d }, include: { affiliate: true } }));
    affiliate = dl?.status === "approved" ? dl.affiliate : null;
  } else {
    affiliate = await findAffiliateByRef(ref);
  }
  if (!affiliate || affiliate.status !== "ACTIVE") return NextResponse.json({ ok: false, reason: "unknown or inactive affiliate" });

  // First-referrer mode: an existing cookie for another affiliate keeps the credit
  const keep = current_ref && !s.creditLastReferrer && (await findAffiliateByRef(current_ref));
  const flagged = s.flagPpcTraffic && ppc ? "ppc" : null;
  const visit = await recordVisit(affiliate, { url, referrer, campaign, ip, source: mode === "ref" ? "link" : mode, flagged });
  if (keep && keep.id !== affiliate.id) return NextResponse.json({ ok: true, keep: true, visit_id: visit.id });
  return NextResponse.json({ ok: true, visit_id: visit.id, code: affiliate.code, cookie_days: s.cookieDays });
}
