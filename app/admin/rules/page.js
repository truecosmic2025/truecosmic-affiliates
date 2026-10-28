import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import RateFields from "@/components/RateFields";
import { saveGroup, deleteGroup, saveCategoryRate, deleteCategoryRate, saveTier, deleteTier, saveBonus, toggleBonus } from "@/app/actions/admin";

export default async function Rules() {
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  const rateLabel = (t, r) => (r == null ? "default" : t === "FLAT" ? m(r) : `${Number(r)}%`);
  const [groups, cats, tiers, bonuses, products] = await Promise.all([
    prisma.affiliateGroup.findMany({ include: { _count: { select: { affiliates: true } } }, orderBy: { name: "asc" } }),
    prisma.categoryRate.findMany({ orderBy: { category: "asc" } }),
    prisma.rateTier.findMany({ orderBy: [{ metric: "asc" }, { threshold: "asc" }] }),
    prisma.bonus.findMany({ include: { _count: { select: { awards: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { deleted: false }, select: { categories: true } }),
  ]);
  const allCats = [...new Set(products.flatMap((p) => p.categories))].sort();

  return (
    <>
      <PageHeader title="Commission rules" subtitle="Which rate applies: affiliate's product rate → product rate → category rate → affiliate rate → group rate → tier rate → lifetime/recurring rate → default" />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="px-5 pt-5 font-medium">Affiliate groups</div>
          <p className="muted px-5">Give a set of affiliates (e.g. VIP partners, students) their own rate. Creatives can be limited to groups.</p>
          <table className="table mt-3"><thead><tr><th>Group</th><th>Rate</th><th>Affiliates</th><th></th></tr></thead>
            <tbody>{groups.map((g) => (
              <tr key={g.id}><td>{g.name}{g.isDefault && <span className="ml-2 text-xs text-cosmic-600">default for new sign-ups</span>}</td><td>{rateLabel(g.rateType, g.rate)}</td><td>{g._count.affiliates}</td>
                <td><form action={deleteGroup.bind(null, g.id)}><button className="btn-danger btn-sm">Delete</button></form></td></tr>
            ))}</tbody>
          </table>
          {!groups.length && <Empty>No groups yet</Empty>}
          <form action={saveGroup} className="space-y-3 border-t border-slate-100 p-5">
            <input name="name" required placeholder="Group name" className="input" />
            <RateFields hint="Leave blank to use the default rate" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" /> Put new affiliates in this group</label>
            <button className="btn-primary">Add group</button>
          </form>
        </section>

        <section className="card">
          <div className="px-5 pt-5 font-medium">Product category rates</div>
          <p className="muted px-5">e.g. 30% on all Courses, £20 flat on Coaching.</p>
          <table className="table mt-3"><thead><tr><th>Category</th><th>Rate</th><th></th></tr></thead>
            <tbody>{cats.map((c) => (
              <tr key={c.id}><td>{c.category}</td><td>{rateLabel(c.rateType, c.rate)}</td><td><form action={deleteCategoryRate.bind(null, c.id)}><button className="btn-danger btn-sm">Remove</button></form></td></tr>
            ))}</tbody>
          </table>
          {!cats.length && <Empty>No category rates</Empty>}
          <form action={saveCategoryRate} className="space-y-3 border-t border-slate-100 p-5">
            <input name="category" list="cats" required placeholder="WooCommerce category name" className="input" />
            <datalist id="cats">{allCats.map((c) => <option key={c} value={c} />)}</datalist>
            <RateFields hint="Required" />
            <button className="btn-primary">Save category rate</button>
          </form>
        </section>

        <section className="card">
          <div className="px-5 pt-5 font-medium">Tiered rates</div>
          <p className="muted px-5">Reward top performers automatically: the rate goes up once an affiliate passes a lifetime earnings or sales threshold. Applies to affiliates without their own custom rate.</p>
          <table className="table mt-3"><thead><tr><th>When lifetime…</th><th>reaches</th><th>Rate</th><th></th></tr></thead>
            <tbody>{tiers.map((t) => (
              <tr key={t.id}><td>{t.metric === "referrals" ? "sales" : "earnings"}</td><td>{t.metric === "referrals" ? Number(t.threshold) : m(t.threshold)}</td><td>{rateLabel(t.rateType, t.rate)}</td>
                <td><form action={deleteTier.bind(null, t.id)}><button className="btn-danger btn-sm">Remove</button></form></td></tr>
            ))}</tbody>
          </table>
          {!tiers.length && <Empty>No tiers</Empty>}
          <form action={saveTier} className="space-y-3 border-t border-slate-100 p-5">
            <div className="grid grid-cols-2 gap-2">
              <select name="metric" className="input"><option value="referrals">Number of sales</option><option value="earnings">Total earnings</option></select>
              <input name="threshold" type="number" step="0.01" min="0" required placeholder="Threshold, e.g. 50" className="input" />
            </div>
            <RateFields hint="Rate once reached" />
            <button className="btn-primary">Add tier</button>
          </form>
        </section>

        <section className="card">
          <div className="px-5 pt-5 font-medium">Bonuses</div>
          <p className="muted px-5">One-off bonuses, paid once per affiliate: a welcome bonus on approval, or a reward for hitting a milestone.</p>
          <table className="table mt-3"><thead><tr><th>Bonus</th><th>Trigger</th><th>Amount</th><th>Awarded</th><th></th></tr></thead>
            <tbody>{bonuses.map((b) => (
              <tr key={b.id} className={b.active ? "" : "opacity-50"}><td>{b.name}</td>
                <td>{b.metric === "signup" ? "on approval" : b.metric === "referrals" ? `${Number(b.threshold)} sales` : `${m(b.threshold)} earned`}</td>
                <td>{m(b.amount)}</td><td>{b._count.awards}</td>
                <td><form action={toggleBonus.bind(null, b.id, !b.active)}><button className="btn-secondary btn-sm">{b.active ? "Pause" : "Resume"}</button></form></td></tr>
            ))}</tbody>
          </table>
          {!bonuses.length && <Empty>No bonuses</Empty>}
          <form action={saveBonus} className="grid gap-2 border-t border-slate-100 p-5 sm:grid-cols-2">
            <input name="name" required placeholder="Name, e.g. First 10 sales" className="input sm:col-span-2" />
            <select name="metric" className="input"><option value="signup">Welcome bonus (on approval)</option><option value="referrals">After N sales</option><option value="earnings">After earning £X</option></select>
            <input name="threshold" type="number" step="0.01" min="0" placeholder="Threshold (not needed for welcome)" className="input" />
            <input name="amount" type="number" step="0.01" min="0" required placeholder="Bonus amount" className="input" />
            <button className="btn-primary">Add bonus</button>
          </form>
        </section>
      </div>
    </>
  );
}
