import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { PageHeader, Badge, Tabs, Empty } from "@/components/ui";
import { updateProduct, requestProductSync, setKindCommission } from "@/app/actions/admin";
import ConfirmButton from "@/components/ConfirmButton";

export default async function Products({ searchParams }) {
  const s = await getSettings();
  const kind = searchParams.kind;
  const products = await prisma.product.findMany({ where: { deleted: false, ...(kind ? { kind } : {}) }, orderBy: { createdAt: "desc" } });
  const sales = await prisma.referral.findMany({ where: { status: { in: ["UNPAID", "PAID"] }, source: { not: "import" } }, select: { items: true } });
  const soldCount = {};
  for (const r of sales) for (const i of Array.isArray(r.items) ? r.items : []) soldCount[i.productId] = (soldCount[i.productId] || 0) + Number(i.quantity || 1);
  const def = s.defaultRateType === "FLAT" ? money(s.defaultRate, s.currency) : `${s.defaultRate}%`;

  return (
    <>
      <PageHeader title="Products" subtitle={`Synced automatically from WooCommerce. New products ${s.newProductsEarnCommission ? "earn" : "do not earn"} commission (${def}) unless changed here.`}>
        <form action={requestProductSync}><button className="btn-secondary">Re-sync all from WooCommerce</button></form>
      </PageHeader>
      {searchParams.synced && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">WordPress sent {searchParams.synced} products.</p>}
      {searchParams.syncError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Couldn't reach the WordPress connector. Check WP_SITE_URL and the shared secret (see Activity log).</p>}
      <Tabs active={kind || "all"} items={[{ key: "all", label: "All", href: "/admin/products" }, ...["course", "ebook", "coaching", "event", "other"].map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), href: `/admin/products?kind=${k}` }))]} />
      {searchParams.bulk && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Updated {searchParams.bulk} products.</p>}
      {kind && products.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">All {products.length} {kind} products ({products.filter((p) => p.commissionEnabled).length} earning commission):</span>
          <form action={setKindCommission.bind(null, kind, true)}><ConfirmButton className="btn-secondary btn-sm" message={`Turn commission ON for all ${products.length} ${kind} products?`}>Commission on for all</ConfirmButton></form>
          <form action={setKindCommission.bind(null, kind, false)}><ConfirmButton className="btn-secondary btn-sm" message={`Turn commission OFF for all ${products.length} ${kind} products? Affiliates won't earn on them.`}>Commission off for all</ConfirmButton></form>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Product</th><th>Type</th><th>Price</th><th>Affiliate sales</th><th>Added</th><th>Commission settings</th></tr></thead>
          <tbody>{products.map((p) => (
            <tr key={p.id}>
              <td>{p.permalink ? <a href={p.permalink} target="_blank" className="font-medium text-cosmic-700">{p.name}</a> : <span className="font-medium">{p.name}</span>}
                <div className="text-xs text-slate-400">WC #{p.wcId}{p.status !== "publish" && ` · ${p.status}`}{p.categories.length ? ` · ${p.categories.join(", ")}` : ""}</div></td>
              <td><Badge value={p.kind} /></td>
              <td>{money(p.price, s.currency)}</td>
              <td>{soldCount[p.wcId] || 0}</td>
              <td className="whitespace-nowrap">{date(p.createdAt)}</td>
              <td>
                <form action={updateProduct.bind(null, p.id)} className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="commissionEnabled" defaultChecked={p.commissionEnabled} /> Earns</label>
                  <select name="kind" defaultValue={p.kind} className="input w-28 py-1 text-xs"><option>course</option><option>ebook</option><option>coaching</option><option>event</option><option>other</option></select>
                  <select name="rateType" defaultValue={p.rateType || ""} className="input w-28 py-1 text-xs"><option value="">Default</option><option value="PERCENTAGE">%</option><option value="FLAT">Flat</option></select>
                  <input name="rate" type="number" step="0.01" min="0" defaultValue={p.rate != null ? Number(p.rate) : ""} placeholder={def} className="input w-20 py-1 text-xs" />
                  <button className="btn-secondary btn-sm">Save</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!products.length && <Empty>No products yet. Install the WordPress connector plugin and click “Sync all products” in WordPress.</Empty>}
      </div>
    </>
  );
}
