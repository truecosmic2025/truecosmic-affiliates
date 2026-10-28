import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/wp";
import { logEvent } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { upsertProduct, markProductDeleted } from "@/lib/products";
import { recordOrder, reverseOrder, recordSignup } from "@/lib/referrals";
import { autoRegisterCustomer } from "@/lib/registration";
import { trackingConfig } from "@/lib/visits";

export const dynamic = "force-dynamic";

// Single signed entry point for everything the WordPress connector pushes.
export async function POST(req) {
  const body = await req.text();
  if (!verifySignature(body, req.headers.get("x-tc-signature"))) {
    await logEvent("webhook", "error", "bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let evt;
  try {
    evt = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { event, data } = evt;
  try {
    switch (event) {
      case "ping": {
        return NextResponse.json({ ok: true, ...(await trackingConfig(await getSettings())) });
      }
      case "user.signup": {
        const r = await recordSignup(data);
        return NextResponse.json({ ok: true, skipped: r.skipped, referral_id: r.referral?.id });
      }
      case "product.upsert": {
        const p = await upsertProduct(data);
        return NextResponse.json({ ok: true, id: p.id });
      }
      case "products.bulk": {
        for (const p of data || []) await upsertProduct(p);
        return NextResponse.json({ ok: true, count: (data || []).length });
      }
      case "product.deleted":
        await markProductDeleted(data.id);
        return NextResponse.json({ ok: true });
      case "order.paid": {
        const r = await recordOrder(data);
        // Most orders aren't affiliate sales; only log skips that are worth a look
        if (r.skipped && r.skipped !== "no affiliate" && r.skipped !== "already recorded") await logEvent("webhook:order.paid", "skipped", `order ${data.id}: ${r.skipped}`);
        await autoRegisterCustomer(data);
        return NextResponse.json({ ok: true, skipped: r.skipped, referral_id: r.referral?.id, amount: r.referral?.amount });
      }
      case "order.reversed": {
        const r = await reverseOrder(data.id, data.reason);
        return NextResponse.json({ ok: true, ...r });
      }
      default:
        return NextResponse.json({ error: `unknown event ${event}` }, { status: 400 });
    }
  } catch (e) {
    await logEvent(`webhook:${event}`, "error", e.message, data);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
