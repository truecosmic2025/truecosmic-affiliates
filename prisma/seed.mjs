// Ensures the admin account from ADMIN_EMAIL / ADMIN_PASSWORD exists. Safe to run on every boot.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (email && password) {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    create: { email, role: "ADMIN", passwordHash, name: "Admin" },
    update: { role: "ADMIN", passwordHash },
  });
  console.log(`admin user ready: ${email}`);
} else {
  console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin seed");
}
await prisma.$disconnect();
