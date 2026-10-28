"use server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma, logEvent } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { sendMail } from "@/lib/wp";
import { getSettings } from "@/lib/settings";
import { uniqueCode } from "@/lib/affiliates";
import { syncAffiliateToCrm } from "@/lib/crm";

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
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  if (!email || !firstName) redirect("/join?error=missing");
  if (await prisma.affiliate.findUnique({ where: { email } })) redirect("/join?error=exists");
  const s = await getSettings();
  const user = await prisma.user.upsert({ where: { email }, create: { email, name: `${firstName} ${lastName}`.trim() }, update: {} });
  const a = await prisma.affiliate.create({
    data: {
      email,
      firstName,
      lastName: lastName || null,
      userId: user.id,
      code: await uniqueCode(formData.get("code") || firstName),
      paymentEmail: String(formData.get("paymentEmail") || email).trim(),
      website: String(formData.get("website") || "").trim() || null,
      promotionPlan: String(formData.get("promotionPlan") || "").trim() || null,
      status: s.autoApproveAffiliates ? "ACTIVE" : "PENDING",
    },
  });
  await logEvent("affiliate:applied", "ok", email);
  await syncAffiliateToCrm(a.id, ["Affiliate - Applied"]);
  const admin = process.env.ADMIN_EMAIL;
  if (admin) await sendMail(admin, `New affiliate application: ${firstName} ${lastName}`, `<p>${email} applied.</p><p><a href="${process.env.APP_URL}/admin/affiliates/${a.id}">Review application</a></p>`);
  redirect(`/join?done=${a.status === "ACTIVE" ? "active" : "pending"}`);
}
