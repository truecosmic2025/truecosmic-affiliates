import { prisma, logEvent } from "./db";
import { slugify } from "./format";
import { syncAffiliateToCrm } from "./crm";
import { sendMail } from "./wp";
import { getSettings } from "./settings";

// Resolves a ?ref= value: affiliate code, or the old numeric AffiliateWP id so existing links keep working.
export async function findAffiliateByRef(ref) {
  if (!ref) return null;
  const value = String(ref).trim();
  let a = await prisma.affiliate.findFirst({ where: { code: { equals: value, mode: "insensitive" } } });
  if (!a && /^\d+$/.test(value)) a = await prisma.affiliate.findUnique({ where: { legacyId: Number(value) } });
  return a;
}

export async function findAffiliateByCoupon(codes = []) {
  const wanted = codes.map((c) => String(c).toLowerCase());
  if (!wanted.length) return null;
  const all = await prisma.affiliate.findMany({ where: { coupons: { isEmpty: false } } });
  return all.find((a) => a.coupons.some((c) => wanted.includes(c.toLowerCase()))) || null;
}

export async function uniqueCode(base) {
  let root = slugify(base) || "partner";
  let code = root;
  let i = 1;
  while (await prisma.affiliate.findUnique({ where: { code } })) code = `${root}-${++i}`;
  return code;
}

export async function setAffiliateStatus(id, status) {
  const before = await prisma.affiliate.findUnique({ where: { id } });
  const a = await prisma.affiliate.update({ where: { id }, data: { status } });
  await logEvent("affiliate:status", "ok", `${a.email} ${before.status} -> ${status}`);
  if (before.status !== "ACTIVE" && status === "ACTIVE") {
    const s = await getSettings();
    await sendMail(
      a.email,
      `You're approved as a ${s.siteName} affiliate`,
      `<p>Hi ${a.firstName || "there"},</p><p>Your affiliate account is active. Log in to grab your links and track your earnings:</p><p><a href="${process.env.APP_URL}/login">${process.env.APP_URL}/login</a></p>`
    );
  }
  await syncAffiliateToCrm(a.id);
  return a;
}
