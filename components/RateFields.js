export default function RateFields({ rateType, rate, hint = "Leave blank to use the default" }) {
  return (
    <div>
      <label className="label">Commission rate</label>
      <div className="flex gap-2">
        <select name="rateType" defaultValue={rateType || ""} className="input w-40">
          <option value="">Default</option>
          <option value="PERCENTAGE">Percentage %</option>
          <option value="FLAT">Flat amount</option>
        </select>
        <input name="rate" type="number" step="0.01" min="0" defaultValue={rate != null ? Number(rate) : ""} className="input" />
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
