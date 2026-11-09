import Shell from "@/components/Shell";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";

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
  const openQueries = await prisma.dispute.count({ where: { affiliateId: a.id, status: { in: ["open", "in_review"] } } });
  const nav = [
    { href: "/dashboard", label: "Overview", icon: "home", section: "Earn" },
    { href: "/dashboard/links", label: "Products & links", icon: "link", section: "Earn" },
    { href: "/dashboard/creatives", label: "Creatives", icon: "image", section: "Earn" },
    ...(a.coupons.length ? [{ href: "/dashboard/coupons", label: "Coupons", icon: "tag", section: "Earn" }] : []),
    ...(s.directLinkTracking ? [{ href: "/dashboard/direct-links", label: "Direct links", icon: "globe", section: "Earn" }] : []),
    { href: "/dashboard/referrals", label: "Referrals", icon: "receipt", section: "Results" },
    { href: "/dashboard/visits", label: "Clicks & campaigns", icon: "cursor", section: "Results" },
    { href: "/dashboard/payouts", label: "Payouts", icon: "wallet", section: "Results" },
    ...(s.multiTier ? [{ href: "/dashboard/network", label: "My network", icon: "users", section: "Results" }] : []),
    ...(s.showLeaderboard ? [{ href: "/dashboard/leaderboard", label: "Leaderboard", icon: "trophy", section: "Results" }] : []),
    { href: "/dashboard/disputes", label: "Questions & disputes", icon: "chat", section: "You", badge: openQueries || null },
    { href: "/dashboard/account", label: "Account & payment", icon: "user", section: "You" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Back to admin", icon: "back", section: "You" }] : []),
  ];
  return <Shell nav={nav} user={user} title="Affiliate Hub">{children}</Shell>;
}
