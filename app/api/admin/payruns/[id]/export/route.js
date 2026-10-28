import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getRate, convert } from "@/lib/fx";
import { describe } from "@/lib/payoutMethods";

export const dynamic = "force-dynamic";

const esc = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows) => rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";

// Files for paying a run's group outside PayPal's API: Wise batch, PayPal mass payment, or a plain list
export async function GET(req, { params }) {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });
  const method = req.nextUrl.searchParams.get("method");
  const s = await getSettings();
  const run = await prisma.payoutRun.findUnique({ where: { id: params.id } });
  if (!run) return new Response("Not found", { status: 404 });
  const payouts = await prisma.payout.findMany({ where: { runId: run.id, method, status: "PROCESSING" }, include: { affiliate: true }, orderBy: { amount: "desc" } });
  const month = run.createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  let body;

  if (method === "wise") {
    const cols = s.wiseColumns.split(",").map((c) => c.trim()).filter(Boolean);
    const source = (s.wiseSourceCurrency || "GBP").toUpperCase();
    const rows = [cols];
    for (const p of payouts) {
      const d = p.payTo?.details || {};
      const target = (d.currency || s.currency).toUpperCase();
      // Amounts are owed in USD. Wise needs the fixed amount in either the source or the target currency.
      let amount = Number(p.amount);
      let amountCurrency = s.currency;
      if (target !== s.currency && source !== s.currency) {
        const fx = await getRate(s.currency, target, new Date());
        amount = convert(amount, fx.rate);
        amountCurrency = target;
      }
      const value = {
        name: d.name || [p.affiliate.firstName, p.affiliate.lastName].filter(Boolean).join(" "),
        recipientemail: d.email, email: d.email,
        paymentreference: `TrueCosmic affiliate ${month}`.slice(0, 35), reference: `TrueCosmic affiliate ${month}`.slice(0, 35),
        receivertype: "PERSON", recipienttype: "PERSON",
        amountcurrency: amountCurrency, amount: amount.toFixed(2),
        sourcecurrency: source, targetcurrency: target,
      };
      rows.push(cols.map((c) => value[c.toLowerCase()] ?? ""));
    }
    body = csv(rows);
  } else if (method === "paypal") {
    // PayPal "Payouts" bulk upload: recipient, amount, currency, sender item id, note (no header row)
    body = csv(payouts.map((p) => [p.payTo?.details?.email, Number(p.amount).toFixed(2), p.currency, p.id, `${s.siteName} affiliate payout ${month}`]));
  } else {
    body = csv([
      ["payout_id", "affiliate_code", "name", "login_email", "pay_to", "amount", "currency", "reference"],
      ...payouts.map((p) => [p.id, p.affiliate.code, [p.affiliate.firstName, p.affiliate.lastName].filter(Boolean).join(" "), p.affiliate.email, describe(p.payTo || { method }), Number(p.amount).toFixed(2), p.currency, ""]),
    ]);
  }
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${method}-payouts-${run.createdAt.toISOString().slice(0, 10)}.csv"` },
  });
}
