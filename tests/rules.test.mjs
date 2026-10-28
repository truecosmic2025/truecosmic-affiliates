import { test } from "node:test";
import assert from "node:assert/strict";
import { rateFor, promotionFor, promotionRunning, calculateCommission } from "../lib/commission.js";
import { nextPayoutDate, clearsAtFor, isPayoutDay } from "../lib/payouts.js";

const settings = { defaultRateType: "PERCENTAGE", defaultRate: 35, newProductsEarnCommission: true, flatRateBasis: "product", holdDays: 30, payoutDay: 1 };

test("published default: 35% of a sale", () => {
  const r = calculateCommission({ items: [{ productId: 1, quantity: 1, total: 100 }], productsByWcId: {}, affiliate: {}, settings });
  assert.equal(r.amount, 35);
});

test("coaching promotion at 10% beats default and category rate", () => {
  const coaching = { id: "c1", categories: ["Coaching"], commissionEnabled: true };
  const ctx = { categoryRates: { coaching: { rateType: "PERCENTAGE", rate: 20 } }, promotions: [{ name: "Coaching packages", rateType: "PERCENTAGE", rate: 10, categories: ["coaching"], productIds: [] }] };
  const r = rateFor({ product: coaching, affiliate: {}, settings, ctx });
  assert.equal(r.rate, 10);
  assert.equal(r.promotion, "Coaching packages");
  const course = { id: "x", categories: ["Courses"], commissionEnabled: true };
  assert.equal(rateFor({ product: course, affiliate: {}, settings, ctx }).rate, 35);
});

test("product promotion is more specific than category or store-wide", () => {
  const p = { id: "p9", categories: ["Courses"] };
  const promos = [{ name: "store", productIds: [], categories: [] }, { name: "cat", productIds: [], categories: ["Courses"] }, { name: "prod", productIds: ["p9"], categories: [] }];
  assert.equal(promotionFor(p, promos).name, "prod");
  assert.equal(promotionFor({ id: "z", categories: ["Courses"] }, promos).name, "cat");
  assert.equal(promotionFor({ id: "z", categories: [] }, promos).name, "store");
});

test("promotion dates, pause and group limits", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const base = { active: true, groupIds: [] };
  assert.equal(promotionRunning({ ...base, startsAt: "2026-11-01", endsAt: "2026-11-30" }, {}, now), true);
  assert.equal(promotionRunning({ ...base, startsAt: "2026-12-01" }, {}, now), false);
  assert.equal(promotionRunning({ ...base, endsAt: "2026-11-01" }, {}, now), false);
  assert.equal(promotionRunning({ ...base, active: false }, {}, now), false);
  assert.equal(promotionRunning({ ...base, groupIds: ["vip"] }, { groupId: "other" }, now), false);
  assert.equal(promotionRunning({ ...base, groupIds: ["vip"] }, { groupId: "vip" }, now), true);
});

test("monthly payout date and 30-day clearing", () => {
  assert.equal(nextPayoutDate({ payoutDay: 1 }, new Date(2026, 9, 28)).toDateString(), new Date(2026, 10, 1).toDateString());
  assert.equal(nextPayoutDate({ payoutDay: 28 }, new Date(2026, 9, 28)).toDateString(), new Date(2026, 9, 28).toDateString());
  assert.equal(nextPayoutDate({ payoutDay: 31 }, new Date(2026, 1, 1)).getDate(), 28);
  assert.equal(isPayoutDay({ payoutDay: 1 }, new Date(2026, 10, 1)), true);
  const sale = new Date("2026-10-01T10:00:00Z");
  assert.equal(clearsAtFor(sale, { holdDays: 30 }).toISOString().slice(0, 10), "2026-10-31");
});
