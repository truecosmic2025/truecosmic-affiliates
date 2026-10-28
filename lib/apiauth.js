import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "./db";

// What each key may do. There is deliberately no scope that can create or send a payout.
export const SCOPES = {
  "affiliates:read": "Read affiliates",
  "affiliates:write": "Create and update affiliates",
  "referrals:read": "Read referrals",
  "referrals:write": "Create referrals",
  "visits:read": "Read visits",
  "products:read": "Read products",
  "payouts:read": "Read payouts",
  "balances:read": "Read cleared / clearing balances",
  "disputes:read": "Read disputes",
  "disputes:write": "Reply to disputes and set their status",
};

export const PRESETS = {
  full: { label: "Full access (all scopes)", scopes: ["full"] },
  accounts: { label: "Accounts agent (e.g. Franklin): disputes, payouts and balances", scopes: ["disputes:read", "disputes:write", "payouts:read", "balances:read", "affiliates:read", "referrals:read"] },
  manager: { label: "Affiliate manager (e.g. Grace): affiliates, applications, referrals, products, disputes, balances", scopes: ["affiliates:read", "affiliates:write", "referrals:read", "visits:read", "products:read", "payouts:read", "balances:read", "disputes:read", "disputes:write"] },
};

export function hashKey(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

// Looks up an API key from its raw value; null if unknown
export async function findKey(token) {
  if (!token) return null;
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashKey(token) } });
  if (key) prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return key;
}

export function keyAllows(key, scope) {
  return !scope || key.scopes.includes("full") || key.scopes.includes(scope);
}

// Wraps a route handler with Bearer API key auth, a scope check and JSON error handling.
// The handler receives the key as its third argument.
export function withApiKey(handler, scope) {
  return async (req, ctx) => {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "missing API key" }, { status: 401 });
    const key = await prisma.apiKey.findUnique({ where: { keyHash: crypto.createHash("sha256").update(token).digest("hex") } });
    if (!key) return NextResponse.json({ error: "invalid API key" }, { status: 401 });
    if (scope && !key.scopes.includes("full") && !key.scopes.includes(scope)) {
      return NextResponse.json({ error: `this key lacks the ${scope} scope` }, { status: 403 });
    }
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    try {
      return await handler(req, ctx, key);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: e.status || 500 });
    }
  };
}

export function page(req) {
  const sp = req.nextUrl.searchParams;
  return { take: Math.min(Number(sp.get("limit")) || 100, 500), skip: Number(sp.get("offset")) || 0 };
}

export function since(req) {
  const s = req.nextUrl.searchParams.get("since");
  return s ? { createdAt: { gte: new Date(s) } } : {};
}

export const upper = (v) => (v ? String(v).toUpperCase() : undefined);
