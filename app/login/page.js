import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { passwordLogin, sendMagicLink } from "@/app/actions/auth";

const ERRORS = {
  invalid: "That email and password didn't match. Try again, or email yourself a sign-in link below.",
  nopassword: "You haven't set a password yet. Email yourself a sign-in link below, then set one under Account & payment.",
  locked: "Too many attempts. Wait 15 minutes, or email yourself a sign-in link below.",
  expired: "That link has expired. Request a new one below.",
};

export default function Login({ searchParams }) {
  const email = searchParams.email || "";
  return (
    <AuthShell title="Affiliate login" subtitle="Track your referrals, links and earnings">
      {searchParams.sent && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">If that email has an account, a sign-in link is on its way. Check your inbox (and spam folder).</p>}
      {searchParams.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[searchParams.error] || ERRORS.invalid}</p>}
      <form action={passwordLogin} className="space-y-3">
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className="input" placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <button className="btn-primary w-full">Sign in</button>
      </form>
      <div className="mt-6 border-t border-slate-100 pt-5">
        <p className="mb-3 text-sm text-slate-600"><strong className="text-slate-800">No password yet, or forgotten it?</strong> We&apos;ll email you a one-time sign-in link. You can then set a password under Account &amp; payment.</p>
        <form action={sendMagicLink} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="ml-email">Email address</label>
          <input id="ml-email" name="email" type="email" required autoComplete="email" defaultValue={email} className="input" placeholder="you@example.com" />
          <button className="btn-secondary shrink-0">Email me a link</button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Not an affiliate yet? <Link href="/join" className="font-medium text-cosmic-600">Apply to join</Link>
      </p>
    </AuthShell>
  );
}
