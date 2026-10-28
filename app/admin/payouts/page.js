import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, fullName, date } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { createPayouts } from "@/app/actions/admin";

export default async function Payouts({ searchParams }) {
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  const owed = await prisma.referral.groupBy({ by: ["affiliateId"], where: { status: "UNPAID" }, _sum: { amount: true }, _count: true });
  const affs = await prisma.affiliate.findMany({ where: { id: { in: owed.map((o) => o.affiliateId) } } });
  const byId = Object.fromEntries(affs.map((a) => [a.id, a]));
  const rows = owed.map((o) => ({ a: byId[o.affiliateId], amount: Number(o._sum.amount || 0), count: o._count })).filter((r) => r.a).sort((x, y) => y.amount - x.amount);
  const history = await prisma.payout.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { affiliate: true } });

  return (
    <>
      <PageHeader title="Payouts" subtitle={`Pay affiliates whose unpaid balance is at least ${m(s.minimumPayout)}`}>
        <a href="/api/admin/payouts-csv" className="btn-secondary">Download PayPal Payouts CSV</a>
      </PageHeader>
      {searchParams.created && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{searchParams.created} payouts recorded and referrals marked paid.</p>}
      <form action={createPayouts} className="card overflow-x-auto">
        <div className="px-5 py-4 text-sm text-slate-500">
          1. Download the CSV and upload it to PayPal (Pay &gt; Payouts), or pay by bank. 2. Tick who you paid and click <strong>Mark as paid</strong>.
        </div>
        <table className="table">
          <thead><tr><th></th><th>Affiliate</th><th>Pay to</th><th>Referrals</th><th>Owed</th></tr></thead>
          <tbody>{rows.map(({ a, amount, count }) => (
            <tr key={a.id} className={amount < s.minimumPayout ? "opacity-50" : ""}>
              <td><input type="checkbox" name="affiliateId" value={a.id} defaultChecked={amount >= s.minimumPayout} /></td>
              <td><Link href={`/admin/affiliates/${a.id}`} className="text-cosmic-700">{fullName(a)}</Link></td>
              <td className="text-xs">{a.paymentEmail || a.email}</td>
              <td>{count}</td>
              <td className="font-medium">{m(amount)}{amount < s.minimumPayout && <span className="ml-2 text-xs text-slate-400">below minimum</span>}</td>
            </tr>
          ))}</tbody>
        </table>
        {!rows.length ? <Empty>Nobody is owed anything right now</Empty> : (
          <div className="flex flex-wrap items-end gap-3 p-5">
            <div><label className="label">Method</label><select name="method" className="input"><option value="paypal">PayPal</option><option value="bank">Bank transfer</option><option value="stripe">Stripe</option><option value="other">Other</option></select></div>
            <div><label className="label">Reference (optional)</label><input name="reference" className="input" placeholder="PayPal batch ID" /></div>
            <button className="btn-primary">Mark selected as paid</button>
          </div>
        )}
      </form>
      <div className="card mt-6 overflow-x-auto">
        <div className="px-5 py-4 font-medium">Payout history</div>
        <table className="table"><thead><tr><th>Date</th><th>Affiliate</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th></tr></thead>
          <tbody>{history.map((p) => (
            <tr key={p.id}><td>{date(p.createdAt)}</td><td>{fullName(p.affiliate)}</td><td>{m(p.amount)}</td><td>{p.method}</td><td>{p.reference}</td><td><Badge value={p.status} /></td></tr>
          ))}</tbody>
        </table>
        {!history.length && <Empty>No payouts yet</Empty>}
      </div>
    </>
  );
}
