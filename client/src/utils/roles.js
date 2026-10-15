// Role names come from the database and may be capitalised ("Admin"), so compare case-insensitively.
export const isAdminUser = (user) => String(user?.role || '').toLowerCase() === 'admin';
