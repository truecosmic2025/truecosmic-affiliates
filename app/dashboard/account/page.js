import { requireAffiliate } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import PayoutMethodForm from "@/components/PayoutMethodForm";
import { METHODS, payTo, describe } from "@/lib/payoutMethods";
import { updateMyAccount, requestPayoutChange, cancelPayoutChange } from "@/app/actions/affiliate";

export default async function Account({ searchParams }) {
  const { affiliate: a } = await requireAffiliate();
  const current = payTo(a);
  const pending = a.pendingPayout && a.pendingPayoutExpires > new Date() ? a.pendingPayout : null;
  return (
    <>
      <PageHeader title="Account" subtitle={`Referral code: ${a.code}`} />
      {searchParams.saved && <p className="mb-4 max-w-2xl rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved.</p>}
      {searchParams.payoutConfirmed && <p className="mb-4 max-w-2xl rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Your new payout details are confirmed and will be used for your next payout.</p>}
      {searchParams.payoutError && <p className="mb-4 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.payoutError}</p>}
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-6">
          <div className="font-medium">How you get paid</div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">Currently: <strong>{describe(current)}</strong></div>
          {pending && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Waiting for confirmation: <strong>{describe(pending)}</strong>. Check {a.email} for the confirmation link.
              <form action={cancelPayoutChange} className="mt-2"><button className="text-xs underline">Cancel this change</button></form>
            </div>
          )}
          <PayoutMethodForm action={requestPayoutChange} methods={METHODS} current={current} />
        </section>
        <form action={updateMyAccount} className="card space-y-4 p-6">
          <div className="font-medium">Profile</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">First name</label><input name="firstName" defaultValue={a.firstName || ""} className="input" /></div>
            <div><label className="label">Last name</label><input name="lastName" defaultValue={a.lastName || ""} className="input" /></div>
          </div>
          <div><label className="label">Login email</label><input disabled value={a.email} className="input bg-slate-50" /></div>
          <div><label className="label">Website or social profile</label><input name="website" defaultValue={a.website || ""} className="input" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="emailOnReferral" defaultChecked={a.emailOnReferral} /> Email me when I earn a new commission</label>
          <button className="btn-primary">Save profile</button>
        </form>
      </div>
    </>
  );
}
