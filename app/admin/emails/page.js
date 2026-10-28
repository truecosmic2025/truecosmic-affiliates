import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { updateEmails, sendTestEmail } from "@/app/actions/admin";

const LABELS = {
  adminNewApplication: ["To you: new application", "Sent to ADMIN_EMAIL when someone applies"],
  applicationReceived: ["To affiliate: application received", "When an application is pending review"],
  approved: ["To affiliate: approved", "When an account becomes active"],
  rejected: ["To affiliate: rejected", "{reason} is the reason you type when rejecting"],
  newReferral: ["To affiliate: new referral", "Affiliates can switch this off in their account"],
  payoutSent: ["To affiliate: payout sent", "{amount} and {method} are filled in"],
  adminNewReferral: ["To you: new referral", "Leave the subject empty to switch off"],
};

export default async function Emails({ searchParams }) {
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Email notifications" subtitle="Sent through your WordPress site's mail setup. Leave a subject empty to switch that email off. Tags: {first_name} {name} {email} {site} {link} {code} {login_url} {dashboard_url} {amount} {products} {method} {reason}" />
      {searchParams.saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved.</p>}
      {searchParams.tested && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Test email sent to you. Check the Activity log if it doesn't arrive.</p>}
      <form action={updateEmails} className="max-w-4xl space-y-4">
        {Object.entries(LABELS).map(([key, [label, hint]]) => (
          <section key={key} className="card space-y-2 p-5">
            <div className="flex items-center justify-between"><div><div className="font-medium">{label}</div><div className="text-xs text-slate-400">{hint}</div></div>
              <button formAction={sendTestEmail.bind(null, key)} className="btn-secondary btn-sm">Send me a test</button></div>
            <input name={`${key}.subject`} defaultValue={s.emails[key]?.subject} placeholder="Subject (empty = off)" className="input" />
            <textarea name={`${key}.body`} defaultValue={s.emails[key]?.body} rows={4} className="input font-mono text-xs" />
          </section>
        ))}
        <button className="btn-primary">Save emails</button>
      </form>
    </>
  );
}
