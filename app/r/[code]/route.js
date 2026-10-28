import { NextResponse } from "next/server";
import { findAffiliateByRef } from "@/lib/affiliates";
import { recordVisit } from "@/lib/visits";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Short share links: /r/jane or /r/jane?to=/academy/some-course/&c=instagram
export async function GET(req, { params }) {
  const s = await getSettings();
  const affiliate = await findAffiliateByRef(params.code);
  const academy = new URL(s.academyUrl);
  const to = req.nextUrl.searchParams.get("to");
  // Only ever redirect to the academy's own domain
  const target = to ? new URL(to, academy) : academy;
  if (target.host !== academy.host) target.href = academy.href;
  if (affiliate && affiliate.status === "ACTIVE") {
    const visit = await recordVisit(affiliate, {
      url: target.href,
      referrer: req.headers.get("referer"),
      campaign: req.nextUrl.searchParams.get("c"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      source: "short",
    });
    target.searchParams.set(s.referralVar, affiliate.code);
    target.searchParams.set("tc_visit", visit.id); // lets the plugin set the cookie without logging a second visit
  }
  return NextResponse.redirect(target, 302);
}
