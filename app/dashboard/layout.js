import Shell from "@/components/Shell";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }) {
  const user = await requireAffiliate();
  const a = user.affiliate;
  if (a.status !== "ACTIVE")
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="h1">{a.status === "PENDING" ? "Your application is being reviewed" : "Your affiliate account isn't active"}</h1>
        <p className="muted mt-3">{a.status === "PENDING" ? "We'll email you as soon as you're approved." : "Please contact us if you think this is a mistake."}</p>
        <form action="/logout" method="post" className="mt-6"><button className="btn-secondary">Log out</button></form>
      </div>
    );
  const s = await getSettings();
  const nav = [
    { href: "/dashboard", label: "Statistics" },
    { href: "/dashboard/links", label: "Products & links" },
    { href: "/dashboard/referrals", label: "Referrals" },
    { href: "/dashboard/visits", label: "Visits & campaigns" },
    { href: "/dashboard/payouts", label: "Payouts" },
    { href: "/dashboard/creatives", label: "Creatives" },
    ...(a.coupons.length ? [{ href: "/dashboard/coupons", label: "Coupons" }] : []),
    ...(s.multiTier ? [{ href: "/dashboard/network", label: "My network" }] : []),
    ...(s.directLinkTracking ? [{ href: "/dashboard/direct-links", label: "Direct links" }] : []),
    ...(s.showLeaderboard ? [{ href: "/dashboard/leaderboard", label: "Leaderboard" }] : []),
    { href: "/dashboard/disputes", label: "Disputes & queries" },
    { href: "/dashboard/account", label: "Account" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "← Admin" }] : []),
  ];
  return <Shell nav={nav} user={user} title="Affiliate Hub">{children}</Shell>;
}
