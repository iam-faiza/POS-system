function parseDiscountPercent(value) {
  if (value === undefined || value === null || value === '') {
    return { value: null };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    return { error: 'Discount must be between 0 and 100 percent, or left empty' };
  }
  if (Math.abs(number * 100 - Math.round(number * 100)) > 1e-7) {
    return { error: 'Discount percent can have at most two decimal places' };
  }
  const rounded = Math.round(number * 100) / 100;
  return { value: rounded === 0 ? null : rounded };
}

function parseDiscountActive(value, percent) {
  if (percent == null) return false;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function appliedDiscountPercent(product) {
  const percent = Number(product?.discountPercent);
  if (!product?.discountActive || !Number.isFinite(percent) || percent <= 0) return 0;
  return percent;
}

function discountedUnitCents(priceCents, percent) {
  if (!percent) return priceCents;
  return Math.round(priceCents * (100 - percent) / 100);
}

function lineDiscountCents(priceCents, quantity, percent) {
  return (priceCents - discountedUnitCents(priceCents, percent)) * quantity;
}

module.exports = {
  parseDiscountPercent,
  parseDiscountActive,
  appliedDiscountPercent,
  discountedUnitCents,
  lineDiscountCents
};
