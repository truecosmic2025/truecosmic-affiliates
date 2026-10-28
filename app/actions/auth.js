"use server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { sendMail } from "@/lib/wp";
import { getSettings } from "@/lib/settings";
import { registerAffiliate, RegistrationError } from "@/lib/registration";

export async function passwordLogin(formData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) redirect("/login?error=invalid");
  await createSession(user);
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function sendMagicLink(formData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  // Same response whether or not the account exists, so emails can't be probed
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.loginToken.create({
      data: { email, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const url = `${process.env.APP_URL}/auth/verify?token=${token}`;
    const s = await getSettings();
    await sendMail(email, `Your ${s.siteName} affiliate login link`, `<p>Click to sign in (valid for 30 minutes):</p><p><a href="${url}">${url}</a></p>`);
  }
  redirect("/login?sent=1");
}

export async function logout() {
  destroySession();
  redirect("/login");
}

export async function applyAsAffiliate(formData) {
  const v = (k) => String(formData.get(k) || "").trim();
  // Honeypot: real people never fill the hidden "company" field
  if (v("company")) redirect("/join?done=pending");
  const s = await getSettings();
  if (s.requireTerms && formData.get("terms") !== "on") redirect("/join?error=terms");
  if (!v("email") || !v("firstName")) redirect("/join?error=missing");
  const extra = {};
  for (const k of ["instagram", "youtube", "tiktok", "audience", "phone"]) if (v(k)) extra[k] = v(k);
  let a;
  try {
    a = await registerAffiliate(
      {
        email: v("email"), firstName: v("firstName"), lastName: v("lastName"), code: v("code"), paymentEmail: v("paymentEmail"),
        website: v("website"), promotionPlan: v("promotionPlan"), parentRef: v("parentRef"), extra: Object.keys(extra).length ? extra : undefined,
      },
      { ip: headers().get("x-forwarded-for")?.split(",")[0]?.trim() }
    );
  } catch (e) {
    if (e instanceof RegistrationError) redirect(`/join?error=${e.message}`);
    throw e;
  }
  redirect(`/join?done=${a.status === "ACTIVE" ? "active" : "pending"}`);
}
