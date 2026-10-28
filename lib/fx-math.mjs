// Pure helper shared by lib/fx.js and the unit tests
export function convert(amount, rate) {
  return Math.round((Number(amount) * Number(rate) + Number.EPSILON) * 100) / 100;
}
