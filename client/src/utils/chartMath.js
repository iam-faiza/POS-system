// Chart helpers. Pure functions, so they can be tested without a browser.

// Rounds a value up to a readable axis maximum: 1, 2, 2.5, 5 or 10 times a power of ten.
export function niceMax(value) {
  if (!(value > 0)) return 1;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exponent;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return step * exponent;
}

// Share of the full bar height a value should fill, clamped to 0..1.
export function barRatio(value, max) {
  if (!max || !(value > 0)) return 0;
  return Math.min(1, value / max);
}
