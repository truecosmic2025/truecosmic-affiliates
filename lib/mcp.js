import { prisma, logEvent } from "./db";
import { getSettings } from "./settings";
import { keyAllows } from "./apiauth";
import { affiliateJson, referralJson } from "./notify";
import { disputeJson, payoutJson, referralBrief } from "./apijson";
import { summary } from "./stats";
import { getBalances } from "./balances";
import { setAffiliateStatus, findAffiliateByRef } from "./affiliates";
import { registerAffiliate, RegistrationError } from "./registration";
import { DISPUTE_STATUS, staffReply, accountsContact } from "./disputes";
import { payTo, describe } from "./payoutMethods";
import { syncAffiliateToCrm } from "./crm";

// MCP (Model Context Protocol) server for AI agents such as Franklin (accounts) and Grace (affiliate manager).
// Stateless Streamable HTTP: every request is a JSON-RPC message answered with JSON.
// Tools are filtered by the API key's scopes. Deliberately, no tool can create, approve or send a payout,
// or change an affiliate's payout details (those need the affiliate's own email confirmation).

export const SERVER_INFO = { name: "truecosmic-affiliates", title: "TrueCosmic Affiliates", version: "1.0.0" };
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const STATUSES = ["active", "pending", "inactive", "rejected"];
const clamp = (n, d = 50, max = 200) => Math.min(Math.max(Number(n) || d, 1), max);

async function resolveAffiliate(idOrRef) {
  const v = String(idOrRef || "").trim();
  if (!v) return null;
  return (
    (await prisma.affiliate.findUnique({ where: { id: v } })) ||
    (await prisma.affiliate.findFirst({ where: { email: { equals: v, mode: "insensitive" } } })) ||
    (await findAffiliateByRef(v))
  );
}

function need(cond, msg) {
  if (!cond) throw new ToolError(msg);
}
class ToolError extends Error {}

const creativeJson = (c) => ({ id: c.id, name: c.name, type: c.type, url: c.url, image_url: c.imageUrl, text: c.text, description: c.description, group_ids: c.groupIds, active: c.active, created_at: c.createdAt });

// Creatives must point at a TrueCosmic page (the affiliate's code is added to it) and use an https image
function creativeData(a) {
  const out = {};
  if (a.name !== undefined) out.name = String(a.name).slice(0, 120) || "Untitled";
  if (a.url !== undefined) {
    let u;
    try { u = new URL(String(a.url)); } catch { u = null; }
    need(u && u.protocol === "https:" && /(^|\.)truecosmic\.com$/i.test(u.hostname), "url must be an https://truecosmic.com page");
    out.url = u.toString();
  }
  if (a.image_url !== undefined) {
    need(!a.image_url || /^https:\/\//i.test(String(a.image_url)), "image_url must start with https://");
    out.imageUrl = a.image_url ? String(a.image_url).slice(0, 1000) : null;
  }
  if (a.text !== undefined) out.text = a.text ? String(a.text).slice(0, 3000) : null;
  if (a.description !== undefined) out.description = a.description ? String(a.description).slice(0, 500) : null;
  if (a.type !== undefined) { need(["image", "text", "qr"].includes(a.type), "type must be image, text or qr"); out.type = a.type; }
  if (a.active !== undefined) out.active = !!a.active;
  return out;
}

const AFFILIATE_ARG = { type: "string", description: "Affiliate id, referral code, old AffiliateWP id or username, or email" };

export const TOOLS = [
  {
    name: "programme_summary",
    scope: "referrals:read",
    readOnly: true,
    description: "Totals for the affiliate programme over the last N days: revenue, commission, sales, visits, conversion, unpaid and pending amounts, open disputes, pending applications, and the top affiliates. Amounts are in the programme currency (USD).",
    inputSchema: { type: "object", properties: { days: { type: "integer", description: "Look-back window in days (default 30)" } } },
    async run({ days = 30 }) {
      const since = new Date(Date.now() - clamp(days, 30, 3650) * 864e5);
      const [s, all, top, pendingApps, openDisputes] = await Promise.all([
        getSettings(),
        summary({}, since),
        prisma.referral.groupBy({ by: ["affiliateId"], where: { status: { in: ["UNPAID", "PAID"] }, createdAt: { gte: since } }, _sum: { amount: true, orderTotal: true }, _count: true, orderBy: { _sum: { amount: "desc" } }, take: 10 }),
        prisma.affiliate.count({ where: { status: "PENDING" } }),
        prisma.dispute.count({ where: { status: { in: ["open", "in_review"] } } }),
      ]);
      const affs = await prisma.affiliate.findMany({ where: { id: { in: top.map((t) => t.affiliateId) } } });
      const byId = Object.fromEntries(affs.map((a) => [a.id, a]));
      return {
        currency: s.currency, days: clamp(days, 30, 3650), ...all, pending_applications: pendingApps, open_disputes: openDisputes,
        top_affiliates: top.map((t) => ({ affiliate_id: t.affiliateId, code: byId[t.affiliateId]?.code, name: [byId[t.affiliateId]?.firstName, byId[t.affiliateId]?.lastName].filter(Boolean).join(" "), sales: t._count, revenue: Number(t._sum.orderTotal || 0), commission: Number(t._sum.amount || 0) })),
      };
    },
  },
  {
    name: "list_affiliates",
    scope: "affiliates:read",
    readOnly: true,
    description: "List affiliates, newest first. Filter by status (active, pending = applications awaiting review, inactive, rejected) and/or a search over name, email and referral code.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: STATUSES }, search: { type: "string" }, limit: { type: "integer", description: "Max 200, default 50" }, offset: { type: "integer" } } },
    async run({ status, search, limit, offset }) {
      const q = search?.trim();
      const rows = await prisma.affiliate.findMany({
        where: {
          ...(status ? { status: status.toUpperCase() } : {}),
          ...(q ? { OR: ["email", "firstName", "lastName", "code"].map((k) => ({ [k]: { contains: q, mode: "insensitive" } })) } : {}),
        },
        orderBy: { createdAt: "desc" }, take: clamp(limit), skip: Number(offset) || 0,
      });
      return { data: rows.map((a) => ({ ...affiliateJson(a), aliases: a.aliases, website: a.website, promotion_plan: a.promotionPlan })) };
    },
  },
  {
    name: "get_affiliate",
    scope: "affiliates:read",
    readOnly: true,
    description: "Full profile of one affiliate: details, application answers, payout method, all-time stats, current balances, last 10 referrals and their disputes.",
    inputSchema: { type: "object", required: ["affiliate"], properties: { affiliate: AFFILIATE_ARG } },
    async run({ affiliate }) {
      const a = await resolveAffiliate(affiliate);
      need(a, `No affiliate matches "${affiliate}"`);
      const [stats, balances, referrals, disputes] = await Promise.all([
        summary({ affiliateId: a.id }),
        getBalances({ affiliateId: a.id }),
        prisma.referral.findMany({ where: { affiliateId: a.id }, orderBy: { createdAt: "desc" }, take: 10 }),
        prisma.dispute.findMany({ where: { affiliateId: a.id }, orderBy: { updatedAt: "desc" }, take: 10 }),
      ]);
      return {
        ...affiliateJson(a), aliases: a.aliases, website: a.website, promotion_plan: a.promotionPlan, application: a.registration,
        rejection_reason: a.rejectionReason, notes: a.notes, pay_to: describe(payTo(a)),
        stats, balances: balances?.data?.[0] || null, recent_referrals: referrals.map(referralBrief), disputes: disputes.map((d) => disputeJson(d)),
      };
    },
  },
  {
    name: "update_affiliate",
    scope: "affiliates:write",
    readOnly: false,
    description: "Change an affiliate's status (approve an application = active; reject with a reason, which is emailed to them; deactivate = inactive), their personal commission rate, their name or website, or add an internal note. Status changes send the usual approval/rejection emails. Cannot change login email or payout details.",
    inputSchema: {
      type: "object", required: ["affiliate"],
      properties: {
        affiliate: AFFILIATE_ARG,
        status: { type: "string", enum: STATUSES },
        reason: { type: "string", description: "Rejection reason (included in the email)" },
        rate_type: { type: "string", enum: ["percentage", "flat", "default"], description: "\"default\" removes the personal rate" },
        rate: { type: "number" },
        note: { type: "string", description: "Appended to the affiliate's private notes with a timestamp" },
        first_name: { type: "string" }, last_name: { type: "string" }, website: { type: "string" },
      },
    },
    async run({ affiliate, status, reason, rate_type, rate, note, first_name, last_name, website }, key) {
      let a = await resolveAffiliate(affiliate);
      need(a, `No affiliate matches "${affiliate}"`);
      const data = {};
      if (rate_type === "default") Object.assign(data, { rateType: null, rate: null });
      else if (rate_type) {
        need(Number.isFinite(Number(rate)) && Number(rate) >= 0, "rate must be a number of 0 or more");
        need(rate_type !== "percentage" || Number(rate) <= 100, "a percentage rate can't be over 100");
        Object.assign(data, { rateType: rate_type.toUpperCase(), rate: Number(rate) });
      }
      if (first_name !== undefined) data.firstName = String(first_name).trim().slice(0, 100) || null;
      if (last_name !== undefined) data.lastName = String(last_name).trim().slice(0, 100) || null;
      if (website !== undefined) data.website = String(website).trim().slice(0, 300) || null;
      if (note) data.notes = `${a.notes ? a.notes + "\n" : ""}[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${key.name}] ${note}`.slice(-5000);
      if (Object.keys(data).length) a = await prisma.affiliate.update({ where: { id: a.id }, data });
      if (status && status.toUpperCase() !== a.status) a = await setAffiliateStatus(a.id, status.toUpperCase(), { reason });
      else if (Object.keys(data).length) await syncAffiliateToCrm(a.id);
      await logEvent("mcp:update_affiliate", "ok", `${a.code} by key "${key.name}": ${JSON.stringify({ status, rate_type, rate, first_name, last_name, website, note: note ? "yes" : undefined })}`);
      return { ...affiliateJson(a), notes: a.notes };
    },
  },
  {
    name: "list_referrals",
    scope: "referrals:read",
    readOnly: true,
    description: "List commissions (referrals), newest first. Filter by affiliate, status (pending, unpaid, paid, rejected), WooCommerce order number or MemberPress transaction (as mepr-<id>), or date. Each shows the USD amount and, for GBP sales, the original amount and locked exchange rate.",
    inputSchema: {
      type: "object",
      properties: {
        affiliate: AFFILIATE_ARG, status: { type: "string", enum: ["pending", "unpaid", "paid", "rejected"] },
        order_id: { type: "string" }, since: { type: "string", description: "ISO date, e.g. 2026-10-01" }, limit: { type: "integer" }, offset: { type: "integer" },
      },
    },
    async run({ affiliate, status, order_id, since, limit, offset }) {
      let affiliateId;
      if (affiliate) {
        const a = await resolveAffiliate(affiliate);
        need(a, `No affiliate matches "${affiliate}"`);
        affiliateId = a.id;
      }
      const rows = await prisma.referral.findMany({
        where: {
          ...(affiliateId ? { affiliateId } : {}), ...(status ? { status: status.toUpperCase() } : {}),
          ...(order_id ? { orderId: String(order_id) } : {}), ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        },
        orderBy: { createdAt: "desc" }, take: clamp(limit), skip: Number(offset) || 0,
      });
      return { data: rows.map((r) => ({ ...referralBrief(r), affiliate_id: r.affiliateId, customer_email: r.customerEmail, campaign: r.campaign, flagged: r.flagged })) };
    },
  },
  {
    name: "approve_or_reject_referral",
    scope: "referrals:approve",
    readOnly: false,
    description: "Approve a pending commission (it becomes unpaid and joins the cleared balance once its refund window has passed) or reject a pending or unpaid commission with a reason. Paid commissions and commissions already in a pay run can't be changed. Use list_referrals with status=pending to find them.",
    inputSchema: { type: "object", required: ["referral_id", "action"], properties: { referral_id: { type: "string" }, action: { type: "string", enum: ["approve", "reject"] }, reason: { type: "string", description: "Required when rejecting; recorded on the commission" } } },
    async run({ referral_id, action, reason }, key) {
      const r = await prisma.referral.findUnique({ where: { id: String(referral_id) } });
      need(r, "Referral not found");
      need(!r.payoutId, "This commission is already in a pay run, so it can't be changed here");
      if (action === "approve") need(r.status === "PENDING", `Only pending commissions can be approved (this one is ${r.status.toLowerCase()})`);
      else {
        need(["PENDING", "UNPAID"].includes(r.status), `Only pending or unpaid commissions can be rejected (this one is ${r.status.toLowerCase()})`);
        need(String(reason || "").trim(), "A reason is required to reject a commission");
      }
      const status = action === "approve" ? "UNPAID" : "REJECTED";
      const line = `[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${key.name}] ${action === "approve" ? "Approved" : `Rejected: ${String(reason).trim()}`}`;
      const updated = await prisma.referral.update({ where: { id: r.id }, data: { status, notes: `${r.notes ? r.notes + "\n" : ""}${line}`.slice(-2000) } });
      await logEvent("mcp:approve_or_reject_referral", "ok", `${r.id} ${r.status} -> ${status} by key "${key.name}"${reason ? `: ${reason}` : ""}`);
      const { fireWebhooks } = await import("./notify");
      await fireWebhooks("referral.updated", referralJson(updated));
      await syncAffiliateToCrm(r.affiliateId);
      return { ...referralBrief(updated), notes: updated.notes };
    },
  },
  {
    name: "list_products",
    scope: "products:read",
    readOnly: true,
    description: "Products affiliates can promote (synced from the Academy's WooCommerce and MemberPress), with type (course, ebook, coaching, event, membership, other), price, coach, picture (image URL), short summary and whether they earn commission.",
    inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["course", "ebook", "coaching", "event", "membership", "other"] }, search: { type: "string" }, limit: { type: "integer" } } },
    async run({ kind, search, limit }) {
      const rows = await prisma.product.findMany({
        where: { deleted: false, ...(kind ? { kind } : {}), ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) },
        orderBy: { createdAt: "desc" }, take: clamp(limit, 100, 500),
      });
      return { data: rows.map((p) => ({ id: p.id, wc_id: p.wcId, name: p.name, kind: p.kind, price: Number(p.price), coach: p.coach, permalink: p.permalink, status: p.status, commission_enabled: p.commissionEnabled, image: p.image, summary: p.summary, own_rate: p.rate != null ? { type: p.rateType.toLowerCase(), rate: Number(p.rate) } : null })) };
    },
  },
  {
    name: "get_balances",
    scope: "balances:read",
    readOnly: true,
    description: "Commission balances. cleared = payable in the next monthly pay run if at least the minimum payout; clearing = still inside the 30-day refund window; in_payout = approved, not yet confirmed paid; pending = awaiting admin approval; paid = all-time paid. Omit affiliate for everyone with a balance.",
    inputSchema: { type: "object", properties: { affiliate: AFFILIATE_ARG } },
    async run({ affiliate }) {
      if (!affiliate) return getBalances({});
      const a = await resolveAffiliate(affiliate);
      need(a, `No affiliate matches "${affiliate}"`);
      return getBalances({ affiliateId: a.id });
    },
  },
  {
    name: "list_payouts",
    scope: "payouts:read",
    readOnly: true,
    description: "Payout history (read-only), newest first. Filter by affiliate, status (processing, paid, failed) or kind (run = monthly pay run, manual = one-off payment with a reason).",
    inputSchema: { type: "object", properties: { affiliate: AFFILIATE_ARG, status: { type: "string", enum: ["processing", "paid", "failed"] }, kind: { type: "string", enum: ["run", "manual"] }, limit: { type: "integer" } } },
    async run({ affiliate, status, kind, limit }) {
      let affiliateId;
      if (affiliate) {
        const a = await resolveAffiliate(affiliate);
        need(a, `No affiliate matches "${affiliate}"`);
        affiliateId = a.id;
      }
      const rows = await prisma.payout.findMany({ where: { ...(affiliateId ? { affiliateId } : {}), ...(status ? { status: status.toUpperCase() } : {}), ...(kind ? { kind } : {}) }, orderBy: { createdAt: "desc" }, take: clamp(limit) });
      return { data: rows.map(payoutJson) };
    },
  },
  {
    name: "get_payout",
    scope: "payouts:read",
    readOnly: true,
    description: "One payout and the commissions it covers (read-only).",
    inputSchema: { type: "object", required: ["payout_id"], properties: { payout_id: { type: "string" } } },
    async run({ payout_id }) {
      const p = await prisma.payout.findUnique({ where: { id: String(payout_id) }, include: { referrals: { orderBy: { createdAt: "asc" } } } });
      need(p, "Payout not found");
      return { ...payoutJson(p), referrals: p.referrals.map(referralBrief) };
    },
  },
  {
    name: "list_disputes",
    scope: "disputes:read",
    readOnly: true,
    description: "Affiliate disputes and queries. status: active (open + in review, the default), open, in_review, resolved, declined or all.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["active", "open", "in_review", "resolved", "declined", "all"] }, affiliate: AFFILIATE_ARG, limit: { type: "integer" } } },
    async run({ status = "active", affiliate, limit }) {
      let affiliateId;
      if (affiliate) {
        const a = await resolveAffiliate(affiliate);
        need(a, `No affiliate matches "${affiliate}"`);
        affiliateId = a.id;
      }
      const where = { ...(affiliateId ? { affiliateId } : {}), ...(status === "active" ? { status: { in: ["open", "in_review"] } } : status === "all" ? {} : { status }) };
      const rows = await prisma.dispute.findMany({ where, include: { affiliate: true }, orderBy: { updatedAt: "desc" }, take: clamp(limit) });
      return { data: rows.map((d) => disputeJson(d)) };
    },
  },
  {
    name: "get_dispute",
    scope: "disputes:read",
    readOnly: true,
    description: "One dispute with its full message thread and the referral or payout it's about.",
    inputSchema: { type: "object", required: ["dispute_id"], properties: { dispute_id: { type: "string" } } },
    async run({ dispute_id }) {
      const d = await prisma.dispute.findUnique({ where: { id: String(dispute_id) }, include: { affiliate: true, referral: true, payout: true, messages: { orderBy: { createdAt: "asc" } } } });
      need(d, "Dispute not found");
      return disputeJson(d, { full: true });
    },
  },
  {
    name: "reply_to_dispute",
    scope: "disputes:write",
    readOnly: false,
    description: "Post a reply to a dispute as the accounts team. The affiliate is emailed and sees it in their Disputes tab. Optionally set the status at the same time.",
    inputSchema: { type: "object", required: ["dispute_id", "body"], properties: { dispute_id: { type: "string" }, body: { type: "string", description: "Up to 5000 characters" }, status: { type: "string", enum: Object.keys(DISPUTE_STATUS) }, author_name: { type: "string", description: "Shown as the sender; defaults to the accounts contact name" } } },
    async run({ dispute_id, body, status, author_name }, key) {
      need(String(body || "").trim(), "body is required");
      need(String(body).length <= 5000, "body must be 5000 characters or fewer");
      need(await prisma.dispute.findUnique({ where: { id: String(dispute_id) } }), "Dispute not found");
      await staffReply(String(dispute_id), { body: String(body).trim(), status, staffName: String(author_name || (await accountsContact()).name).slice(0, 80) });
      await logEvent("mcp:reply_to_dispute", "ok", `${dispute_id} by key "${key.name}"`);
      const d = await prisma.dispute.findUnique({ where: { id: String(dispute_id) }, include: { affiliate: true, messages: { orderBy: { createdAt: "asc" } } } });
      return disputeJson(d, { full: true });
    },
  },
  {
    name: "set_dispute_status",
    scope: "disputes:write",
    readOnly: false,
    description: "Change a dispute's status (open, in_review, resolved, declined). The affiliate is emailed about the change.",
    inputSchema: { type: "object", required: ["dispute_id", "status"], properties: { dispute_id: { type: "string" }, status: { type: "string", enum: Object.keys(DISPUTE_STATUS) } } },
    async run({ dispute_id, status }, key) {
      need(DISPUTE_STATUS[status], `status must be one of ${Object.keys(DISPUTE_STATUS).join(", ")}`);
      need(await prisma.dispute.findUnique({ where: { id: String(dispute_id) } }), "Dispute not found");
      await staffReply(String(dispute_id), { status, staffName: (await accountsContact()).name });
      await logEvent("mcp:set_dispute_status", "ok", `${dispute_id} -> ${status} by key "${key.name}"`);
      return { id: dispute_id, status };
    },
  },
];

TOOLS.push(
  {
    name: "create_affiliate",
    scope: "affiliates:write",
    readOnly: false,
    description: "Add a new affiliate (e.g. someone you've recruited). status active (default) emails them the approval email with their link and sign-in details; pending adds them as an application to review. They sign in with their email and set their own password. Commission follows the normal programme rules unless you pass a personal rate.",
    inputSchema: {
      type: "object", required: ["email", "first_name"],
      properties: {
        email: { type: "string" }, first_name: { type: "string" }, last_name: { type: "string" },
        code: { type: "string", description: "Preferred referral code, e.g. their name (made unique automatically)" },
        payment_email: { type: "string", description: "PayPal email if different from their login email" },
        website: { type: "string" },
        status: { type: "string", enum: ["active", "pending"] },
        rate_type: { type: "string", enum: ["percentage", "flat"] }, rate: { type: "number" },
        note: { type: "string", description: "Private note, e.g. where they came from" },
      },
    },
    async run(args, key) {
      need(!!args.rate_type === (args.rate != null), "rate_type and rate go together");
      let a;
      try {
        a = await registerAffiliate(
          {
            email: args.email, firstName: args.first_name, lastName: args.last_name, code: args.code, paymentEmail: args.payment_email, website: args.website,
            rateType: args.rate_type ? args.rate_type.toUpperCase() : null, rate: args.rate ?? null,
            notes: `Added by ${key.name}${args.note ? `: ${args.note}` : ""}`,
          },
          { byAdmin: true, status: args.status === "pending" ? "PENDING" : "ACTIVE" }
        );
      } catch (e) {
        if (e instanceof RegistrationError) throw new ToolError(e.message === "exists" ? "An affiliate with that email already exists" : e.message === "email" ? "That email address isn't valid" : e.message);
        throw e;
      }
      await logEvent("mcp:create_affiliate", "ok", `${a.email} (${a.status}) by key "${key.name}"`);
      return { ...affiliateJson(a), website: a.website };
    },
  },
  {
    name: "list_visits",
    scope: "visits:read",
    readOnly: true,
    description: "Clicks on affiliate links, newest first, with the page landed on, referring site, campaign and whether it became a sale. Filter by affiliate, campaign or date.",
    inputSchema: { type: "object", properties: { affiliate: AFFILIATE_ARG, campaign: { type: "string" }, converted: { type: "boolean" }, since: { type: "string", description: "ISO date" }, limit: { type: "integer" } } },
    async run({ affiliate, campaign, converted, since, limit }) {
      const where = {};
      if (affiliate) { const a = await resolveAffiliate(affiliate); need(a, `No affiliate matches "${affiliate}"`); where.affiliateId = a.id; }
      if (campaign) where.campaign = campaign;
      if (converted !== undefined) where.converted = !!converted;
      if (since) where.createdAt = { gte: new Date(since) };
      const rows = await prisma.visit.findMany({ where, orderBy: { createdAt: "desc" }, take: clamp(limit, 100, 500), include: { affiliate: { select: { code: true } } } });
      return { data: rows.map((v) => ({ id: v.id, affiliate: v.affiliate.code, url: v.url, referrer: v.referrer, campaign: v.campaign, source: v.source, converted: v.converted, flagged: v.flagged, created_at: v.createdAt })) };
    },
  },
  {
    name: "list_creatives",
    scope: "creatives:write",
    readOnly: true,
    description: "Creatives affiliates see under Creatives: banners, social graphics and ready-made copy. Each links to a TrueCosmic page; the affiliate's own code is added automatically.",
    inputSchema: { type: "object", properties: { include_inactive: { type: "boolean" } } },
    async run({ include_inactive }) {
      const rows = await prisma.creative.findMany({ where: include_inactive ? {} : { active: true }, orderBy: { createdAt: "desc" } });
      return { data: rows.map(creativeJson) };
    },
  },
  {
    name: "save_creative",
    scope: "creatives:write",
    readOnly: false,
    description: "Add a creative, or edit one by passing its id. url = the TrueCosmic page it promotes (e.g. a product permalink from list_products); image_url = an https image (product pictures from list_products work); text = ready-to-paste caption or email copy. type: image (banner/graphic), text (copy only) or qr. Set active false to hide it from affiliates instead of deleting.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Omit to create a new creative" },
        name: { type: "string" }, url: { type: "string" }, image_url: { type: "string" }, text: { type: "string" },
        description: { type: "string", description: "Internal note, not shown to affiliates" },
        type: { type: "string", enum: ["image", "text", "qr"] }, active: { type: "boolean" },
      },
    },
    async run(args, key) {
      const data = creativeData(args);
      let c;
      if (args.id) {
        need(await prisma.creative.findUnique({ where: { id: String(args.id) } }), "Creative not found");
        c = await prisma.creative.update({ where: { id: String(args.id) }, data });
      } else {
        need(data.name && data.url, "name and url are required for a new creative");
        c = await prisma.creative.create({ data: { type: data.imageUrl ? "image" : "text", ...data } });
      }
      await logEvent("mcp:save_creative", "ok", `${args.id ? "updated" : "created"} "${c.name}" by key "${key.name}"`);
      return creativeJson(c);
    },
  }
);

function toolList(key) {
  return TOOLS.filter((t) => keyAllows(key, t.scope)).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { readOnlyHint: t.readOnly, destructiveHint: false, openWorldHint: false },
  }));
}

const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// Handles one JSON-RPC message; returns the response object, or null for notifications
export async function handleRpc(msg, key) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg?.id, -32600, "Invalid request");
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined || id === null;
  if (isNotification) return null; // notifications/initialized, notifications/cancelled, ...
  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: `TrueCosmic Academy affiliate programme. Connected as API key "${key.name}" (${key.scopes.includes("full") ? "full access" : key.scopes.join(", ")}). Amounts are in USD. Payouts can't be created or sent through this connector.`,
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: toolList(key) } };
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool || !keyAllows(key, tool.scope)) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const out = await tool.run(params.arguments || {}, key);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: Array.isArray(out) ? { data: out } : out } };
      } catch (e) {
        if (!(e instanceof ToolError)) await logEvent(`mcp:${params.name}`, "error", e.message);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: e instanceof ToolError ? e.message : `Error: ${e.message}` }], isError: true } };
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
