// Pure commission maths, kept free of DB access so it is easy to test.
//
// Rate precedence (first match wins), mirroring AffiliateWP:
//   affiliate+product rate -> running promotion -> product rate -> coach deal (events)  -> product category rate -> affiliate rate -> group rate
//   -> tiered rate (by lifetime performance) -> lifetime/recurring rate (when applicable) -> global default

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const set = (type, rate) => type && rate != null && rate !== "" && !Number.isNaN(Number(rate));

export function tierRate(tiers = [], stats = {}) {
  // Highest threshold reached wins, per metric
  let best = null;
  for (const t of tiers) {
    const value = t.metric === "referrals" ? stats.referrals || 0 : stats.earnings || 0;
    if (value >= Number(t.threshold) && (!best || Number(t.threshold) >= Number(best.threshold))) best = t;
  }
  return best ? { type: best.rateType, rate: Number(best.rate), via: "tier" } : null;
}

// Most specific running promotion for a product: product-level, then category, then store-wide.
// ctx.promotions must already be filtered to ones that are active, in date and open to this affiliate.
export function promotionFor(product, promotions = []) {
  const cats = (product?.categories || []).map((c) => c.toLowerCase());
  const byProduct = product && promotions.find((p) => p.productIds?.includes(product.id));
  if (byProduct) return byProduct;
  const byCat = promotions.find((p) => p.categories?.some((c) => cats.includes(c.toLowerCase())));
  if (byCat) return byCat;
  return promotions.find((p) => !p.productIds?.length && !p.categories?.length) || null;
}

// Events pay only once a rate has been agreed for them (their own rate, a coach deal, a promotion or a category rate),
// never the general default, affiliate or tier rate. Controlled by settings.eventsNeedAgreedRate.
const AGREED = ["affiliate-product", "promotion", "product", "coach", "category"];
export function hasAgreedRate(product, via, settings) {
  return !(product?.kind === "event" && settings.eventsNeedAgreedRate !== false && !AGREED.includes(via));
}

export function promotionRunning(p, affiliate, now = new Date()) {
  return p.active && (!p.startsAt || new Date(p.startsAt) <= now) && (!p.endsAt || new Date(p.endsAt) >= now) && (!p.groupIds?.length || p.groupIds.includes(affiliate?.groupId));
}

export function rateFor({ product, affiliate, settings, ctx = {} }) {
  const apr = ctx.affiliateProductRates?.[product?.id];
  if (apr) return { type: apr.rateType, rate: Number(apr.rate), via: "affiliate-product" };
  const promo = promotionFor(product, ctx.promotions);
  if (promo) return { type: promo.rateType, rate: Number(promo.rate), via: "promotion", promotion: promo.name };
  if (set(product?.rateType, product?.rate)) return { type: product.rateType, rate: Number(product.rate), via: "product" };
  const deal = product?.coach && ctx.coachDeals?.[product.coach.toLowerCase()];
  if (deal) return { type: deal.rateType, rate: Number(deal.rate), via: "coach", coach: deal.coach };
  for (const c of product?.categories || []) {
    const cr = ctx.categoryRates?.[c.toLowerCase()];
    if (cr) return { type: cr.rateType, rate: Number(cr.rate), via: "category" };
  }
  if (set(affiliate?.rateType, affiliate?.rate)) return { type: affiliate.rateType, rate: Number(affiliate.rate), via: "affiliate" };
  if (set(ctx.group?.rateType, ctx.group?.rate)) return { type: ctx.group.rateType, rate: Number(ctx.group.rate), via: "group" };
  const tier = tierRate(ctx.tiers, ctx.stats);
  if (tier) return tier;
  if (ctx.kind === "lifetime" && set(settings.lifetimeRateType, settings.lifetimeRate)) return { type: settings.lifetimeRateType, rate: Number(settings.lifetimeRate), via: "lifetime" };
  if (ctx.kind === "recurring" && set(settings.recurringRateType, settings.recurringRate)) return { type: settings.recurringRateType, rate: Number(settings.recurringRate), via: "recurring" };
  return { type: settings.defaultRateType, rate: Number(settings.defaultRate), via: "default" };
}

// items: [{ productId (wc id), name, quantity, total }] where total is the line total paid after discounts, excl. tax
// order extras (optional): { shipping, tax } added to the base when settings.includeShipping / includeTax are on
export function calculateCommission({ items, productsByWcId, affiliate, settings, ctx = {}, order = {} }) {
  let amount = 0;
  let base = 0;
  const lines = [];
  let flatOrderRate = null;
  for (const item of items) {
    const product = productsByWcId[item.productId];
    if (product && !product.commissionEnabled) {
      lines.push({ ...item, commission: 0, note: "commission disabled" });
      continue;
    }
    if (!product && !settings.newProductsEarnCommission) {
      lines.push({ ...item, commission: 0, note: "unknown product" });
      continue;
    }
    const { type, rate, via, promotion } = rateFor({ product, affiliate, settings, ctx });
    if (!hasAgreedRate(product, via, settings)) {
      lines.push({ ...item, commission: 0, note: "event: no rate agreed yet" });
      continue;
    }
    const qty = Number(item.quantity || 1);
    const total = Number(item.total || 0);
    base += total;
    let commission;
    if (type === "FLAT") {
      if (settings.flatRateBasis === "order") {
        // One flat amount per order: take the highest applicable flat rate once
        flatOrderRate = Math.max(flatOrderRate ?? 0, rate);
        commission = 0;
      } else commission = rate * qty;
    } else commission = (total * rate) / 100;
    amount += commission;
    lines.push({ ...item, commission: round2(commission), rateType: type, rate, via, ...(promotion ? { promotion } : {}) });
  }
  if (flatOrderRate != null) amount += flatOrderRate;
  // Shipping / tax are paid at the default-or-affiliate percentage when included
  const extras = (settings.includeShipping ? Number(order.shipping || 0) : 0) + (settings.includeTax ? Number(order.tax || 0) : 0);
  if (extras > 0) {
    const { type, rate } = rateFor({ product: null, affiliate, settings, ctx });
    if (type === "PERCENTAGE") amount += (extras * rate) / 100;
    base += extras;
  }
  return { amount: round2(Math.max(0, amount)), base: round2(base), lines };
}

// Upline commissions for multi-tier programmes: % of the order base per level
export function tierCommissions(base, tierRates = []) {
  return tierRates.map((rate, i) => ({ level: i + 1, amount: round2((Number(base) * Number(rate)) / 100) })).filter((t) => t.amount > 0);
}

export function productKind(categories = [], name = "", type = "") {
  if (/ticket|event/i.test(type || "")) return "event";
  if (/membership|subscription/i.test(type || "")) return "membership";
  const hay = [...categories, name].join(" ").toLowerCase();
  if (/\bevent|ticket|retreat|workshop|summit|live\b/.test(hay)) return "event";
  if (/coach|mentor|session|1[- ]?(on|to)[- ]?1|consult/.test(hay)) return "coaching";
  if (/e-?book|pdf|guide|book/.test(hay)) return "ebook";
  if (/course|class|program|masterclass|academy|lesson/.test(hay)) return "course";
  return "other";
}
