import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, fullName, date } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";
import { approvePayRun, payRunGroupPaid, payoutPaid, payoutFailed, checkPayPalRun, createManualPayout } from "@/app/actions/admin";
import { paypalConfigured } from "@/lib/paypal";
import { eligibleRun } from "@/lib/payruns";
import { clearingWhere, nextPayoutDate, isPayoutDay } from "@/lib/payouts";
import { METHODS, describe } from "@/lib/payoutMethods";

const NEXT_STEP = {
  paypal: (api) => (api ? "Sent automatically through the PayPal API. Use “Check PayPal status” to mark items paid or failed." : "PayPal API isn't connected: download the PayPal file, upload it in PayPal (Pay → Payouts), then mark the group paid."),
  wise: () => "Download the Wise batch file, upload it in Wise (Payments → Batch), confirm and fund it in Wise, then mark the group paid.",
  payoneer: () => "Download the list, pay in Payoneer, then mark the group paid with the Payoneer reference.",
  other: () => "Download the list (each row has the affiliate's instructions), pay them, then mark the group paid with a reference.",
};

export default async function Payouts({ searchParams }) {
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  const api = paypalConfigured();
  const [{ groups, total, belowMinimum }, clearing, inFlight, history, affiliates] = await Promise.all([
    eligibleRun(s),
    prisma.referral.aggregate({ where: clearingWhere(), _sum: { amount: true }, _count: true }),
    prisma.payout.findMany({ where: { status: "PROCESSING" }, include: { affiliate: true, run: true }, orderBy: { createdAt: "desc" } }),
    prisma.payout.findMany({ where: { status: { in: ["PAID", "FAILED"] } }, orderBy: { createdAt: "desc" }, take: 60, include: { affiliate: true } }),
    prisma.affiliate.findMany({ where: { status: { in: ["ACTIVE", "INACTIVE"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, email: true } }),
  ]);
  const runs = new Map();
  for (const p of inFlight) {
    const key = p.runId || `manual-${p.id}`;
    const r = runs.get(key) || { run: p.run, items: [] };
    r.items.push(p);
    runs.set(key, r);
  }
  const eligibleCount = Object.values(groups).reduce((x, g) => x + g.length, 0);

  return (
    <>
      <PageHeader title="Payouts" subtitle={`One pay run a month (day ${s.payoutDay}). Commissions clear ${s.holdDays} days after the sale; balances of ${m(s.minimumPayout)} or more are paid. All amounts in ${s.currency}.`} />
      <div className={`mb-4 rounded-lg p-4 text-sm ${isPayoutDay(s) ? "bg-cosmic-50 text-cosmic-800 ring-1 ring-cosmic-200" : "bg-white ring-1 ring-slate-200"}`}>
        {isPayoutDay(s) ? <strong>Today is payout day.</strong> : <>Next pay run: <strong>{date(nextPayoutDate(s))}</strong>.</>}{" "}
        {m(clearing._sum.amount)} across {clearing._count} commissions is still inside the refund window.
      </div>
      {searchParams.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>}
      {searchParams.run && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Pay run approved. Finish each group below.</p>}
      {searchParams.marked && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{searchParams.marked} payouts marked paid and affiliates emailed.</p>}
      {searchParams.failed && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Payout marked failed: the amount is back in the affiliate's balance and they've been emailed.</p>}
      {searchParams.synced && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">PayPal status checked: {searchParams.synced.split("-")[0]} paid, {searchParams.synced.split("-")[1]} failed, {searchParams.synced.split("-")[2]} still waiting.</p>}
      {searchParams.manual && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Manual payout recorded.</p>}

      {[...runs.values()].length > 0 && (
        <section className="mb-6 space-y-4">
          <h2 className="font-medium">In progress</h2>
          {[...runs.entries()].map(([key, { run, items }]) => (
            <div key={key} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <div className="font-medium">{run ? `Pay run approved ${date(run.createdAt)} by ${run.approvedBy}` : `Manual payout ${date(items[0].createdAt)}`}</div>
                {run?.paypalBatchId && <form action={checkPayPalRun.bind(null, run.id)}><button className="btn-secondary btn-sm">Check PayPal status</button></form>}
              </div>
              {Object.keys(METHODS).filter((meth) => items.some((p) => p.method === meth)).map((meth) => {
                const list = items.filter((p) => p.method === meth);
                const viaApi = meth === "paypal" && !!run?.paypalBatchId;
                return (
                  <div key={meth} className="border-t border-slate-100 px-5 py-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div><span className="font-medium">{METHODS[meth].label}</span> · {list.length} · {m(list.reduce((x, p) => x + Number(p.amount), 0))}
                        <div className="text-xs text-slate-500">{NEXT_STEP[meth](viaApi)}</div></div>
                      {run && !viaApi && (
                        <div className="flex flex-wrap items-center gap-2">
                          <a href={`/api/admin/payruns/${run.id}/export?method=${meth}`} className="btn-secondary btn-sm">Download {meth === "wise" ? "Wise batch" : meth === "paypal" ? "PayPal" : ""} file</a>
                          <form action={payRunGroupPaid.bind(null, run.id, meth)} className="flex gap-1">
                            <input name="reference" placeholder={{ wise: "Wise batch ID (optional)", paypal: "PayPal batch / transaction ID", payoneer: "Payoneer payment reference", other: "Payment reference" }[meth]} required={meth !== "wise"} className="input py-1 text-xs" />
                            <ConfirmButton className="btn-primary btn-sm" message={`Confirm all ${list.length} ${METHODS[meth].label} payouts were paid? Affiliates will be emailed.`}>Mark group paid</ConfirmButton>
                          </form>
                        </div>
                      )}
                    </div>
                    <table className="table">
                      <tbody>{list.map((p) => (
                        <tr key={p.id}>
                          <td><Link href={`/admin/affiliates/${p.affiliateId}`} className="text-cosmic-700">{fullName(p.affiliate)}</Link>{p.kind === "manual" && <div className="text-xs text-slate-400">manual: {p.reason}</div>}</td>
                          <td className="text-xs">{describe(p.payTo || { method: p.method })}</td>
                          <td className="font-medium">{m(p.amount)}</td>
                          <td className="text-xs text-slate-400">{p.reference}</td>
                          <td className="whitespace-nowrap">
                            <div className="flex gap-1">
                              {!viaApi && <form action={payoutPaid.bind(null, p.id)}><button className="btn-secondary btn-sm">Paid</button></form>}
                              <form action={payoutFailed.bind(null, p.id)} className="flex gap-1"><input name="reason" placeholder="Why it failed" className="input w-36 py-1 text-xs" /><button className="btn-danger btn-sm">Failed</button></form>
                            </div>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}

      <form action={approvePayRun} className="card mb-6">
        <div className="px-5 py-4">
          <div className="font-medium">Prepare pay run</div>
          <p className="muted">Everyone with a cleared balance of at least {m(s.minimumPayout)}, grouped by how they want to be paid. Untick anyone to hold them back. One approval starts the whole run.</p>
        </div>
        {Object.entries(groups).filter(([, list]) => list.length).map(([meth, list]) => (
          <div key={meth} className="border-t border-slate-100">
            <div className="flex justify-between bg-slate-50 px-5 py-2 text-sm"><span className="font-medium">{METHODS[meth].label}{meth === "paypal" && (api ? " · sent automatically" : " · PayPal API not connected, file export")}</span><span>{list.length} · {m(list.reduce((x, r) => x + r.amount, 0))}</span></div>
            <table className="table"><tbody>{list.map((r) => (
              <tr key={r.affiliate.id}>
                <td className="w-8"><input type="checkbox" name="affiliateId" value={r.affiliate.id} defaultChecked /></td>
                <td><Link href={`/admin/affiliates/${r.affiliate.id}`} className="text-cosmic-700">{fullName(r.affiliate)}</Link></td>
                <td className="text-xs">{describe(r.payTo)}</td>
                <td>{r.count} commissions</td>
                <td className="font-medium">{m(r.amount)}</td>
              </tr>
            ))}</tbody></table>
          </div>
        ))}
        {!eligibleCount ? <Empty>Nobody has a cleared balance of {m(s.minimumPayout)} or more yet</Empty> : (
          <div className="flex items-center justify-between border-t border-slate-100 p-5">
            <span className="text-sm">Total: <strong>{m(total)}</strong> to {eligibleCount} affiliates</span>
            <ConfirmButton className="btn-primary" message={`Approve this pay run of ${m(total)}?${api && groups.paypal.length ? " PayPal payments are sent immediately." : ""}`}>Approve pay run</ConfirmButton>
          </div>
        )}
        {belowMinimum.length > 0 && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">{belowMinimum.length} affiliates have cleared balances below the minimum ({m(belowMinimum.reduce((x, r) => x + r.amount, 0))} in total) and roll over to next month.</p>}
      </form>

      <form id="manual" action={createManualPayout} className="card mb-6 grid gap-3 p-5 md:grid-cols-3">
        <div className="md:col-span-3"><div className="font-medium">Manual payout</div><p className="muted">Pay any affiliate a custom amount at any time: a prize, a settlement, a correction. It doesn't change their commission balance.</p></div>
        <div><label className="label">Affiliate</label><select name="affiliateId" required className="input">{affiliates.map((a) => <option key={a.id} value={a.id}>{fullName(a)} ({a.email})</option>)}</select></div>
        <div><label className="label">Amount ({s.currency})</label><input name="amount" type="number" step="0.01" min="0.01" required className="input" /></div>
        <div><label className="label">Method</label><select name="method" className="input">{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div className="md:col-span-2"><label className="label">Reason (required, shown in the history)</label><input name="reason" required maxLength={500} placeholder="e.g. October launch competition winner" className="input" /></div>
        <div><label className="label">Reference</label><input name="reference" placeholder="Transaction ID" className="input" /></div>
        <div className="md:col-span-3 flex flex-wrap items-center gap-4">
          {api && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sendViaPayPal" /> Send now through the PayPal API (PayPal method only)</label>}
          <ConfirmButton className="btn-primary" message="Record this manual payout? The affiliate will be emailed.">Record manual payout</ConfirmButton>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <div className="px-5 py-4 font-medium">History</div>
        <table className="table"><thead><tr><th>Date</th><th>Affiliate</th><th>Amount</th><th>Method</th><th>Type</th><th>Reference</th><th>Status</th></tr></thead>
          <tbody>{history.map((p) => (
            <tr key={p.id}><td>{date(p.paidAt || p.createdAt)}</td><td>{fullName(p.affiliate)}</td><td>{m(p.amount)}</td><td>{METHODS[p.method]?.label || p.method}</td>
              <td className="text-xs">{p.kind === "manual" ? `Manual: ${p.reason}` : "Pay run"}</td>
              <td className="text-xs">{p.reference}{p.failureReason && <div className="text-red-600">{p.failureReason}</div>}</td><td><Badge value={p.status} /></td></tr>
          ))}</tbody>
        </table>
        {!history.length && <Empty>No payouts yet</Empty>}
      </div>
    </>
  );
}
