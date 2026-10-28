import { getSettings } from "@/lib/settings";
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

export default async function Settings({ searchParams }) {
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      {searchParams.saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Settings saved.</p>}
      {searchParams.crm && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Pushed {searchParams.crm} affiliates to FluentCRM. Check the activity log for any errors.</p>}
      <form action={updateSettings} className="max-w-3xl space-y-6">
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <div className="font-medium sm:col-span-2">General</div>
          <div><label className="label">Programme name</label><input name="siteName" defaultValue={s.siteName} className="input" /></div>
          <div><label className="label">Academy URL (default link target)</label><input name="academyUrl" defaultValue={s.academyUrl} className="input" /></div>
          <div><label className="label">Currency</label><select name="currency" defaultValue={s.currency} className="input"><option>GBP</option><option>USD</option><option>EUR</option><option>AUD</option><option>CAD</option></select></div>
          <div><label className="label">Referral URL variable</label><input name="referralVar" defaultValue={s.referralVar} className="input" /><p className="mt-1 text-xs text-slate-400">Keep “ref” so old AffiliateWP links still work.</p></div>
          <div><label className="label">Cookie length (days)</label><input name="cookieDays" type="number" min="1" defaultValue={s.cookieDays} className="input" /></div>
        </section>
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <div className="font-medium sm:col-span-2">Commissions</div>
          <div><label className="label">Default rate type</label><select name="defaultRateType" defaultValue={s.defaultRateType} className="input"><option value="PERCENTAGE">Percentage</option><option value="FLAT">Flat per item</option></select></div>
          <div><label className="label">Default rate</label><input name="defaultRate" type="number" step="0.01" defaultValue={s.defaultRate} className="input" /></div>
          <div><label className="label">Minimum payout</label><input name="minimumPayout" type="number" step="0.01" defaultValue={s.minimumPayout} className="input" /></div>
          <div className="space-y-3 sm:col-span-2">
            <Toggle name="newProductsEarnCommission" checked={s.newProductsEarnCommission} label="New academy products earn commission automatically" hint="When you publish a new course, ebook or coaching product in WooCommerce it's immediately promotable." />
            <Toggle name="autoApproveAffiliates" checked={s.autoApproveAffiliates} label="Auto-approve new affiliate applications" />
            <Toggle name="referralsStartPending" checked={s.referralsStartPending} label="Hold new commissions for approval" hint="Useful if you have a refund window. Approve them in Referrals before paying." />
            <Toggle name="allowSelfReferral" checked={s.allowSelfReferral} label="Allow affiliates to earn on their own purchases" />
          </div>
        </section>
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <div className="font-medium sm:col-span-2">FluentCRM sync</div>
          <div className="sm:col-span-2"><Toggle name="crmEnabled" checked={s.crmEnabled} label="Sync affiliates and referred customers to FluentCRM" hint="Contacts get tags like “Affiliate - Active” and “Affiliate - Has Sales”. Build FluentCRM automations on these tags for onboarding and nurture emails." /></div>
          <div><label className="label">Affiliate tag</label><input name="crmAffiliateTag" defaultValue={s.crmAffiliateTag} className="input" /></div>
          <div><label className="label">Referred-customer tag</label><input name="crmReferredCustomerTag" defaultValue={s.crmReferredCustomerTag} className="input" /></div>
          <div><label className="label">Add affiliates to list</label><input name="crmListName" defaultValue={s.crmListName} className="input" /></div>
        </section>
        <button className="btn-primary">Save settings</button>
      </form>
      <form action={syncAllAffiliatesToCrm} className="card mt-6 flex max-w-3xl flex-wrap items-center justify-between gap-4 p-6">
        <div><div className="font-medium">Full FluentCRM re-sync</div><p className="muted">Push every affiliate's tags, status and earnings to FluentCRM now.</p></div>
        <button className="btn-secondary">Sync all affiliates</button>
      </form>
    </>
  );
}
