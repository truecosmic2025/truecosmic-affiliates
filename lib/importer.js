import Papa from "papaparse";
import { prisma, logEvent } from "./db";
import { uniqueCode } from "./affiliates";
import { getSettings } from "./settings";
import { getRate, convert } from "./fx";

const norm = (h) => String(h || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function pick(row, ...keys) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function num(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return undefined;
  const d = new Date(v.replace(" ", "T"));
  return isNaN(d) ? undefined : d;
}

export function parseCsv(text) {
  const { data } = Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true, transformHeader: norm });
  return data;
}

const STATUS = { active: "ACTIVE", pending: "PENDING", inactive: "INACTIVE", rejected: "REJECTED" };
const REF_STATUS = { paid: "PAID", unpaid: "UNPAID", pending: "PENDING", rejected: "REJECTED" };

// AffiliateWP > Tools > Export > Export Affiliates
export async function importAffiliates(text, { dryRun = false } = {}) {
  const rows = parseCsv(text);
  const result = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };
  for (const [i, row] of rows.entries()) {
    try {
      const email = pick(row, "email", "user_email", "affiliate_email")?.toLowerCase();
      if (!email) {
        result.skipped++;
        result.errors.push(`row ${i + 2}: no email`);
        continue;
      }
      const legacyId = num(pick(row, "affiliate_id", "id"));
      let firstName = pick(row, "first_name");
      let lastName = pick(row, "last_name");
      const name = pick(row, "name", "display_name", "affiliate_name");
      if (!firstName && name) {
        const parts = name.split(/\s+/);
        firstName = parts.shift();
        lastName = lastName || parts.join(" ") || null;
      }
      const username = pick(row, "username", "user_login", "login", "user_name");
      const rateType = pick(row, "rate_type");
      const rate = num(pick(row, "rate"));
      const data = {
        firstName,
        lastName,
        paymentEmail: pick(row, "payment_email", "paypal_email") || email,
        website: pick(row, "website", "url", "user_url"),
        status: STATUS[(pick(row, "status") || "active").toLowerCase()] || "ACTIVE",
        rateType: rate != null && rateType ? (/flat/i.test(rateType) ? "FLAT" : "PERCENTAGE") : null,
        rate: rate != null && rateType ? rate : null,
        coupons: (pick(row, "coupons", "coupon", "coupon_code") || "").split(/[,|]/).map((c) => c.trim()).filter(Boolean),
      };
      const existing =
        (legacyId && (await prisma.affiliate.findUnique({ where: { legacyId } }))) ||
        (await prisma.affiliate.findUnique({ where: { email } }));
      if (dryRun) {
        existing ? result.updated++ : result.created++;
        continue;
      }
      if (existing) {
        await prisma.affiliate.update({ where: { id: existing.id }, data: { ...data, legacyId: existing.legacyId ?? legacyId } });
        result.updated++;
      } else {
        const user = await prisma.user.upsert({
          where: { email },
          create: { email, name: [firstName, lastName].filter(Boolean).join(" ") || null },
          update: {},
        });
        await prisma.affiliate.create({
          data: {
            ...data,
            email,
            legacyId,
            userId: user.id,
            code: await uniqueCode(username || firstName || email.split("@")[0]),
            createdAt: parseDate(pick(row, "date_registered", "date", "registered")),
            notes: "Imported from AffiliateWP",
          },
        });
        result.created++;
      }
    } catch (e) {
      result.errors.push(`row ${i + 2}: ${e.message}`);
    }
  }
  if (!dryRun) await logEvent("import:affiliates", result.errors.length ? "error" : "ok", JSON.stringify({ ...result, errors: result.errors.slice(0, 20) }));
  return result;
}

// AffiliateWP > Tools > Export > Export Referrals
export async function importReferrals(text, { dryRun = false } = {}) {
  const rows = parseCsv(text);
  const settings = await getSettings();
  const result = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };
  for (const [i, row] of rows.entries()) {
    try {
      const legacyAffId = num(pick(row, "affiliate_id"));
      const affEmail = pick(row, "email", "affiliate_email", "user_email")?.toLowerCase();
      const affiliate =
        (legacyAffId && (await prisma.affiliate.findUnique({ where: { legacyId: legacyAffId } }))) ||
        (affEmail && (await prisma.affiliate.findUnique({ where: { email: affEmail } })));
      if (!affiliate) {
        result.skipped++;
        result.errors.push(`row ${i + 2}: affiliate ${legacyAffId || affEmail} not found - import affiliates first`);
        continue;
      }
      const legacyId = num(pick(row, "referral_id", "id"));
      const reference = pick(row, "reference", "order_id", "order");
      const data = {
        affiliateId: affiliate.id,
        amount: num(pick(row, "amount", "commission")) || 0,
        currency: (pick(row, "currency") || settings.storeCurrency).toUpperCase(),
        status: REF_STATUS[(pick(row, "status") || "unpaid").toLowerCase()] || "UNPAID",
        description: pick(row, "description", "products"),
        source: "import",
        createdAt: parseDate(pick(row, "date", "date_created")),
      };
      const orderId = reference ? String(reference) : null;
      const existing =
        (legacyId && (await prisma.referral.findUnique({ where: { legacyId } }))) ||
        (orderId && (await prisma.referral.findFirst({ where: { orderId, affiliateId: affiliate.id } })));
      if (dryRun) {
        existing ? result.updated++ : result.created++;
        continue;
      }
      // AffiliateWP recorded commissions in the store currency: convert to the programme currency at the referral's date
      if (data.currency !== settings.currency) {
        const fx = await getRate(data.currency, settings.currency, data.createdAt || new Date(), { fallbackRate: settings.fxFallbackRate });
        Object.assign(data, {
          originalCurrency: data.currency, amountOriginal: data.amount, amount: convert(data.amount, fx.rate), currency: settings.currency,
          fxRate: fx.rate, fxDate: new Date(`${fx.rateDate}T00:00:00Z`), fxSource: `${fx.source} (imported)`,
        });
      }
      if (existing) {
        await prisma.referral.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.referral.create({ data: { ...data, legacyId, orderId } });
        result.created++;
      }
    } catch (e) {
      result.errors.push(`row ${i + 2}: ${e.message}`);
    }
  }
  if (!dryRun) await logEvent("import:referrals", result.errors.length ? "error" : "ok", JSON.stringify({ ...result, errors: result.errors.slice(0, 20) }));
  return result;
}
