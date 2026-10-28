import { requireAffiliate } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { updateMyAccount } from "@/app/actions/affiliate";

export default async function Account({ searchParams }) {
  const { affiliate: a } = await requireAffiliate();
  return (
    <>
      <PageHeader title="Account" subtitle={`Referral code: ${a.code}`} />
      {searchParams.saved && <p className="mb-4 max-w-2xl rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved.</p>}
      <form action={updateMyAccount} className="card max-w-2xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">First name</label><input name="firstName" defaultValue={a.firstName || ""} className="input" /></div>
          <div><label className="label">Last name</label><input name="lastName" defaultValue={a.lastName || ""} className="input" /></div>
        </div>
        <div><label className="label">Login email</label><input disabled value={a.email} className="input bg-slate-50" /></div>
        <div><label className="label">PayPal / payment email</label><input name="paymentEmail" type="email" defaultValue={a.paymentEmail || ""} className="input" /></div>
        <div><label className="label">Website or social profile</label><input name="website" defaultValue={a.website || ""} className="input" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="emailOnReferral" defaultChecked={a.emailOnReferral} /> Email me when I earn a new commission</label>
        <button className="btn-primary">Save</button>
      </form>
    </>
  );
}
