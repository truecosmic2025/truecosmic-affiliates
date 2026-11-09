"use client";
import { useMemo, useState } from "react";
import CopyField from "./CopyField";

const PER_PAGE = 12;

const KINDS = { all: "All", course: "Courses", ebook: "eBooks", coaching: "Coaching", event: "Events", membership: "Memberships", other: "Other" };

// Product picture from the Academy; a lettered tile when there's none or it fails to load
function Thumb({ src, name }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-20 w-20 shrink-0 rounded-xl bg-slate-100 object-cover ring-1 ring-slate-200" />;
  return <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cosmic-900 to-cosmic-500 text-2xl font-bold text-white" aria-hidden="true">{(name || "?").trim()[0]}</div>;
}

export default function LinkBuilder({ products, code, referralVar, shortBase, academyUrl, money }) {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const [campaign, setCampaign] = useState("");
  const [page, setPage] = useState(1);
  const make = (url) => {
    try {
      const u = new URL(url);
      u.searchParams.set(referralVar, code);
      if (campaign) u.searchParams.set("utm_campaign", campaign);
      return u.toString();
    } catch {
      return "";
    }
  };
  const list = useMemo(
    () => products.filter((p) => (kind === "all" || p.kind === kind) && `${p.name} ${p.summary || ""}`.toLowerCase().includes(q.toLowerCase())),
    [products, kind, q]
  );
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PER_PAGE;
  const shown = list.slice(start, start + PER_PAGE);
  const go = (n) => {
    setPage(n);
    document.getElementById("product-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // 1 … 4 5 6 … 31
  const pageNumbers = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - current) <= 1) pageNumbers.push(n);
    else if (pageNumbers[pageNumbers.length - 1] !== "…") pageNumbers.push("…");
  }
  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-5">
        <div><div className="section-title">Make a link to any page</div><p className="muted mt-0.5">Paste any truecosmic.com address and we&apos;ll add your code.</p></div>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={`Paste any page, e.g. ${academyUrl}`} className="input" />
        <input value={campaign} onChange={(e) => setCampaign(e.target.value.replace(/\s+/g, "-"))} placeholder="Campaign name (optional, e.g. instagram-bio)" className="input" />
        {custom && (make(custom) ? <CopyField value={make(custom)} qr /> : <p className="text-xs text-red-600">That doesn't look like a full URL (include https://)</p>)}
        <div className="text-xs text-slate-400">Short link: <span className="font-mono">{shortBase}/r/{code}</span> (add <span className="font-mono">?to=/academy/page/</span> to point it anywhere)</div>
      </div>
      <div id="product-list" className="flex scroll-mt-6 flex-wrap items-center gap-2">
        {Object.entries(KINDS).map(([k, label]) => (
          <button key={k} onClick={() => { setKind(k); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${kind === k ? "bg-cosmic-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-[#E4DFF0] hover:ring-cosmic-200"}`}>{label}</button>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search products" className="input ml-auto max-w-xs" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((p) => (
          <div key={p.id} className={`card space-y-3 p-5 ${p.byArrangement || p.capped ? "border-amber-200 bg-amber-50/40" : ""}`}>
            <div className="flex items-start gap-4">
              <Thumb src={p.image} name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap gap-1">
                  <span className="rounded-full bg-cosmic-50 px-2 py-0.5 text-xs capitalize text-cosmic-700">{p.kind}</span>
                  {p.byArrangement && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">By arrangement</span>}
                  {p.capped && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Higher rate by arrangement</span>}
                </div>
                <div className="font-medium leading-snug">{p.name}</div>
                {p.byArrangement
                  ? <div className="text-xs text-slate-500">{money[p.id]}</div>
                  : <div className="text-xs text-slate-500">{money[p.id]} · you earn <span className="font-semibold text-emerald-700">{p.earn}</span></div>}
                {p.summary && <p className="mt-1.5 line-clamp-2 text-sm text-slate-600" title={p.summary}>{p.summary}</p>}
              </div>
            </div>
            {p.capped && (
              <p className="rounded-lg bg-amber-100/60 px-3 py-2 text-xs text-amber-900">
                Coaching pays {p.cappedRate} as standard. Anything higher has to be agreed with us first: <a href="/dashboard/disputes" className="font-semibold underline">ask us</a>.
              </p>
            )}
            {p.byArrangement && (
              <p className="rounded-lg bg-amber-100/60 px-3 py-2 text-xs text-amber-900">
                No commission by default: it&apos;s agreed case by case. <a href="/dashboard/disputes" className="font-semibold underline">Ask us</a> before promoting it if you&apos;d like to earn on it.
              </p>
            )}
            {p.permalink ? <CopyField value={make(p.permalink)} qr /> : <p className="text-xs text-slate-400">No public page yet</p>}
          </div>
        ))}
      </div>
      {!list.length && <p className="text-center text-sm text-slate-400">No products match</p>}
      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Product pages">
          <p className="text-sm text-slate-500">Showing {start + 1}–{Math.min(start + PER_PAGE, list.length)} of {list.length}</p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" className="btn-secondary btn-sm" disabled={current === 1} onClick={() => go(current - 1)}>Previous</button>
            {pageNumbers.map((n, i) =>
              n === "…" ? <span key={`gap${i}`} className="px-1 text-sm text-slate-400">…</span> : (
                <button key={n} type="button" aria-current={n === current ? "page" : undefined} onClick={() => go(n)}
                  className={`min-w-[2rem] rounded-lg px-2 py-1 text-sm ${n === current ? "bg-cosmic-600 font-semibold text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{n}</button>
              )
            )}
            <button type="button" className="btn-secondary btn-sm" disabled={current === pages} onClick={() => go(current + 1)}>Next</button>
          </div>
        </nav>
      )}
    </div>
  );
}
