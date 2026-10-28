import Link from "next/link";
import { RANGES } from "@/lib/range";

export default function RangePicker({ base, range, extra = "" }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {RANGES.map((r) => (
        <Link key={r.key} href={`${base}?range=${r.key}${extra}`} className={`rounded-full px-3 py-1 text-xs ${range.key === r.key ? "bg-cosmic-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
          {r.label}
        </Link>
      ))}
      <form className="ml-1 flex items-center gap-1 text-xs">
        <input type="date" name="from" className="input w-auto py-1 text-xs" defaultValue={range.key === "custom" ? range.from.toISOString().slice(0, 10) : ""} />
        <input type="date" name="to" className="input w-auto py-1 text-xs" defaultValue={range.key === "custom" ? range.to.toISOString().slice(0, 10) : ""} />
        <button className="btn-secondary btn-sm">Apply</button>
      </form>
    </div>
  );
}
