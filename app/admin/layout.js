import Shell from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/visits", label: "Visits" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/rules", label: "Commission rules" },
  { href: "/admin/creatives", label: "Creatives" },
  { href: "/admin/direct-links", label: "Direct links" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/import", label: "Import from AffiliateWP" },
  { href: "/admin/api", label: "API & webhooks" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Activity log" },
];

export default async function AdminLayout({ children }) {
  const user = await requireAdmin();
  return <Shell nav={NAV} user={user} title="Affiliate Admin">{children}</Shell>;
}
