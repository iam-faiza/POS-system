const mongoose = require('mongoose');
// utils/salesAccess.js
function salesQueryForUser(user) {
  if (!user) return null;
  const permissions = user.permissions || [];
  const roleName = String(user.role || '').toLowerCase();
  const rawId = user.id || user._id;

  // Admins or users with all-sales / team-dashboard permissions see everything
  if (roleName === 'admin' || permissions.includes('sales.view_all') || permissions.includes('dashboard.view_team')) {
    return {};
  }
  
  // Cashiers or users with own-sales / own-dashboard permissions
  if (roleName === 'cashier' || roleName.includes('staff') || permissions.includes('sales.view_own') || permissions.includes('dashboard.view_own')) {
    if (rawId) {
      // Safely convert string ID to a Mongoose ObjectId so MongoDB matches it correctly
      const cashierId = mongoose.Types.ObjectId.isValid(rawId) && !(rawId instanceof mongoose.Types.ObjectId)
        ? new mongoose.Types.ObjectId(rawId)
        : rawId;
      return { cashier: cashierId };
    }
  }
  
  return null;
}

module.exports = { salesQueryForUser };