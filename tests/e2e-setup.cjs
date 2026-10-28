// Test fixture for the parity e2e run: turns on the AffiliateWP-style features and creates rules.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const set = (key, value) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await set("lifetimeCommissions", true);
  await set("multiTier", true);
  await set("tierRates", [5, 2]);
  await set("flagPpcTraffic", true);
  await set("signupReferralAmount", 3);
  await set("creditLastReferrer", false);
  await set("autoCreateCoupons", true);
  await set("requireTerms", true);
  await set("storeCreditPayouts", true);
  await prisma.categoryRate.create({ data: { category: "Coaching", rateType: "FLAT", rate: 50 } });
  await prisma.bonus.create({ data: { name: "Welcome", metric: "signup", amount: 10 } });
  await prisma.bonus.create({ data: { name: "First sale", metric: "referrals", threshold: 1, amount: 5 } });
  const mark = await prisma.affiliate.findUnique({ where: { code: "markm" } });
  await prisma.landingPage.create({ data: { path: "/academy/mark/", affiliateId: mark.id } });
  await prisma.directLink.create({ data: { domain: "markblog.com", affiliateId: mark.id, status: "approved" } });
  await prisma.webhook.create({ data: { url: "http://localhost:4000/hook", events: ["*"], secret: "hooksecret" } });
  await prisma.$disconnect();
})();
