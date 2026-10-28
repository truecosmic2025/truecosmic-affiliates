import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { passwordLogin, sendMagicLink } from "@/app/actions/auth";

export default function Login({ searchParams }) {
  return (
    <AuthShell title="Affiliate login" subtitle="Track your referrals, links and earnings">
      {searchParams.sent && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">If that email has an account, a login link is on its way. Check your inbox.</p>}
      {searchParams.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error === "expired" ? "That link has expired. Request a new one." : "Those details didn't match."}</p>}
      <form action={sendMagicLink} className="space-y-3">
        <label className="label" htmlFor="ml-email">Email address</label>
        <input id="ml-email" name="email" type="email" required className="input" placeholder="you@example.com" />
        <button className="btn-primary w-full">Email me a login link</button>
      </form>
      <details className="mt-6 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer text-sm text-slate-500">Sign in with a password (admin)</summary>
        <form action={passwordLogin} className="mt-3 space-y-3">
          <input name="email" type="email" required className="input" placeholder="Email" />
          <input name="password" type="password" required className="input" placeholder="Password" />
          <button className="btn-secondary w-full">Sign in</button>
        </form>
      </details>
      <p className="mt-6 text-center text-sm text-slate-500">
        Not an affiliate yet? <Link href="/join" className="font-medium text-cosmic-600">Apply to join</Link>
      </p>
    </AuthShell>
  );
}
