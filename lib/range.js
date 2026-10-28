// Date range from ?range=7|30|90|365|all or ?from=YYYY-MM-DD&to=YYYY-MM-DD
export const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "365", label: "12 months" },
  { key: "all", label: "All time" },
];

export function parseRange(sp = {}, fallback = "30") {
  if (sp.from || sp.to) {
    const from = sp.from ? new Date(sp.from) : new Date(0);
    const to = sp.to ? new Date(new Date(sp.to).getTime() + 864e5 - 1) : new Date();
    return { key: "custom", from, to, label: `${sp.from || "start"} to ${sp.to || "today"}` };
  }
  const key = RANGES.some((r) => r.key === sp.range) ? sp.range : fallback;
  if (key === "all") return { key, from: new Date(0), to: new Date(), label: "All time" };
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (Number(key) - 1));
  return { key, from, to: new Date(), label: RANGES.find((r) => r.key === key).label };
}

export function dateWhere(range) {
  return { createdAt: { gte: range.from, lte: range.to } };
}

// Bucket rows into days (<= 92 days) or months
export function series(rows, range, value = () => 1) {
  const days = Math.ceil((range.to - range.from) / 864e5);
  const monthly = days > 92;
  const start = range.key === "all" && rows.length ? new Date(Math.min(...rows.map((r) => +r.createdAt))) : range.from;
  const buckets = new Map();
  const key = (d) => (monthly ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10));
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  if (monthly) cur.setDate(1);
  while (cur <= range.to) {
    buckets.set(key(cur), 0);
    monthly ? cur.setMonth(cur.getMonth() + 1) : cur.setDate(cur.getDate() + 1);
  }
  for (const r of rows) {
    const k = key(new Date(r.createdAt));
    if (buckets.has(k)) buckets.set(k, buckets.get(k) + value(r));
  }
  return [...buckets].map(([label, v]) => ({ label, value: Math.round(v * 100) / 100 }));
}
