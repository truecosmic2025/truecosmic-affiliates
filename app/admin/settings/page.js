import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { paypalConfigured } from "@/lib/paypal";
import { PageHeader } from "@/components/ui";
import { updateSettings, syncAllAffiliatesToCrm } from "@/app/actions/admin";

function Toggle({ name, checked, label, hint }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1" />
      <span><span className="font-medium text-slate-700">{label}</span>{hint && <span className="block text-xs text-slate-400">{hint}</span>}</span>
    </label>
  );
}

function Section({ id, title, children, cols = true }) {
  return (
    <section id={id} className={`card scroll-mt-6 p-6 ${cols ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}`}>
      <div className="font-medium sm:col-span-2">{title}</div>
      {children}
    </section>
  );
}

const RateTypeSelect = ({ name, value }) => (
  <select name={name} defaultValue={value || ""} className="input w-36"><option value="">Same as normal</option><option value="PERCENTAGE">%</option><option value="FLAT">Flat</option></select>
);

const REG_FIELDS = [["website", "Website"], ["instagram", "Instagram"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["audience", "Audience size"], ["phone", "Phone"], ["promotionPlan", "How will you promote us?"]];

export default async function Settings({ searchParams }) {
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings">
        <div className="flex flex-wrap gap-1 text-xs">{[["general", "General"], ["payouts", "Payout rules"], ["tracking", "Tracking"], ["commissions", "Commissions"], ["advanced", "Lifetime & network"], ["registration", "Registration"], ["coupons", "Coupons & payouts"], ["area", "Affiliate area"], ["crm", "FluentCRM"]].map(([id, l]) => <a key={id} href={`#${id}`} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{l}</a>)}</div>
      </PageHeader>
      {searchParams.saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Settings saved.</p>}
      {searchParams.crm && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Pushed {searchParams.crm} affiliates to FluentCRM. Check the activity log for any errors.</p>}
      <form action={updateSettings} className="max-w-3xl space-y-6">
        <Section id="general" title="General">
          <div><label className="label">Programme name</label><input name="siteName" defaultValue={s.siteName} className="input" /></div>
          <div><label className="label">Academy URL (default link target)</label><input name="academyUrl" defaultValue={s.academyUrl} className="input" /></div>
          <div><label className="label">Currency</label><select name="currency" defaultValue={s.currency} className="input"><option>GBP</option><option>USD</option><option>EUR</option><option>AUD</option><option>CAD</option></select></div>
        </Section>

        <Section id="payouts" title="Payout rules and disputes">
          <div><label className="label">Minimum payout</label><input name="minimumPayout" type="number" step="0.01" min="0" defaultValue={s.minimumPayout} className="input" /></div>
          <div><label className="label">Payout run: day of the month</label><input name="payoutDay" type="number" min="1" max="28" defaultValue={s.payoutDay} className="input" /><p className="mt-1 text-xs text-slate-400">Shown to affiliates as their next payout date. 1-28.</p></div>
          <div><label className="label">Clearing period (days)</label><input name="holdDays" type="number" min="0" defaultValue={s.holdDays} className="input" /><p className="mt-1 text-xs text-slate-400">Commissions can't be paid until the refund window has passed. 0 = immediately.</p></div>
          <div />
          <div className="sm:col-span-2"><Toggle name="newCustomersOnly" checked={s.newCustomersOnly} label="Pay commission on new customers only" hint="A referred customer's first purchase earns commission; repeat buyers don't (unless lifetime commissions are on, or it's a subscription renewal)." /></div>
          <div><label className="label">Accounts contact name</label><input name="accountsName" defaultValue={s.accountsName} className="input" /></div>
          <div><label className="label">Accounts email (receives disputes)</label><input name="accountsEmail" type="email" defaultValue={s.accountsEmail} placeholder={process.env.ADMIN_EMAIL} className="input" /><p className="mt-1 text-xs text-slate-400">Blank = sent to the admin email.</p></div>
        </Section>

        <Section id="tracking" title="Tracking">
          <div><label className="label">Referral URL variable</label><input name="referralVar" defaultValue={s.referralVar} className="input" /><p className="mt-1 text-xs text-slate-400">Keep “ref” so old AffiliateWP links still work. Pretty links (/ref/jane/) work too.</p></div>
          <div><label className="label">Cookie expiration (days)</label><input name="cookieDays" type="number" min="1" defaultValue={s.cookieDays} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">When a visitor clicks links from two different affiliates</label>
            <select name="credit" defaultValue={s.creditLastReferrer ? "last" : "first"} className="input"><option value="last">Credit the last affiliate (AffiliateWP default)</option><option value="first">Credit the first affiliate until their cookie expires</option></select></div>
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="directLinkTracking" checked={s.directLinkTracking} label="Direct link tracking" hint="Affiliates register their website; plain links from it are credited with no ?ref= needed. You approve each domain." />
            <Toggle name="landingPages" checked={s.landingPages} label="Affiliate landing pages" hint="Assign a page (e.g. /academy/jane/) to an affiliate; anyone landing there is credited to them." />
            <Toggle name="flagPpcTraffic" checked={s.flagPpcTraffic} label="Flag paid-ad traffic (fraud prevention)" hint="Visits carrying Google/Facebook/Microsoft ad click IDs are flagged and their commissions held for review. Stops affiliates bidding on your brand name." />
          </div>
        </Section>

        <Section id="commissions" title="Commissions">
          <div><label className="label">Default rate type</label><select name="defaultRateType" defaultValue={s.defaultRateType} className="input"><option value="PERCENTAGE">Percentage</option><option value="FLAT">Flat amount</option></select></div>
          <div><label className="label">Default rate</label><input name="defaultRate" type="number" step="0.01" defaultValue={s.defaultRate} className="input" /></div>
          <div><label className="label">Flat rates are paid</label><select name="flatRateBasis" defaultValue={s.flatRateBasis} className="input"><option value="product">Per product sold</option><option value="order">Once per order</option></select></div>
          <div><label className="label">Pay on sign-ups (signup referrals)</label><input name="signupReferralAmount" type="number" step="0.01" min="0" defaultValue={s.signupReferralAmount} className="input" /><p className="mt-1 text-xs text-slate-400">Amount per new site account from a referral link. 0 = off.</p></div>
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="newProductsEarnCommission" checked={s.newProductsEarnCommission} label="New academy products earn commission automatically" />
            <Toggle name="includeShipping" checked={s.includeShipping} label="Include shipping in commission" />
            <Toggle name="includeTax" checked={s.includeTax} label="Include tax in commission" />
            <Toggle name="ignoreZeroReferrals" checked={s.ignoreZeroReferrals} label="Ignore £0 referrals" hint="e.g. free lead-magnet ebooks or 100%-off coupons" />
            <Toggle name="referralsStartPending" checked={s.referralsStartPending} label="Hold new commissions for approval" hint="Useful with a refund window; approve them in Referrals before paying." />
            <Toggle name="allowSelfReferral" checked={s.allowSelfReferral} label="Allow affiliates to earn on their own purchases" />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">Groups, category rates, tiered rates and bonuses are on the <Link href="/admin/rules" className="text-cosmic-600">Commission rules</Link> page; per-product rates on Products; per-affiliate rates on each affiliate.</p>
        </Section>

        <Section id="advanced" title="Lifetime, recurring and multi-tier">
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="lifetimeCommissions" checked={s.lifetimeCommissions} label="Lifetime commissions" hint="A customer's first referring affiliate earns on every future order they place, even without a link." />
          </div>
          <div><label className="label">Lifetime rate (optional)</label><div className="flex gap-2"><RateTypeSelect name="lifetimeRateType" value={s.lifetimeRateType} /><input name="lifetimeRate" type="number" step="0.01" defaultValue={s.lifetimeRate ?? ""} className="input" /></div></div>
          <div />
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="recurringReferrals" checked={s.recurringReferrals} label="Recurring referrals (subscriptions)" hint="Renewals from WooCommerce Subscriptions pay the affiliate who referred the first order." />
          </div>
          <div><label className="label">Recurring rate (optional)</label><div className="flex gap-2"><RateTypeSelect name="recurringRateType" value={s.recurringRateType} /><input name="recurringRate" type="number" step="0.01" defaultValue={s.recurringRate ?? ""} className="input" /></div></div>
          <div />
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="multiTier" checked={s.multiTier} label="Multi-tier commissions (sub-affiliates)" hint="Affiliates recruit others with their /join?ref= link and earn a % of their recruits' sales." />
          </div>
          <div><label className="label">Upline rates, % of order, level 1 first</label><input name="tierRates" defaultValue={(s.tierRates || []).join(", ")} placeholder="5, 2" className="input" /><p className="mt-1 text-xs text-slate-400">Up to 5 levels</p></div>
        </Section>

        <Section id="registration" title="Registration">
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="autoApproveAffiliates" checked={s.autoApproveAffiliates} label="Auto-approve new affiliates" />
            <Toggle name="autoRegisterCustomers" checked={s.autoRegisterCustomers} label="Auto-register customers as affiliates" hint="Every customer who places an order gets an affiliate account (approved or pending, per the setting above)." />
            <Toggle name="requireTerms" checked={s.requireTerms} label="Require agreeing to affiliate terms" />
          </div>
          <div><label className="label">Terms of use URL</label><input name="termsUrl" defaultValue={s.termsUrl} className="input" placeholder="https://www.truecosmic.com/affiliate-terms/" /></div>
          <div><label className="label">Max applications per IP per day</label><input name="maxSignupsPerIpPerDay" type="number" min="0" defaultValue={s.maxSignupsPerIpPerDay} className="input" /><p className="mt-1 text-xs text-slate-400">Fraud protection against bulk sign-ups. 0 = no limit.</p></div>
          <div className="sm:col-span-2"><label className="label">Extra sign-up form fields</label>
            <div className="flex flex-wrap gap-4 text-sm">{REG_FIELDS.map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" name="registrationFields" value={k} defaultChecked={(s.registrationFields || []).includes(k)} /> {l}</label>)}</div></div>
        </Section>

        <Section id="coupons" title="Coupons and payouts">
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="autoCreateCoupons" checked={s.autoCreateCoupons} label="Create a personal WooCommerce coupon for each approved affiliate" hint="Sales using an affiliate's coupon are credited to them, even with no link click." />
          </div>
          <div><label className="label">Coupon discount</label><div className="flex gap-2"><select name="couponDiscountType" defaultValue={s.couponDiscountType} className="input w-40"><option value="percent">% off</option><option value="fixed_cart">Fixed amount off</option></select><input name="couponAmount" type="number" step="0.01" defaultValue={s.couponAmount} className="input" /></div></div>
          <div />
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="storeCreditPayouts" checked={s.storeCreditPayouts} label="Offer store credit as a payout method" hint="Pays affiliates with a single-use WooCommerce coupon for their balance, locked to their email." />
            <p className="text-xs text-slate-500">PayPal API automatic payouts: {paypalConfigured() ? <span className="text-emerald-700">connected</span> : "add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the app's environment variables to enable"}.</p>
          </div>
        </Section>

        <Section id="area" title="Affiliate area">
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="showLeaderboard" checked={s.showLeaderboard} label="Show a leaderboard to affiliates" hint="Top affiliates this month by sales. Shows first name and initial only." />
            <Toggle name="showCustomerDetails" checked={s.showCustomerDetails} label="Show customer names on affiliates' referrals" hint="Off by default for privacy." />
          </div>
          <div><label className="label">Leaderboard size</label><input name="leaderboardSize" type="number" min="3" max="50" defaultValue={s.leaderboardSize} className="input" /></div>
        </Section>

        <Section id="crm" title="FluentCRM sync">
          <div className="sm:col-span-2"><Toggle name="crmEnabled" checked={s.crmEnabled} label="Sync affiliates and referred customers to FluentCRM" hint="Contacts get tags like “Affiliate - Active” and “Affiliate - Has Sales”. Build FluentCRM automations on these tags." /></div>
          <div><label className="label">Affiliate tag</label><input name="crmAffiliateTag" defaultValue={s.crmAffiliateTag} className="input" /></div>
          <div><label className="label">Referred-customer tag</label><input name="crmReferredCustomerTag" defaultValue={s.crmReferredCustomerTag} className="input" /></div>
          <div><label className="label">Add affiliates to list</label><input name="crmListName" defaultValue={s.crmListName} className="input" /></div>
        </Section>
        <div className="sticky bottom-4"><button className="btn-primary shadow-lg">Save settings</button></div>
      </form>
      <form action={syncAllAffiliatesToCrm} className="card mt-6 flex max-w-3xl flex-wrap items-center justify-between gap-4 p-6">
        <div><div className="font-medium">Full FluentCRM re-sync</div><p className="muted">Push every affiliate's tags, status and earnings to FluentCRM now.</p></div>
        <button className="btn-secondary">Sync all affiliates</button>
      </form>
    </>
  );
}
