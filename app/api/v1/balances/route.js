import { NextResponse } from "next/server";
import { withApiKey, page } from "@/lib/apiauth";
import { getBalances } from "@/lib/balances";

export const dynamic = "force-dynamic";

// Read-only balances; see lib/balances.js for what each figure means.
// ?affiliate_id= for one affiliate; otherwise every affiliate with a non-zero balance.
export const GET = withApiKey(async (req) => {
  const affiliateId = req.nextUrl.searchParams.get("affiliate_id");
  const result = await getBalances({ affiliateId, ...page(req) });
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(result);
}, "balances:read");
