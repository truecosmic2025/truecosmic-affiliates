import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCommission, rateFor, productKind } from "../lib/commission.js";

const settings = { defaultRateType: "PERCENTAGE", defaultRate: 35, newProductsEarnCommission: true, flatRateBasis: "product", eventsNeedAgreedRate: true };
const ticket = (extra = {}) => ({ id: "t1", kind: "event", coach: "Jane Coach", categories: ["Tickets"], commissionEnabled: true, ...extra });
const item = { productId: 900, name: "London Retreat", quantity: 2, total: 200 };

test("event without an agreed rate earns nothing (never the 35% default)", () => {
  const r = calculateCommission({ items: [item], productsByWcId: { 900: ticket({ coach: null }) }, affiliate: { rateType: "PERCENTAGE", rate: 25 }, settings, ctx: {} });
  assert.equal(r.amount, 0);
  assert.equal(r.lines[0].note, "event: no rate agreed yet");
});

test("coach deal sets the event rate, per ticket when flat", () => {
  const ctx = { coachDeals: { "jane coach": { coach: "Jane Coach", rateType: "PERCENTAGE", rate: 15 } } };
  assert.equal(calculateCommission({ items: [item], productsByWcId: { 900: ticket() }, affiliate: {}, settings, ctx }).amount, 30);
  const flat = { coachDeals: { "jane coach": { coach: "Jane Coach", rateType: "FLAT", rate: 20 } } };
  assert.equal(calculateCommission({ items: [item], productsByWcId: { 900: ticket() }, affiliate: {}, settings, ctx: flat }).amount, 40);
  assert.equal(rateFor({ product: ticket(), affiliate: {}, settings, ctx }).via, "coach");
});

test("event's own rate and promotions override the coach deal; affiliate-wide rates don't", () => {
  const ctx = { coachDeals: { "jane coach": { coach: "Jane Coach", rateType: "PERCENTAGE", rate: 15 } } };
  assert.equal(rateFor({ product: ticket({ rateType: "PERCENTAGE", rate: 12 }), affiliate: {}, settings, ctx }).rate, 12);
  const promo = { ...ctx, promotions: [{ name: "Launch week", rateType: "PERCENTAGE", rate: 20, productIds: ["t1"], categories: [] }] };
  assert.equal(rateFor({ product: ticket(), affiliate: {}, settings, ctx: promo }).rate, 20);
  assert.equal(rateFor({ product: ticket(), affiliate: { rateType: "PERCENTAGE", rate: 40 }, settings, ctx }).rate, 15);
});

test("setting off: events fall back to normal rates", () => {
  const r = calculateCommission({ items: [item], productsByWcId: { 900: ticket({ coach: null }) }, affiliate: {}, settings: { ...settings, eventsNeedAgreedRate: false }, ctx: {} });
  assert.equal(r.amount, 70);
});

test("ticket product types are classed as events", () => {
  assert.equal(productKind([], "Anything", "event_ticket"), "event");
  assert.equal(productKind(["Courses"], "Masterclass", "simple"), "course");
});

test("MemberPress memberships are their own product type", () => {
  assert.equal(productKind(["Memberships"], "Premium Membership", "membership"), "membership");
});
