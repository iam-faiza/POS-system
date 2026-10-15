const PERMISSIONS = {
  ROLES_MANAGE: 'roles.manage',

  // Dashboard permissions
  DASHBOARD_VIEW_OWN: 'dashboard.view_own',
  DASHBOARD_VIEW_TEAM: 'dashboard.view_team',

  // Sales permissions
  SALES_VIEW_OWN: 'sales.view_own',
  SALES_VIEW_ALL: 'sales.view_all',
  SALES_CREATE: 'sales.create',

  // Product management
  PRODUCTS_MANAGE: 'products.manage',
  PRODUCTS_VIEW: 'products.view',

  // Inventory management
  INVENTORY_MANAGE: 'inventory.manage',
  INVENTORY_VIEW: 'inventory.view',

  // Employee/User management
  EMPLOYEES_MANAGE: 'employees.manage',

  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_MANAGE: 'customers.manage',
};

const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.DASHBOARD_VIEW_TEAM,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_MANAGE,
  ],
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

module.exports = {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_TEMPLATES
};