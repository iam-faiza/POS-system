export function appliedDiscountPercent(product) {
  const percent = Number(product?.discountPercent);
  if (!product?.discountActive || !Number.isFinite(percent) || percent <= 0) return 0;
  return percent;
}

export function discountedUnitPrice(listPrice, percent) {
  const priceCents = Math.round(Number(listPrice) * 100);
  if (!percent) return priceCents / 100;
  return Math.round(priceCents * (100 - percent) / 100) / 100;
}

export function lineDiscountAmount(listPrice, quantity, percent) {
  const priceCents = Math.round(Number(listPrice) * 100);
  const saleCents = percent ? Math.round(priceCents * (100 - percent) / 100) : priceCents;
  return ((priceCents - saleCents) * quantity) / 100;
}
