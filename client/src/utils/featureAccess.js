export function hasFeatureAccess(user, permissionRegistry, feature) {
  const userPermissions = new Set(user?.permissions || []);
  return (permissionRegistry || []).some((permission) => {
    const features = permission.features || (permission.feature ? [permission.feature] : []);
    return features.includes(feature) && userPermissions.has(permission.key);
  });
}

export function groupPermissionsByModule(permissionRegistry) {
  const modules = new Map();
  for (const permission of permissionRegistry || []) {
    if (!modules.has(permission.module)) modules.set(permission.module, []);
    modules.get(permission.module).push(permission);
  }
  return [...modules].map(([title, permissions]) => ({ title, permissions }));
}
