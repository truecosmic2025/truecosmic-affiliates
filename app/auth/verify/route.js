import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await prisma.loginToken.findUnique({ where: { tokenHash } });
  const base = process.env.APP_URL || req.nextUrl.origin;
  if (!row || row.usedAt || row.expiresAt < new Date()) return NextResponse.redirect(new URL("/login?error=expired", base));
  await prisma.loginToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  const user = await prisma.user.findUnique({ where: { email: row.email } });
  if (!user) return NextResponse.redirect(new URL("/login?error=invalid", base));
  await createSession(user);
  return NextResponse.redirect(new URL(user.role === "ADMIN" ? "/admin" : "/dashboard", base));
}
