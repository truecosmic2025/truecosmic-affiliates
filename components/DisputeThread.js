export default function DisputeThread({ messages, staffLabel = "TrueCosmic accounts" }) {
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`max-w-2xl rounded-xl p-4 text-sm ${m.author === "staff" ? "ml-auto bg-cosmic-50 ring-1 ring-cosmic-100" : "bg-white ring-1 ring-slate-200"}`}>
          <div className="mb-1 text-xs text-slate-500">{m.author === "staff" ? m.authorName || staffLabel : m.authorName || "Affiliate"} · {m.createdAt.toLocaleString("en-GB")}</div>
          <div className="whitespace-pre-wrap">{m.body}</div>
        </div>
      ))}
    </div>
  );
}
