import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "./db";

// Wraps a route handler with Bearer API key auth and JSON error handling
export function withApiKey(handler) {
  return async (req, ctx) => {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "missing API key" }, { status: 401 });
    const key = await prisma.apiKey.findUnique({ where: { keyHash: crypto.createHash("sha256").update(token).digest("hex") } });
    if (!key) return NextResponse.json({ error: "invalid API key" }, { status: 401 });
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    try {
      return await handler(req, ctx);
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
