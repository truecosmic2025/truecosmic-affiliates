import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { applyAsAffiliate } from "@/app/actions/auth";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Join({ searchParams }) {
  const s = await getSettings();
  const rate = s.defaultRateType === "FLAT" ? `${money(s.defaultRate, s.currency)} per sale` : `${s.defaultRate}% commission`;
  if (searchParams.done)
    return (
      <AuthShell title="Thank you!">
        <p className="text-sm text-slate-600">
          {searchParams.done === "active"
            ? "Your affiliate account is active. Log in with your email to get your links."
            : "Your application has been received. We'll email you as soon as it's approved."}
        </p>
        <Link href="/login" className="btn-primary mt-4 w-full">Go to login</Link>
      </AuthShell>
    );
  return (
    <AuthShell title="Become an affiliate" subtitle={`Share our courses, ebooks and coaching and earn ${rate}.`}>
      {searchParams.error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error === "exists" ? "That email is already registered. Log in instead." : "Please fill in the required fields."}
        </p>
      )}
      <form action={applyAsAffiliate} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name *</label><input name="firstName" required className="input" /></div>
          <div><label className="label">Last name</label><input name="lastName" className="input" /></div>
        </div>
        <div><label className="label">Email *</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">PayPal email for payouts</label><input name="paymentEmail" type="email" className="input" placeholder="Same as above if blank" /></div>
        <div><label className="label">Preferred referral code</label><input name="code" className="input" placeholder="e.g. jane" /></div>
        <div><label className="label">Website or social profile</label><input name="website" className="input" /></div>
        <div><label className="label">How will you promote us?</label><textarea name="promotionPlan" rows={3} className="input" /></div>
        <button className="btn-primary w-full">Submit application</button>
      </form>
    </AuthShell>
  );
}
