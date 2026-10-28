// Pure commission maths, kept free of DB access so it is easy to test.
// Precedence: product override -> affiliate override -> global default.

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function rateFor({ product, affiliate, settings }) {
  if (product?.rateType && product?.rate != null) return { type: product.rateType, rate: Number(product.rate) };
  if (affiliate?.rateType && affiliate?.rate != null) return { type: affiliate.rateType, rate: Number(affiliate.rate) };
  return { type: settings.defaultRateType, rate: Number(settings.defaultRate) };
}

// items: [{ productId (wc id), name, quantity, total }] where total is the line total paid after discounts, excl. tax
export function calculateCommission({ items, productsByWcId, affiliate, settings }) {
  let amount = 0;
  const lines = [];
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
    const { type, rate } = rateFor({ product, affiliate, settings });
    const qty = Number(item.quantity || 1);
    const commission = type === "FLAT" ? rate * qty : (Number(item.total || 0) * rate) / 100;
    amount += commission;
    lines.push({ ...item, commission: round2(commission), rateType: type, rate });
  }
  return { amount: round2(Math.max(0, amount)), lines };
}

export function productKind(categories = [], name = "") {
  const hay = [...categories, name].join(" ").toLowerCase();
  if (/coach|mentor|session|1[- ]?(on|to)[- ]?1|consult/.test(hay)) return "coaching";
  if (/e-?book|pdf|guide|book/.test(hay)) return "ebook";
  if (/course|class|program|masterclass|academy|lesson/.test(hay)) return "course";
  return "other";
}
