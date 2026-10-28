import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, fullName, date } from "@/lib/format";
import { PageHeader, Badge, Tabs, Empty } from "@/components/ui";
import { setReferralStatus, addManualReferral } from "@/app/actions/admin";

export default async function Referrals({ searchParams }) {
  const s = await getSettings();
  const status = searchParams.status;
  const where = { ...(status ? { status } : {}), ...(searchParams.affiliate ? { affiliateId: searchParams.affiliate } : {}) };
  const [rows, affiliates] = await Promise.all([
    prisma.referral.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, include: { affiliate: true } }),
    prisma.affiliate.findMany({ where: { status: "ACTIVE" }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, email: true } }),
  ]);
  const m = (v) => money(v, s.currency);
  const qs = searchParams.affiliate ? `&affiliate=${searchParams.affiliate}` : "";
  return (
    <>
      <PageHeader title="Referrals" subtitle="Commissions created from WooCommerce orders, coupons, imports and manual entries" />
      <Tabs active={status || "all"} items={[
        { key: "all", label: "All", href: `/admin/referrals?${qs.slice(1)}` },
        ...["PENDING", "UNPAID", "PAID", "REJECTED"].map((k) => ({ key: k, label: k[0] + k.slice(1).toLowerCase(), href: `/admin/referrals?status=${k}${qs}` })),
      ]} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Affiliate</th><th>Order</th><th>Customer</th><th>Products</th><th>Order total</th><th>Commission</th><th>Source</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">{date(r.createdAt)}</td>
              <td><Link className="text-cosmic-700" href={`/admin/affiliates/${r.affiliateId}`}>{fullName(r.affiliate)}</Link></td>
              <td>{r.orderId || "—"}</td>
              <td className="text-xs">{r.customerEmail || "—"}</td>
              <td className="max-w-[220px] truncate" title={r.description || ""}>{r.description}</td>
              <td>{m(r.orderTotal)}</td>
              <td className="font-medium">{m(r.amount)}</td>
              <td className="text-xs">{r.source}</td>
              <td><Badge value={r.status} /></td>
              <td className="whitespace-nowrap">
                <div className="flex gap-1">
                  {r.status === "PENDING" && <form action={setReferralStatus.bind(null, r.id, "UNPAID")}><button className="btn-primary btn-sm">Approve</button></form>}
                  {["PENDING", "UNPAID"].includes(r.status) && <form action={setReferralStatus.bind(null, r.id, "REJECTED")}><button className="btn-danger btn-sm">Reject</button></form>}
                  {r.status === "REJECTED" && <form action={setReferralStatus.bind(null, r.id, "UNPAID")}><button className="btn-secondary btn-sm">Restore</button></form>}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!rows.length && <Empty>No referrals here yet</Empty>}
      </div>
      <form action={addManualReferral} className="card mt-6 grid max-w-3xl gap-3 p-6 sm:grid-cols-2">
        <div className="font-medium sm:col-span-2">Add a manual referral</div>
        <div><label className="label">Affiliate</label>
          <select name="affiliateId" required className="input">{affiliates.map((a) => <option key={a.id} value={a.id}>{fullName(a)}</option>)}</select></div>
        <div><label className="label">Commission amount</label><input name="amount" type="number" step="0.01" min="0" required className="input" /></div>
        <div><label className="label">Order ID (optional)</label><input name="orderId" className="input" /></div>
        <div><label className="label">Description</label><input name="description" className="input" placeholder="e.g. Coaching package sold by phone" /></div>
        <div><button className="btn-primary">Add referral</button></div>
      </form>
    </>
  );
}
