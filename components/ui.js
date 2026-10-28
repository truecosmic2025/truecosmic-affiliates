import Link from "next/link";

const BADGE = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  UNPAID: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-sky-50 text-sky-700 ring-sky-200",
  PROCESSING: "bg-sky-50 text-sky-700 ring-sky-200",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  error: "bg-red-50 text-red-700 ring-red-200",
  skipped: "bg-slate-100 text-slate-600 ring-slate-200",
  course: "bg-violet-50 text-violet-700 ring-violet-200",
  ebook: "bg-sky-50 text-sky-700 ring-sky-200",
  coaching: "bg-pink-50 text-pink-700 ring-pink-200",
  event: "bg-amber-50 text-amber-700 ring-amber-200",
  other: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ value }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[value] || BADGE.other}`}>
      {String(value).toLowerCase()}
    </span>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="card p-5">
      <div className="muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}

export function Tabs({ items, active }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${active === t.key ? "border-cosmic-600 font-medium text-cosmic-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// Tiny dependency-free bar chart: data = [{ label, value }]
export function BarChart({ data, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => (
        <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
          <div className="rounded-t bg-cosmic-500/80 group-hover:bg-cosmic-600" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }} />
          <div className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {d.label}: {format(d.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
