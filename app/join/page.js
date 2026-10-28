import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { applyAsAffiliate } from "@/app/actions/auth";
import { getSettings } from "@/lib/settings";
import { findAffiliateByRef } from "@/lib/affiliates";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const ERRORS = {
  exists: "That email is already registered. Log in instead.",
  terms: "Please accept the affiliate terms.",
  velocity: "Too many applications from your connection today. Please try again tomorrow.",
  email: "Please enter a valid email address.",
  missing: "Please fill in the required fields.",
};

const OPTIONAL_FIELDS = {
  website: { label: "Website or blog" },
  instagram: { label: "Instagram handle" },
  youtube: { label: "YouTube channel" },
  tiktok: { label: "TikTok handle" },
  audience: { label: "Audience size (approx.)" },
  phone: { label: "Phone number" },
  promotionPlan: { label: "How will you promote us?", textarea: true },
};

export default async function Join({ searchParams }) {
  const s = await getSettings();
  const rate = s.defaultRateType === "FLAT" ? `${money(s.defaultRate, s.currency)} per sale` : `${s.defaultRate}% commission`;
  const recruiter = searchParams.ref ? await findAffiliateByRef(searchParams.ref) : null;
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
      {searchParams.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[searchParams.error] || ERRORS.missing}</p>}
      {recruiter?.status === "ACTIVE" && <p className="mb-4 rounded-lg bg-cosmic-50 p-3 text-sm text-cosmic-700">Invited by {recruiter.firstName || recruiter.code}</p>}
      <form action={applyAsAffiliate} className="space-y-4">
        <input type="hidden" name="parentRef" value={recruiter?.code || ""} />
        <div className="absolute -left-[9999px]" aria-hidden="true"><label>Company<input name="company" tabIndex={-1} autoComplete="off" /></label></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name *</label><input name="firstName" required className="input" /></div>
          <div><label className="label">Last name</label><input name="lastName" className="input" /></div>
        </div>
        <div><label className="label">Email *</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">PayPal email for payouts</label><input name="paymentEmail" type="email" className="input" placeholder="Same as above if blank" /></div>
        <div><label className="label">Preferred referral code</label><input name="code" className="input" placeholder="e.g. jane" /></div>
        {(s.registrationFields || []).filter((f) => OPTIONAL_FIELDS[f]).map((f) => (
          <div key={f}>
            <label className="label">{OPTIONAL_FIELDS[f].label}</label>
            {OPTIONAL_FIELDS[f].textarea ? <textarea name={f} rows={3} className="input" /> : <input name={f} className="input" />}
          </div>
        ))}
        {s.requireTerms && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="terms" required className="mt-1" />
            <span>I agree to the {s.termsUrl ? <a href={s.termsUrl} target="_blank" className="text-cosmic-600 underline">affiliate terms</a> : "affiliate terms"}</span>
          </label>
        )}
        <button className="btn-primary w-full">Submit application</button>
      </form>
    </AuthShell>
  );
}
