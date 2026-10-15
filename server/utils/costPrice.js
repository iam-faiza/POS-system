// Cost price is optional. null means "unknown", and such sales are left out of profit totals.
function parseCostPrice(value) {
  if (value === undefined || value === null || value === '') {
    return { value: null };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return { error: 'Cost price must be a number of zero or more, or left empty' };
  }
  if (Math.abs(number * 100 - Math.round(number * 100)) > 1e-7) {
    return { error: 'Cost price can have at most two decimal places' };
  }
  if (number > 10000000) {
    return { error: 'Cost price is too large' };
  }
  return { value: Math.round(number * 100) / 100 };
}

module.exports = { parseCostPrice };
