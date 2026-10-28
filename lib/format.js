export function money(v, currency = "GBP") {
  const n = Number(v || 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
}

export function date(d) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export function fullName(a) {
  return [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email;
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function affiliateLink(settings, affiliate, path) {
  const base = path || settings.academyUrl;
  const u = new URL(base);
  u.searchParams.set(settings.referralVar, affiliate.code);
  return u.toString();
}
