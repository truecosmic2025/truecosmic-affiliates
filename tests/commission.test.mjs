import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCommission, rateFor, productKind } from "../lib/commission.js";

const settings = { defaultRateType: "PERCENTAGE", defaultRate: 20, newProductsEarnCommission: true };

test("global default percentage", () => {
  const r = calculateCommission({ items: [{ productId: 1, name: "Course", quantity: 1, total: 197 }], productsByWcId: {}, affiliate: {}, settings });
  assert.equal(r.amount, 39.4);
});

test("affiliate override beats default, product override beats affiliate", () => {
  const affiliate = { rateType: "PERCENTAGE", rate: 30 };
  const productsByWcId = { 1: { commissionEnabled: true }, 2: { commissionEnabled: true, rateType: "FLAT", rate: 15 } };
  const r = calculateCommission({
    items: [{ productId: 1, name: "Ebook", quantity: 1, total: 20 }, { productId: 2, name: "Coaching", quantity: 2, total: 600 }],
    productsByWcId, affiliate, settings,
  });
  assert.equal(r.amount, 6 + 30);
  assert.deepEqual(rateFor({ product: productsByWcId[2], affiliate, settings }), { type: "FLAT", rate: 15 });
});

test("disabled products earn nothing", () => {
  const r = calculateCommission({ items: [{ productId: 1, quantity: 1, total: 100 }], productsByWcId: { 1: { commissionEnabled: false } }, affiliate: {}, settings });
  assert.equal(r.amount, 0);
});

test("unknown products respect newProductsEarnCommission", () => {
  const r = calculateCommission({ items: [{ productId: 9, quantity: 1, total: 100 }], productsByWcId: {}, affiliate: {}, settings: { ...settings, newProductsEarnCommission: false } });
  assert.equal(r.amount, 0);
});

test("product kind detection", () => {
  assert.equal(productKind(["Courses"], "Manifesting 101"), "course");
  assert.equal(productKind([], "The Power of Awareness eBook"), "ebook");
  assert.equal(productKind(["Coaching"], "1-to-1 Session"), "coaching");
  assert.equal(productKind([], "Gift card"), "other");
});
