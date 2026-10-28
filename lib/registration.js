import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { uniqueCode, findAffiliateByRef, onActivated } from "./affiliates";
import { syncAffiliateToCrm } from "./crm";
import { sendTemplate, notifyAdmin, fireWebhooks, affiliateJson } from "./notify";
import { hashIp } from "./visits";

export class RegistrationError extends Error {}

// Shared by the public /join form, the admin "add affiliate" form and auto-registration.
export async function registerAffiliate(input, { ip, byAdmin = false, status: forcedStatus } = {}) {
  const s = await getSettings();
  const email = String(input.email || "").toLowerCase().trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RegistrationError("email");
  if (await prisma.affiliate.findUnique({ where: { email } })) throw new RegistrationError("exists");
  const ipHash = hashIp(ip);
  if (!byAdmin && ipHash && s.maxSignupsPerIpPerDay > 0) {
    const recent = await prisma.affiliate.count({ where: { signupIpHash: ipHash, createdAt: { gt: new Date(Date.now() - 864e5) } } });
    if (recent >= s.maxSignupsPerIpPerDay) {
      await logEvent("affiliate:applied", "skipped", `IP velocity limit hit for ${email}`);
      throw new RegistrationError("velocity");
    }
  }
  const parent = input.parentRef ? await findAffiliateByRef(input.parentRef) : null;
  const defaultGroup = await prisma.affiliateGroup.findFirst({ where: { isDefault: true } });
  const status = forcedStatus || (s.autoApproveAffiliates ? "ACTIVE" : "PENDING");
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: [input.firstName, input.lastName].filter(Boolean).join(" ") || null },
    update: {},
  });
  const a = await prisma.affiliate.create({
    data: {
      email,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      userId: user.id,
      code: await uniqueCode(input.code || input.firstName || email.split("@")[0]),
      paymentEmail: input.paymentEmail || email,
      website: input.website || null,
      promotionPlan: input.promotionPlan || null,
      registration: input.extra || undefined,
      status,
      parentId: parent && parent.status === "ACTIVE" ? parent.id : null,
      groupId: input.groupId || defaultGroup?.id || null,
      signupIpHash: ipHash,
      rateType: input.rateType || null,
      rate: input.rate ?? null,
      notes: input.notes || null,
    },
  });
  await logEvent("affiliate:applied", "ok", `${email}${parent ? ` (recruited by ${parent.code})` : ""}`);
  await fireWebhooks("affiliate.created", affiliateJson(a));
  if (status === "ACTIVE") await onActivated(a);
  else if (!byAdmin) {
    await sendTemplate("applicationReceived", a.email, a);
    await notifyAdmin("adminNewApplication", a);
  }
  await syncAffiliateToCrm(a.id, byAdmin ? [] : ["Affiliate - Applied"]);
  return a;
}

// "Auto-register new customers as affiliates"
export async function autoRegisterCustomer(order) {
  const s = await getSettings();
  const email = order.customer?.email?.toLowerCase();
  if (!s.autoRegisterCustomers || !email || (await prisma.affiliate.findUnique({ where: { email } }))) return;
  const [firstName, ...rest] = String(order.customer?.name || "").split(" ");
  try {
    await registerAffiliate({ email, firstName: firstName || null, lastName: rest.join(" ") || null, parentRef: order.ref }, { byAdmin: true, status: s.autoApproveAffiliates ? "ACTIVE" : "PENDING" });
  } catch (e) {
    await logEvent("affiliate:auto-register", "error", `${email}: ${e.message}`);
  }
}
