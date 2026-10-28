"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { syncAffiliateToCrm } from "@/lib/crm";

export async function updateMyAccount(f) {
  const user = await requireAffiliate();
  const clean = (k) => String(f.get(k) || "").trim() || null;
  await prisma.affiliate.update({
    where: { id: user.affiliate.id },
    data: { firstName: clean("firstName"), lastName: clean("lastName"), paymentEmail: clean("paymentEmail"), website: clean("website") },
  });
  await syncAffiliateToCrm(user.affiliate.id);
  redirect("/dashboard/account?saved=1");
}
