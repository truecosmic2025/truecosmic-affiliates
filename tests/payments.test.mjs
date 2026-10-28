import { test } from "node:test";
import assert from "node:assert/strict";
import { convert } from "../lib/fx-math.mjs";
import { validateDetails, payTo, describe } from "../lib/payoutMethods.js";

test("currency conversion rounds to cents", () => {
  assert.equal(convert(206.99, 1.2534), 259.44);
  assert.equal(convert(100, 1), 100);
  assert.equal(convert(0.1 + 0.2, 1), 0.3);
});

test("payout details validation per method", () => {
  const get = (o) => (k) => o[k];
  assert.deepEqual(validateDetails("paypal", get({ email: "Jane@Example.com" })), { method: "paypal", details: { email: "jane@example.com" } });
  assert.match(validateDetails("paypal", get({ email: "nope" })).error, /email/);
  assert.match(validateDetails("wise", get({ email: "a@b.co", currency: "USD" })).error, /name/i);
  assert.match(validateDetails("wise", get({ name: "A", email: "a@b.co", currency: "XYZ" })).error, /valid option/);
  assert.equal(validateDetails("wise", get({ name: "Ann", email: "a@b.co", currency: "GBP" })).details.currency, "GBP");
  assert.match(validateDetails("other", get({})).error, /required/);
  assert.match(validateDetails("bitcoin", get({})).error, /Choose/);
});

test("PayPal destination follows paymentEmail; others use stored details", () => {
  assert.equal(payTo({ payoutMethod: "paypal", paymentEmail: "pp@x.com", email: "login@x.com" }).details.email, "pp@x.com");
  assert.equal(payTo({ email: "login@x.com" }).details.email, "login@x.com");
  const wise = payTo({ payoutMethod: "wise", payoutDetails: { name: "Ann", email: "w@x.com", currency: "USD" } });
  assert.equal(describe(wise), "Wise · Ann · w@x.com · USD");
});
