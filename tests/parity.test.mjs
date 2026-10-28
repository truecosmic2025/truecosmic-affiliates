import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCommission, rateFor, tierRate, tierCommissions } from "../lib/commission.js";
import { render } from "../lib/notify-render.mjs";

const settings = { defaultRateType: "PERCENTAGE", defaultRate: 20, newProductsEarnCommission: true, flatRateBasis: "product" };

test("full precedence chain", () => {
  const product = { id: "p1", categories: ["Courses"], commissionEnabled: true };
  const affiliate = { rateType: "PERCENTAGE", rate: 25 };
  const ctx = {
    affiliateProductRates: { p1: { rateType: "PERCENTAGE", rate: 50 } },
    categoryRates: { courses: { rateType: "PERCENTAGE", rate: 30 } },
    group: { rateType: "PERCENTAGE", rate: 22 },
    tiers: [{ metric: "referrals", threshold: 0, rateType: "PERCENTAGE", rate: 21 }],
  };
  assert.equal(rateFor({ product, affiliate, settings, ctx }).via, "affiliate-product");
  delete ctx.affiliateProductRates.p1;
  assert.equal(rateFor({ product, affiliate, settings, ctx }).via, "category");
  ctx.categoryRates = {};
  assert.equal(rateFor({ product, affiliate, settings, ctx }).via, "affiliate");
  assert.equal(rateFor({ product, affiliate: {}, settings, ctx }).via, "group");
  ctx.group = null;
  assert.equal(rateFor({ product, affiliate: {}, settings, ctx }).via, "tier");
  ctx.tiers = [];
  assert.equal(rateFor({ product, affiliate: {}, settings: { ...settings, lifetimeRateType: "PERCENTAGE", lifetimeRate: 10 }, ctx: { ...ctx, kind: "lifetime" } }).rate, 10);
  assert.equal(rateFor({ product, affiliate: {}, settings, ctx }).via, "default");
});

test("tiered rates pick highest threshold reached", () => {
  const tiers = [
    { metric: "referrals", threshold: 10, rateType: "PERCENTAGE", rate: 25 },
    { metric: "referrals", threshold: 50, rateType: "PERCENTAGE", rate: 30 },
  ];
  assert.equal(tierRate(tiers, { referrals: 5 }), null);
  assert.equal(tierRate(tiers, { referrals: 12 }).rate, 25);
  assert.equal(tierRate(tiers, { referrals: 80 }).rate, 30);
});

test("flat rate per order vs per product", () => {
  const items = [{ productId: 1, quantity: 2, total: 100 }, { productId: 2, quantity: 1, total: 50 }];
  const aff = { rateType: "FLAT", rate: 10 };
  assert.equal(calculateCommission({ items, productsByWcId: {}, affiliate: aff, settings }).amount, 30);
  assert.equal(calculateCommission({ items, productsByWcId: {}, affiliate: aff, settings: { ...settings, flatRateBasis: "order" } }).amount, 10);
});

test("shipping and tax only included when switched on", () => {
  const items = [{ productId: 1, quantity: 1, total: 100 }];
  const order = { shipping: 10, tax: 20 };
  assert.equal(calculateCommission({ items, productsByWcId: {}, affiliate: {}, settings, order }).amount, 20);
  assert.equal(calculateCommission({ items, productsByWcId: {}, affiliate: {}, settings: { ...settings, includeShipping: true, includeTax: true }, order }).amount, 26);
});

test("multi-tier upline amounts", () => {
  assert.deepEqual(tierCommissions(200, [5, 2]), [{ level: 1, amount: 10 }, { level: 2, amount: 4 }]);
});

test("email template rendering", () => {
  assert.equal(render("Hi {first_name}, you earned {amount} {unknown}", { first_name: "Jane", amount: "£5.00" }), "Hi Jane, you earned £5.00 {unknown}");
});
