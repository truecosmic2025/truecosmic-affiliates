import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import RateFields from "@/components/RateFields";
import { saveCoachDeal, deleteCoachDeal, savePromotion, togglePromotion, deletePromotion, saveGroup, deleteGroup, saveCategoryRate, deleteCategoryRate, saveTier, deleteTier, saveBonus, toggleBonus } from "@/app/actions/admin";

export default async function Rules({ searchParams }) {
  const s = await getSettings();
  const m = (v) => money(v, s.currency);
  const rateLabel = (t, r) => (r == null ? "default" : t === "FLAT" ? m(r) : `${Number(r)}%`);
  const [deals, coachCounts] = await Promise.all([
    prisma.coachDeal.findMany({ orderBy: { coach: "asc" } }),
    prisma.product.groupBy({ by: ["coach"], where: { coach: { not: null }, deleted: false }, _count: true }),
  ]);
  const eventsFor = Object.fromEntries(coachCounts.map((c) => [c.coach.toLowerCase(), c._count]));
  const coachesWithoutDeal = coachCounts.filter((c) => !deals.some((d) => d.coach.toLowerCase() === c.coach.toLowerCase()));
  const [groups, cats, tiers, bonuses, products, promos, productList] = await Promise.all([
    prisma.affiliateGroup.findMany({ include: { _count: { select: { affiliates: true } } }, orderBy: { name: "asc" } }),
    prisma.categoryRate.findMany({ orderBy: { category: "asc" } }),
    prisma.rateTier.findMany({ orderBy: [{ metric: "asc" }, { threshold: "asc" }] }),
    prisma.bonus.findMany({ include: { _count: { select: { awards: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { deleted: false }, select: { categories: true } }),
    prisma.promotion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { deleted: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pName = Object.fromEntries(productList.map((p) => [p.id, p.name]));
  const gName = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const now = new Date();
  const promoState = (p) => (!p.active ? "paused" : p.startsAt && p.startsAt > now ? "scheduled" : p.endsAt && p.endsAt < now ? "ended" : "running");
  const allCats = [...new Set(products.flatMap((p) => p.categories))].sort();

  return (
    <>
      <PageHeader title="Commission rules" subtitle="Which rate applies: affiliate's product rate → running promotion → product rate → coach deal → category rate → affiliate rate → group rate → tier rate → lifetime/recurring rate → default" />
      <section id="coaches" className="card mb-6 scroll-mt-6">
        <div className="px-5 pt-5 font-medium">Coach deals (events)</div>
        <p className="muted px-5">The affiliate commission you've agreed with each coach, applied to all events assigned to them on the Products page. An individual event's own rate or a promotion overrides it. Events with no deal and no own rate pay affiliates nothing.</p>
        {searchParams?.saved === "coach" && <p className="mx-5 mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">Coach deal saved.</p>}
        {searchParams?.error === "coach" && <p className="mx-5 mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">A coach deal needs a coach name and a rate.</p>}
        <table className="table mt-3"><thead><tr><th>Coach</th><th>Affiliate commission</th><th>Products</th><th>Notes</th><th>Updated</th><th></th></tr></thead>
          <tbody>{deals.map((d) => (
            <tr key={d.id}><td className="font-medium"><a href={`/admin/products?coach=${encodeURIComponent(d.coach)}`} className="text-cosmic-700">{d.coach}</a></td><td>{rateLabel(d.rateType, d.rate)}{d.rateType === "FLAT" ? " per ticket" : ""}</td>
              <td>{eventsFor[d.coach.toLowerCase()] || 0}</td><td className="max-w-xs text-xs text-slate-500">{d.notes}</td><td className="whitespace-nowrap text-xs">{date(d.updatedAt)}</td>
              <td><form action={deleteCoachDeal.bind(null, d.id)}><button className="btn-danger btn-sm">Delete</button></form></td></tr>
          ))}</tbody>
        </table>
        {!deals.length && <Empty>No coach deals yet</Empty>}
        {coachesWithoutDeal.length > 0 && <p className="px-5 pt-2 text-xs text-amber-700">No deal yet for: {coachesWithoutDeal.map((c) => `${c.coach} (${c._count})`).join(", ")}</p>}
        <form action={saveCoachDeal} className="grid gap-3 border-t border-slate-100 p-5 md:grid-cols-2">
          <input name="coach" required list="coach-names" placeholder="Coach name (same spelling as on Products)" className="input" />
          <datalist id="coach-names">{coachCounts.map((c) => <option key={c.coach} value={c.coach} />)}</datalist>
          <RateFields hint="Percentage of the ticket price, or a flat amount per ticket" />
          <input name="notes" placeholder="Notes, e.g. agreed by email 28 Oct, London retreat only" className="input md:col-span-2" />
          <div className="md:col-span-2"><button className="btn-primary">Save coach deal</button> <span className="text-xs text-slate-400">Saving a coach that already has a deal updates it.</span></div>
        </form>
      </section>
      {searchParams?.error === "promo" && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">A promotion needs a rate.</p>}
      <section className="card mb-6">
        <div className="px-5 pt-5 font-medium">Promotions</div>
        <p className="muted px-5">Set the rate for a particular campaign, e.g. 10% on coaching packages, or 50% on a course launch week. While a promotion runs it overrides product, category and affiliate rates (but not a deal set for one affiliate on one product).</p>
        <table className="table mt-3"><thead><tr><th>Promotion</th><th>Rate</th><th>Applies to</th><th>Affiliates</th><th>Dates</th><th>Status</th><th></th></tr></thead>
          <tbody>{promos.map((p) => (
            <tr key={p.id}><td className="font-medium">{p.name}</td><td>{rateLabel(p.rateType, p.rate)}</td>
              <td className="text-xs">{[...p.productIds.map((id) => pName[id] || "deleted product"), ...p.categories].join(", ") || "Whole store"}</td>
              <td className="text-xs">{p.groupIds.length ? p.groupIds.map((id) => gName[id] || "?").join(", ") : "Everyone"}</td>
              <td className="whitespace-nowrap text-xs">{p.startsAt ? date(p.startsAt) : "now"} → {p.endsAt ? date(p.endsAt) : "no end"}</td>
              <td className="text-xs">{promoState(p)}</td>
              <td className="flex gap-1"><form action={togglePromotion.bind(null, p.id, !p.active)}><button className="btn-secondary btn-sm">{p.active ? "Pause" : "Resume"}</button></form>
                <form action={deletePromotion.bind(null, p.id)}><button className="btn-danger btn-sm">Delete</button></form></td></tr>
          ))}</tbody>
        </table>
        {!promos.length && <Empty>No promotions</Empty>}
        <form action={savePromotion} className="grid gap-3 border-t border-slate-100 p-5 md:grid-cols-2">
          <input name="name" required placeholder="Name, e.g. Coaching packages" className="input" />
          <RateFields hint="The rate while the promotion runs" />
          <div><label className="label">Products (optional)</label><select name="productIds" multiple size={5} className="input">{productList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label">Categories (optional)</label><select name="categories" multiple size={5} className="input">{allCats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <p className="mt-1 text-xs text-slate-400">Pick neither for the whole store. Ctrl/⌘-click to pick several.</p></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label">Starts</label><input name="startsAt" type="date" className="input" /></div><div><label className="label">Ends</label><input name="endsAt" type="date" className="input" /></div></div>
          {groups.length > 0 && <div><label className="label">Only for groups (optional)</label><div className="flex flex-wrap gap-3 text-sm">{groups.map((g) => <label key={g.id} className="flex items-center gap-1"><input type="checkbox" name="groupIds" value={g.id} /> {g.name}</label>)}</div></div>}
          <div className="md:col-span-2"><button className="btn-primary">Add promotion</button></div>
        </form>
      </section>
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
          <p className="muted px-5">e.g. 30% on all Courses, $20 flat on Coaching. Flat amounts are in the commission currency.</p>
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
            <select name="metric" className="input"><option value="signup">Welcome bonus (on approval)</option><option value="referrals">After N sales</option><option value="earnings">After earning a set amount</option></select>
            <input name="threshold" type="number" step="0.01" min="0" placeholder="Threshold (not needed for welcome)" className="input" />
            <input name="amount" type="number" step="0.01" min="0" required placeholder="Bonus amount" className="input" />
            <button className="btn-primary">Add bonus</button>
          </form>
        </section>
      </div>
    </>
  );
}
