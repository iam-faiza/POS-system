function normalizeCategoryName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function categoryNameError(value) {
  const name = normalizeCategoryName(value);
  if (name.length < 2) return 'Category name must be at least 2 characters';
  if (name.length > 60) return 'Category name cannot exceed 60 characters';
  if (!/[\p{L}\p{N}]/u.test(name) || !/^[\p{L}\p{N}\s&().'-]+$/u.test(name)) {
    return 'Category name contains invalid characters';
  }
  return null;
}

function normalizeCategoryKey(value) {
  return normalizeCategoryName(value).toLocaleLowerCase('en');
}

module.exports = { categoryNameError, normalizeCategoryKey, normalizeCategoryName };