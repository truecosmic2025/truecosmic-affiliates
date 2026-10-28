"use client";
import { useMemo, useState } from "react";
import CopyField from "./CopyField";

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
        <div className="font-medium">Make a link to any page</div>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={`Paste any page, e.g. ${academyUrl}`} className="input" />
        <input value={campaign} onChange={(e) => setCampaign(e.target.value.replace(/\s+/g, "-"))} placeholder="Campaign name (optional, e.g. instagram-bio)" className="input" />
        {custom && (make(custom) ? <CopyField value={make(custom)} qr /> : <p className="text-xs text-red-600">That doesn't look like a full URL (include https://)</p>)}
        <div className="text-xs text-slate-400">Short link: <span className="font-mono">{shortBase}/r/{code}</span> (add <span className="font-mono">?to=/academy/page/</span> to point it anywhere)</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(KINDS).map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-sm ${kind === k ? "bg-cosmic-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{label}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="input ml-auto max-w-xs" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => (
          <div key={p.id} className="card space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-medium">{p.name}</div><div className="text-xs text-slate-400">{money[p.id]} · you earn {p.earn}</div></div>
              <span className="rounded-full bg-cosmic-50 px-2 py-0.5 text-xs capitalize text-cosmic-700">{p.kind}</span>
            </div>
            {p.permalink ? <CopyField value={make(p.permalink)} qr /> : <p className="text-xs text-slate-400">No public page yet</p>}
          </div>
        ))}
      </div>
      {!list.length && <p className="text-center text-sm text-slate-400">No products match</p>}
    </div>
  );
}
