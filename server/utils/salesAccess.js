function salesQueryForUser(user) {
  if (user?.role === 'admin') return {};
  if (user?.role === 'cashier' && user.id) return { cashier: user.id };
  return null;
}

module.exports = { salesQueryForUser };