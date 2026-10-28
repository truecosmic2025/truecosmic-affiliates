"use client";
import { useState } from "react";

export default function PayoutMethodForm({ action, methods, current }) {
  const [method, setMethod] = useState(current.method);
  const m = methods[method];
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="method" value={method} />
      <div className="flex flex-wrap gap-2">
        {Object.entries(methods).map(([k, v]) => (
          <button type="button" key={k} onClick={() => setMethod(k)}
            className={`rounded-lg px-4 py-2 text-sm ring-1 ${method === k ? "bg-cosmic-600 text-white ring-cosmic-600" : "bg-white text-slate-700 ring-slate-300"}`}>
            {v.label}
          </button>
        ))}
      </div>
      {m.fields.map((f) => {
        const name = `${method}.${f.key}`;
        const dv = current.method === method ? current.details?.[f.key] ?? "" : f.options ? f.options[0] : "";
        return (
          <div key={name}>
            <label className="label">{f.label}</label>
            {f.options ? (
              <select name={name} defaultValue={dv} className="input">{f.options.map((o) => <option key={o}>{o}</option>)}</select>
            ) : f.textarea ? (
              <textarea name={name} defaultValue={dv} rows={3} required={f.required} className="input" />
            ) : (
              <input name={name} type={f.type || "text"} defaultValue={dv} required={f.required} className="input" />
            )}
          </div>
        );
      })}
      {method === "wise" && <p className="text-xs text-slate-400">We send Wise payouts to your Wise account email in a monthly batch.</p>}
      <button className="btn-primary">Save payout details</button>
      <p className="text-xs text-slate-400">For your security we'll email you a link to confirm the change before it's used.</p>
    </form>
  );
}
