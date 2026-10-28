import crypto from "node:crypto";
import { prisma } from "./db";

export async function recordVisit(affiliate, { url, referrer, campaign, ip }) {
  const ipHash = ip ? crypto.createHash("sha256").update(ip + (process.env.SESSION_SECRET || "")).digest("hex").slice(0, 32) : null;
  // De-dupe refreshes: same visitor + affiliate within 30 minutes counts once
  if (ipHash) {
    const recent = await prisma.visit.findFirst({
      where: { affiliateId: affiliate.id, ipHash, createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return recent;
  }
  return prisma.visit.create({
    data: { affiliateId: affiliate.id, url: url?.slice(0, 500), referrer: referrer?.slice(0, 500), campaign: campaign?.slice(0, 100), ipHash },
  });
}
