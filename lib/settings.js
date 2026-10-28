import { prisma } from "./db";

export const DEFAULT_SETTINGS = {
  siteName: "TrueCosmic Academy",
  academyUrl: "https://www.truecosmic.com/academy/",
  currency: "GBP",
  referralVar: "ref",
  cookieDays: 30,
  defaultRateType: "PERCENTAGE",
  defaultRate: 35, // truecosmic.com/academy/affiliate: 35% per sale
  autoApproveAffiliates: false,
  referralsStartPending: false, // true = new commissions need manual approval before they're payable
  newProductsEarnCommission: true,
  minimumPayout: 50, // published threshold
  allowSelfReferral: false,
  crmEnabled: true,
  crmAffiliateTag: "Affiliate",
  crmReferredCustomerTag: "Referred Customer",
  crmListName: "Affiliates",

  // Payout schedule (published rules: paid by PayPal within 30 days after a sale clears; one payout run a month)
  holdDays: 30, // refund window: commissions become payable this many days after the sale
  payoutDay: 1, // day of the month payouts are run
  newCustomersOnly: true, // commission only on a referred customer's first purchase (lifetime/renewals excepted)
  // Disputes
  accountsName: "Franklin",
  accountsEmail: "", // falls back to ADMIN_EMAIL when empty

  // Tracking
  creditLastReferrer: true, // false = first affiliate keeps the customer until the cookie expires
  directLinkTracking: true,
  landingPages: true,
  flagPpcTraffic: true, // visits arriving from paid ads (gclid/fbclid/msclkid) are flagged; their referrals start pending
  // Commission basis
  flatRateBasis: "product", // product = flat amount per item, order = flat amount per order
  includeShipping: false,
  includeTax: false,
  ignoreZeroReferrals: true,
  // Lifetime / recurring / network
  lifetimeCommissions: false,
  lifetimeRateType: "",
  lifetimeRate: null,
  recurringReferrals: true,
  recurringRateType: "",
  recurringRate: null,
  multiTier: false,
  tierRates: [5, 2], // % of the order paid to the recruiter's upline, level 1 first
  signupReferralAmount: 0, // pay this when a referred visitor creates an account on the site
  // Registration
  requireTerms: false,
  termsUrl: "",
  registrationFields: ["website", "promotionPlan"],
  maxSignupsPerIpPerDay: 3,
  autoRegisterCustomers: false,
  // Coupons and payouts
  autoCreateCoupons: false,
  couponDiscountType: "percent",
  couponAmount: 10,
  storeCreditPayouts: false,
  // Affiliate area
  showLeaderboard: true,
  leaderboardSize: 10,
  showCustomerDetails: false, // affiliates see customer names on their referrals
  // Emails (empty subject = disabled). Tags: {name} {email} {site} {login_url} {amount} {products} {reason} {link}
  emails: {
    adminNewApplication: { subject: "New affiliate application: {name}", body: "<p>{name} ({email}) applied to join.</p><p><a href=\"{admin_url}\">Review application</a></p>" },
    applicationReceived: { subject: "We received your {site} affiliate application", body: "<p>Hi {first_name},</p><p>Thanks for applying. We review every application and will email you as soon as you're approved.</p>" },
    approved: { subject: "You're approved as a {site} affiliate", body: "<p>Hi {first_name},</p><p>Your affiliate account is active. Your link: <a href=\"{link}\">{link}</a></p><p>Log in any time to get links for every course, ebook and coaching offer: <a href=\"{login_url}\">{login_url}</a></p>" },
    rejected: { subject: "Your {site} affiliate application", body: "<p>Hi {first_name},</p><p>Unfortunately we can't accept your application at this time.</p><p>{reason}</p>" },
    newReferral: { subject: "New referral: you earned {amount}", body: "<p>Hi {first_name},</p><p>Someone bought <strong>{products}</strong> through your link. You earned <strong>{amount}</strong>.</p><p><a href=\"{dashboard_url}\">View your dashboard</a></p>" },
    payoutSent: { subject: "Your {site} affiliate payout of {amount}", body: "<p>Hi {first_name},</p><p>We've just paid you <strong>{amount}</strong> via {method}. Thank you for sharing our work!</p>" },
    adminNewReferral: { subject: "", body: "<p>{name} earned {amount} on {products}.</p>" },
    disputeToAccounts: { subject: "Affiliate dispute from {name}: {dispute_subject}", body: "<p>Hi {accounts_name},</p><p>{name} ({email}, code {code}) has raised a dispute.</p><p><strong>Type:</strong> {dispute_type}<br><strong>About:</strong> {dispute_about}</p><blockquote>{dispute_message}</blockquote><p><a href=\"{dispute_url}\">Open the dispute</a></p>" },
    disputeReceived: { subject: "We've received your query: {dispute_subject}", body: "<p>Hi {first_name},</p><p>Thanks for letting us know. {accounts_name} in our accounts team will look into it and reply in your affiliate area under Disputes.</p><blockquote>{dispute_message}</blockquote>" },
    disputeReply: { subject: "Update on your query: {dispute_subject}", body: "<p>Hi {first_name},</p><p>{accounts_name} replied to your query (status: {dispute_status}):</p><blockquote>{dispute_message}</blockquote><p><a href=\"{dispute_url}\">View the conversation</a></p>" },
    disputeAffiliateReply: { subject: "New reply on dispute from {name}: {dispute_subject}", body: "<p>{name} replied:</p><blockquote>{dispute_message}</blockquote><p><a href=\"{dispute_url}\">Open the dispute</a></p>" },
  },
};

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  // Merge per-template so newly added templates get their defaults
  s.emails = { ...DEFAULT_SETTINGS.emails };
  const saved = rows.find((r) => r.key === "emails")?.value || {};
  for (const [k, v] of Object.entries(saved)) s.emails[k] = { ...DEFAULT_SETTINGS.emails[k], ...v };
  return s;
}

export async function saveSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}
