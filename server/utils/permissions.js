const PERMISSION_REGISTRY = [
  { name: 'ROLES_MANAGE', key: 'roles.manage', label: 'Manage Roles & Permissions', module: 'Administration & Staff', feature: 'roles' },
  { name: 'DASHBOARD_VIEW_OWN', key: 'dashboard.view_own', label: 'View Own Dashboard', module: 'Dashboard', feature: 'dashboard' },
  { name: 'DASHBOARD_VIEW_TEAM', key: 'dashboard.view_team', label: 'View Team Dashboard', module: 'Dashboard', feature: 'dashboard' },
  { name: 'SALES_VIEW_OWN', key: 'sales.view_own', label: 'View Own Sales', module: 'Sales & POS', feature: 'sales' },
  { name: 'SALES_VIEW_ALL', key: 'sales.view_all', label: 'View All Sales History', module: 'Sales & POS', feature: 'sales' },
  { name: 'SALES_CREATE', key: 'sales.create', label: 'Create Sales / Checkout', module: 'Sales & POS', feature: 'pos' },
  { name: 'PRODUCTS_MANAGE', key: 'products.manage', label: 'Manage Products & Categories', module: 'Products & Categories', features: ['products', 'categories'] },
  { name: 'PRODUCTS_VIEW', key: 'products.view', label: 'View Products', module: 'Products & Categories', features: ['products', 'categories'] },
  { name: 'INVENTORY_MANAGE', key: 'inventory.manage', label: 'Manage Inventory Adjustments', module: 'Inventory', features: ['products', 'categories'] },
  { name: 'INVENTORY_VIEW', key: 'inventory.view', label: 'View Inventory', module: 'Inventory', features: ['products', 'categories'] },
  { name: 'EMPLOYEES_MANAGE', key: 'employees.manage', label: 'Manage Employees', module: 'Administration & Staff', feature: 'employees' },
  { name: 'CUSTOMERS_VIEW', key: 'customers.view', label: 'View Customers', module: 'Customers', features: ['customers'] },
  { name: 'CUSTOMERS_CREATE', key: 'customers.create', label: 'Create Customers', module: 'Customers', features: ['customers'] },
  { name: 'CUSTOMERS_MANAGE', key: 'customers.manage', label: 'Manage & Archive Customers', module: 'Customers', features: ['customers'] },
  { name: 'REPORTS_VIEW', key: 'reports.view', label: 'View Reports', module: 'Reports', features: ['reports'] }
];

const PERMISSIONS = Object.fromEntries(PERMISSION_REGISTRY.map(({ name, key }) => [name, key]));

const DEFAULT_ROLE_PERMISSIONS = {
  admin: PERMISSION_REGISTRY.map(({ key }) => key),
  manager: [
    PERMISSIONS.DASHBOARD_VIEW_TEAM,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_MANAGE,
  ],
  cashier: [
    PERMISSIONS.DASHBOARD_VIEW_OWN,
    PERMISSIONS.SALES_VIEW_OWN,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
  ],
  'inventory clerk': [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
  ]
};

const ROLE_TEMPLATES = [
  {
    name: 'Admin',
    description: 'Full system access to all store operations, reports, staff, and settings.',
    permissions: DEFAULT_ROLE_PERMISSIONS.admin
  },
  {
    name: 'Manager',
    description: 'Oversees sales, inventory management, customer records, and team performance.',
    permissions: DEFAULT_ROLE_PERMISSIONS.manager
  },
  {
    name: 'Cashier',
    description: 'Handles POS checkout, customer lookup, and personal sales history.',
    permissions: DEFAULT_ROLE_PERMISSIONS.cashier
  },
  {
    name: 'Inventory Clerk',
    description: 'Manages stock counts, product catalog adjustments, and inventory tracking.',
    permissions: DEFAULT_ROLE_PERMISSIONS['inventory clerk']
  }
];

async function syncAdminRolePermissions(RoleModel) {
  return RoleModel.updateMany(
    { name: /^admin$/i },
    { $addToSet: { permissions: { $each: PERMISSION_REGISTRY.map(({ key }) => key) } } }
  );
}

module.exports = {
  PERMISSIONS,
  PERMISSION_REGISTRY,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_TEMPLATES,
  syncAdminRolePermissions
};