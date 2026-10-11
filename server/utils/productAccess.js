function canReadArchivedProducts(role, includeArchived) {
  return includeArchived !== 'true' || role === 'admin';
}

function canReadLowStockThreshold(role) {
  return role === 'admin';
}

module.exports = { canReadArchivedProducts, canReadLowStockThreshold };