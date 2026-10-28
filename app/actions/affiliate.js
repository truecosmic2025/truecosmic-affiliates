"use server";
import { redirect } from "next/navigation";
import { prisma, logEvent } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { syncAffiliateToCrm } from "@/lib/crm";
import { domainOf } from "@/lib/visits";
import { openDispute, affiliateReply } from "@/lib/disputes";

export async function updateMyAccount(f) {
  const user = await requireAffiliate();
  const clean = (k) => String(f.get(k) || "").trim() || null;
  await prisma.affiliate.update({
    where: { id: user.affiliate.id },
    data: {
      firstName: clean("firstName"), lastName: clean("lastName"), paymentEmail: clean("paymentEmail"), website: clean("website"),
      emailOnReferral: f.get("emailOnReferral") === "on",
    },
  });
  await syncAffiliateToCrm(user.affiliate.id);
  redirect("/dashboard/account?saved=1");
}

export async function requestDirectLink(f) {
  const { affiliate } = await requireAffiliate();
  const raw = String(f.get("domain") || "").trim();
  const domain = domainOf(/^https?:/.test(raw) ? raw : `https://${raw}`);
  if (!domain || /truecosmic\.com$/.test(domain)) redirect("/dashboard/direct-links?error=invalid");
  if (await prisma.directLink.findUnique({ where: { domain } })) redirect("/dashboard/direct-links?error=taken");
  if ((await prisma.directLink.count({ where: { affiliateId: affiliate.id } })) >= 5) redirect("/dashboard/direct-links?error=limit");
  await prisma.directLink.create({ data: { domain, affiliateId: affiliate.id } });
  await logEvent("direct-link:requested", "ok", `${affiliate.code}: ${domain}`);
  redirect("/dashboard/direct-links?sent=1");
}

export async function raiseDispute(f) {
  const { affiliate } = await requireAffiliate();
  const v = (k) => String(f.get(k) || "").trim();
  if (!v("subject") || !v("message")) redirect(`/dashboard/disputes/new?error=missing&referral=${v("referralId")}&payout=${v("payoutId")}`);
  // Light abuse limit: 10 new disputes per affiliate per day
  const recent = await prisma.dispute.count({ where: { affiliateId: affiliate.id, createdAt: { gt: new Date(Date.now() - 864e5) } } });
  if (recent >= 10) redirect("/dashboard/disputes?error=limit");
  const d = await openDispute(affiliate, {
    category: v("category"), subject: v("subject"), message: v("message"),
    referralId: v("referralId") || null, payoutId: v("payoutId") || null, orderRef: v("orderRef") || null,
  });
  redirect(`/dashboard/disputes/${d.id}?sent=1`);
}

export async function replyToDispute(id, f) {
  const { affiliate } = await requireAffiliate();
  const body = String(f.get("body") || "").trim();
  if (body) await affiliateReply(affiliate, id, body);
  redirect(`/dashboard/disputes/${id}`);
}
