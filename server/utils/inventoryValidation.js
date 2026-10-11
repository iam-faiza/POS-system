function parseStockInteger(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function stockValueError(value, label) {
  return parseStockInteger(value) === null
    ? `${label} must be a non-negative safe whole number`
    : null;
}

module.exports = { parseStockInteger, stockValueError };