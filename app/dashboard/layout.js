import Shell from "@/components/Shell";
import { requireAffiliate } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/links", label: "Products & links" },
  { href: "/dashboard/referrals", label: "Referrals" },
  { href: "/dashboard/payouts", label: "Payouts" },
  { href: "/dashboard/creatives", label: "Creatives" },
  { href: "/dashboard/account", label: "Account" },
];

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
  const nav = user.role === "ADMIN" ? [...NAV, { href: "/admin", label: "← Admin" }] : NAV;
  return <Shell nav={nav} user={user} title="Affiliate Hub">{children}</Shell>;
}
