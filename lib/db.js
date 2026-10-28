import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function logEvent(kind, status, message, payload) {
  try {
    await prisma.eventLog.create({ data: { kind, status, message: message?.slice(0, 1000), payload: payload ?? undefined } });
  } catch (e) {
    console.error("logEvent failed", e);
  }
}
