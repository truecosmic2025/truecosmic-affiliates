import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { rateFor, hasAgreedRate, promotionRunning } from "@/lib/commission";
import { PageHeader, Badge, Tabs, Empty } from "@/components/ui";
import { updateProduct, requestProductSync, setKindCommission, assignCoach } from "@/app/actions/admin";
import ConfirmButton from "@/components/ConfirmButton";

const VIA = { "affiliate-product": "affiliate deal", promotion: "promotion", product: "this product", coach: "coach deal", category: "category", group: "group", tier: "tier", default: "default" };

export default async function Products({ searchParams }) {
  const s = await getSettings();
  const kind = searchParams.kind;
  const coachFilter = searchParams.coach;
  const [products, sales, deals, cats, promos] = await Promise.all([
    prisma.product.findMany({ where: { deleted: false, ...(kind ? { kind } : {}), ...(coachFilter ? { coach: coachFilter } : {}) }, orderBy: { createdAt: "desc" } }),
    prisma.referral.findMany({ where: { status: { in: ["UNPAID", "PAID"] }, source: { not: "import" } }, select: { items: true } }),
    prisma.coachDeal.findMany({ orderBy: { coach: "asc" } }),
    prisma.categoryRate.findMany(),
    prisma.promotion.findMany({ where: { active: true } }),
  ]);
  const soldCount = {};
  for (const r of sales) for (const i of Array.isArray(r.items) ? r.items : []) soldCount[i.productId] = (soldCount[i.productId] || 0) + Number(i.quantity || 1);
  const def = s.defaultRateType === "FLAT" ? money(s.defaultRate, s.currency) : `${s.defaultRate}%`;
  // Rate an affiliate on the default rate would earn today (individual affiliate deals can still differ)
  const ctx = {
    coachDeals: Object.fromEntries(deals.map((d) => [d.coach.toLowerCase(), d])),
    categoryRates: Object.fromEntries(cats.map((c) => [c.category.toLowerCase(), c])),
    promotions: promos.filter((p) => !p.groupIds.length && promotionRunning(p, {})),
  };
  const earns = (p) => {
    if (!p.commissionEnabled) return { label: "off", warn: false };
    const r = rateFor({ product: p, affiliate: {}, settings: s, ctx });
    if (!hasAgreedRate(p, r.via, s)) return { label: "no rate agreed yet", warn: true };
    return { label: `${r.type === "FLAT" ? money(r.rate, s.currency) : `${r.rate}%`} · ${r.coach ? `${r.coach} deal` : VIA[r.via]}`, warn: false };
  };
  const coachNames = [...new Set([...deals.map((d) => d.coach), ...(await prisma.product.findMany({ where: { coach: { not: null } }, select: { coach: true }, distinct: ["coach"] })).map((p) => p.coach)])].sort();
  const awaiting = products.filter((p) => p.kind === "event" && earns(p).warn).length;

  return (
    <>
      <PageHeader title="Products" subtitle={`Synced automatically from WooCommerce. New products ${s.newProductsEarnCommission ? "earn" : "do not earn"} the default ${def} unless changed here${s.eventsNeedAgreedRate ? "; events earn only once a rate is agreed (coach deal or event rate)" : ""}.`}>
        <form action={requestProductSync}><button className="btn-secondary">Re-sync all from WooCommerce</button></form>
      </PageHeader>
      {searchParams.synced && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">WordPress sent {searchParams.synced} products.</p>}
      {searchParams.syncError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Couldn't reach the WordPress connector. Check WP_SITE_URL and the shared secret (see Activity log).</p>}
      {searchParams.bulk && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Updated {searchParams.bulk} products.</p>}
      <Tabs active={kind || "all"} items={[{ key: "all", label: "All", href: "/admin/products" }, ...["course", "ebook", "coaching", "event", "membership", "other"].map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), href: `/admin/products?kind=${k}` }))]} />
      {kind === "event" && (
        <div className="mb-4 rounded-lg bg-white p-4 text-sm ring-1 ring-slate-200">
          Event commission is agreed with each coach. Tick events below, choose the coach and click <strong>Assign coach</strong>; set the coach's rate under <Link href="/admin/rules#coaches" className="text-cosmic-600">Commission rules → Coach deals</Link>. A rate on an individual event overrides the coach deal.
          {awaiting > 0 && <div className="mt-1 text-amber-700">{awaiting} events have no agreed rate yet, so affiliates earn nothing on them and they're hidden from affiliates' link lists.</div>}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <form id="bulkcoach" action={assignCoach} className="flex items-center gap-2">
          <input name="coach" list="coaches" placeholder="Coach name" className="input w-48 py-1 text-xs" />
          <datalist id="coaches">{coachNames.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="btn-secondary btn-sm">Assign coach to ticked</button>
          <span className="text-xs text-slate-400">(leave the name empty to remove)</span>
        </form>
        {coachNames.length > 0 && (
          <span className="ml-2 flex flex-wrap gap-1 text-xs">Filter: {coachNames.map((c) => <Link key={c} href={`/admin/products?${kind ? `kind=${kind}&` : ""}coach=${encodeURIComponent(c)}`} className={`rounded-full px-2 py-0.5 ring-1 ring-slate-200 ${coachFilter === c ? "bg-cosmic-600 text-white" : "bg-white"}`}>{c}</Link>)}
            {coachFilter && <Link href={`/admin/products${kind ? `?kind=${kind}` : ""}`} className="underline">clear</Link>}</span>
        )}
        {kind && products.length > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <form action={setKindCommission.bind(null, kind, true)}><ConfirmButton className="btn-secondary btn-sm" message={`Turn commission ON for all ${kind} products?`}>Commission on for all</ConfirmButton></form>
            <form action={setKindCommission.bind(null, kind, false)}><ConfirmButton className="btn-secondary btn-sm" message={`Turn commission OFF for all ${kind} products? Affiliates won't earn on them.`}>Commission off for all</ConfirmButton></form>
          </span>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th><input type="checkbox" disabled title="Tick rows below" /></th><th>Product</th><th>Type</th><th>Price</th><th>Sales</th><th>Affiliates earn</th><th>Settings</th></tr></thead>
          <tbody>{products.map((p) => {
            const e = earns(p);
            return (
              <tr key={p.id}>
                <td><input type="checkbox" name="ids" value={p.id} form="bulkcoach" /></td>
                <td>{p.permalink ? <a href={p.permalink} target="_blank" className="font-medium text-cosmic-700">{p.name}</a> : <span className="font-medium">{p.name}</span>}
                  <div className="text-xs text-slate-400">WC #{p.wcId}{p.wcType && p.wcType !== "simple" ? ` · ${p.wcType}` : ""}{p.status !== "publish" && ` · ${p.status}`}{p.categories.length ? ` · ${p.categories.join(", ")}` : ""} · added {date(p.createdAt)}</div></td>
                <td><Badge value={p.kind} />{p.coach && <div className="mt-1 text-xs text-slate-500">{p.coach}</div>}</td>
                <td>{money(p.price, s.currency)}</td>
                <td>{soldCount[p.wcId] || 0}</td>
                <td className={`whitespace-nowrap text-xs ${e.warn ? "font-medium text-amber-700" : ""}`}>{e.label}</td>
                <td>
                  <form action={updateProduct.bind(null, p.id)} className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="commissionEnabled" defaultChecked={p.commissionEnabled} /> Earns</label>
                    <select name="kind" defaultValue={p.kind} className="input w-24 py-1 text-xs"><option>course</option><option>ebook</option><option>coaching</option><option>event</option><option>membership</option><option>other</option></select>
                    <input name="coach" list="coaches" defaultValue={p.coach || ""} placeholder="Coach" className="input w-28 py-1 text-xs" />
                    <select name="rateType" defaultValue={p.rateType || ""} className="input w-24 py-1 text-xs"><option value="">No own rate</option><option value="PERCENTAGE">%</option><option value="FLAT">Flat $</option></select>
                    <input name="rate" type="number" step="0.01" min="0" defaultValue={p.rate != null ? Number(p.rate) : ""} className="input w-20 py-1 text-xs" />
                    <button className="btn-secondary btn-sm">Save</button>
                  </form>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
        {!products.length && <Empty>No products here.</Empty>}
      </div>
    </>
  );
}
