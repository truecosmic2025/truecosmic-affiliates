import { prisma, logEvent } from "./db";
import { convert } from "./fx-math.mjs";

// Daily reference rates from the European Central Bank via Frankfurter (free, no key).
// Weekends and holidays resolve to the previous business day's published rate.
// FX_API_URL lets tests point at a fake server.
const PROVIDERS = [
  (base, quote, day) => ({ url: `${process.env.FX_API_URL || "https://api.frankfurter.app"}/${day}?from=${base}&to=${quote}`, source: "ECB via frankfurter.app" }),
  (base, quote, day) => ({ url: `https://api.frankfurter.dev/v1/${day}?base=${base}&symbols=${quote}`, source: "ECB via frankfurter.dev" }),
];

export function dayOf(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export { convert };

// Loads a whole date range in one request per year (Frankfurter time series) and stores a rate for every
// calendar day, so importing years of history doesn't make one request per referral date.
export async function prefetchRates(base, quote, from, to) {
  base = base.toUpperCase();
  quote = quote.toUpperCase();
  if (base === quote) return 0;
  let stored = 0;
  const end = new Date(Math.min(new Date(to).getTime(), Date.now()));
  let start = new Date(from);
  start.setUTCDate(start.getUTCDate() - 7); // so the first days of the range have an earlier published rate
  while (start <= end) {
    const chunkEnd = new Date(Math.min(start.getTime() + 365 * 864e5, end.getTime()));
    const url = `${process.env.FX_API_URL || "https://api.frankfurter.app"}/${dayOf(start)}..${dayOf(chunkEnd)}?from=${base}&to=${quote}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const published = Object.entries((await res.json()).rates || {}).map(([d, r]) => [d, Number(r[quote])]).filter(([, r]) => r).sort();
      const rows = [];
      let i = 0;
      for (let d = new Date(start); d <= chunkEnd; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = dayOf(d);
        while (i + 1 < published.length && published[i + 1][0] <= day) i++;
        if (published[i] && published[i][0] <= day) rows.push({ base, quote, day, rateDate: published[i][0], rate: published[i][1], source: "ECB via frankfurter.app" });
      }
      const r = await prisma.fxRate.createMany({ data: rows, skipDuplicates: true });
      stored += r.count;
    } catch (e) {
      await logEvent("fx", "error", `prefetch ${base}->${quote} ${dayOf(start)}..${dayOf(chunkEnd)}: ${e.message}`);
    }
    start = new Date(chunkEnd.getTime() + 864e5);
  }
  return stored;
}

// Returns { rate, rateDate, source } for converting `base` into `quote` on `date`.
// Each requested day is fetched once and stored, so a commission's rate never changes afterwards.
export async function getRate(base, quote, date = new Date(), { fallbackRate } = {}) {
  base = base.toUpperCase();
  quote = quote.toUpperCase();
  if (base === quote) return { rate: 1, rateDate: dayOf(date), source: "same currency" };
  let day = dayOf(date);
  if (day > dayOf(new Date())) day = dayOf(new Date());

  const cached = await prisma.fxRate.findUnique({ where: { base_quote_day: { base, quote, day } } });
  if (cached) return { rate: Number(cached.rate), rateDate: cached.rateDate, source: cached.source };

  for (const provider of PROVIDERS) {
    const { url, source } = provider(base, quote, day);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rate = Number(json?.rates?.[quote]);
      if (!rate || !Number.isFinite(rate)) throw new Error("no rate in response");
      const row = await prisma.fxRate.upsert({
        where: { base_quote_day: { base, quote, day } },
        create: { base, quote, day, rateDate: json.date || day, rate, source },
        update: {},
      });
      return { rate: Number(row.rate), rateDate: row.rateDate, source: row.source };
    } catch (e) {
      await logEvent("fx", "error", `${base}->${quote} ${day} from ${url}: ${e.message}`);
    }
  }

  // Providers unreachable: use the closest earlier stored rate, then the admin's fallback rate.
  // These are not cached for the day, so the next sale tries the live source again.
  const earlier = await prisma.fxRate.findFirst({ where: { base, quote, day: { lte: day } }, orderBy: { day: "desc" } });
  if (earlier) {
    await logEvent("fx", "skipped", `${base}->${quote} ${day}: using stored rate from ${earlier.rateDate}`);
    return { rate: Number(earlier.rate), rateDate: earlier.rateDate, source: `${earlier.source} (stored, provider unavailable)` };
  }
  if (fallbackRate) {
    await logEvent("fx", "skipped", `${base}->${quote} ${day}: using fallback rate ${fallbackRate} from Settings`);
    return { rate: Number(fallbackRate), rateDate: day, source: "fallback rate from Settings (provider unavailable)" };
  }
  throw new Error(`No ${base}->${quote} exchange rate available for ${day}`);
}
