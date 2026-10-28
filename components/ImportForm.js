"use client";
import { useFormState, useFormStatus } from "react-dom";
import { runImport } from "@/app/actions/admin";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Working…" : "Run"}</button>;
}

export default function ImportForm({ type, title, help }) {
  const [state, action] = useFormState(runImport, null);
  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="type" value={type} />
      <div><div className="font-medium">{title}</div><p className="muted mt-1">{help}</p></div>
      <input type="file" name="file" accept=".csv,text/csv" className="block text-sm" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dryRun" defaultChecked /> Preview only (don't save anything)</label>
      {type === "affiliates" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="syncCrm" /> Push imported affiliates to FluentCRM</label>}
      <Submit />
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state && !state.error && (
        <div className={`rounded-lg p-3 text-sm ${state.errors.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
          <strong>{state.dryRun ? "Preview: " : "Done: "}</strong>
          {state.total} rows · {state.created} {state.dryRun ? "would be created" : "created"} · {state.updated} {state.dryRun ? "would be updated" : "updated"} · {state.skipped} skipped
          {state.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{state.errors.slice(0, 15).map((e) => <li key={e}>{e}</li>)}</ul>}
          {state.dryRun && <p className="mt-2 text-xs">Looks right? Untick “Preview only”, choose the file again and run.</p>}
        </div>
      )}
    </form>
  );
}
