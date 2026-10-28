import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const COOKIE = "tca_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "insecure-dev-secret");

export async function createSession(user) {
  const token = await new SignJWT({ uid: user.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function currentUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return await prisma.user.findUnique({ where: { id: payload.uid }, include: { affiliate: true } });
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");
  return user;
}

export async function requireAffiliate() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "ADMIN" && !user.affiliate) redirect("/admin");
  if (!user.affiliate) redirect("/login");
  return user;
}
