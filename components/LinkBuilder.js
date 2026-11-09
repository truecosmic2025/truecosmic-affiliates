"use client";
import { useMemo, useState } from "react";
import CopyField from "./CopyField";

const KIND_TONE = {
  course: "bg-violet-50 text-violet-700",
  ebook: "bg-sky-50 text-sky-700",
  coaching: "bg-pink-50 text-pink-700",
  event: "bg-amber-50 text-amber-800",
  membership: "bg-teal-50 text-teal-700",
  other: "bg-slate-100 text-slate-600",
};

const KINDS = { all: "All", course: "Courses", ebook: "eBooks", coaching: "Coaching", event: "Events", membership: "Memberships", other: "Other" };

export default function LinkBuilder({ products, code, referralVar, shortBase, academyUrl, money }) {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const [campaign, setCampaign] = useState("");
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
    () => products.filter((p) => (kind === "all" || p.kind === kind) && p.name.toLowerCase().includes(q.toLowerCase())),
    [products, kind, q]
  );
  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-5">
        <div><div className="section-title">Make a link to any page</div><p className="muted mt-0.5">Paste any truecosmic.com address and we&apos;ll add your code.</p></div>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={`Paste any page, e.g. ${academyUrl}`} className="input" />
        <input value={campaign} onChange={(e) => setCampaign(e.target.value.replace(/\s+/g, "-"))} placeholder="Campaign name (optional, e.g. instagram-bio)" className="input" />
        {custom && (make(custom) ? <CopyField value={make(custom)} qr /> : <p className="text-xs text-red-600">That doesn't look like a full URL (include https://)</p>)}
        <div className="text-xs text-slate-400">Short link: <span className="font-mono">{shortBase}/r/{code}</span> (add <span className="font-mono">?to=/academy/page/</span> to point it anywhere)</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(KINDS).map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${kind === k ? "bg-cosmic-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-[#E4DFF0] hover:ring-cosmic-200"}`}>{label}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="input ml-auto max-w-xs" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => (
          <div key={p.id} className="card flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${KIND_TONE[p.kind] || KIND_TONE.other}`}>{p.kind}</span>
                <div className="font-semibold leading-snug text-slate-900">{p.name}</div>
                <div className="mt-0.5 text-sm text-slate-500">Price {money[p.id]}</div>
              </div>
              <div className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-right ring-1 ring-emerald-100">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">You earn</div>
                <div className="text-sm font-bold text-emerald-800">{p.earn}</div>
              </div>
            </div>
            <div className="mt-auto">{p.permalink ? <CopyField value={make(p.permalink)} qr /> : <p className="text-xs text-slate-400">No public page yet</p>}</div>
          </div>
        ))}
      </div>
      {!list.length && <p className="text-center text-sm text-slate-400">No products match</p>}
    </div>
  );
}
