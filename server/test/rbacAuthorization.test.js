const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const { test } = require('node:test');
const { createEmployeeRouter } = require('../routes/employeeRoutes');
const { createReportRouter } = require('../routes/reportRoutes');
const { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, PERMISSION_REGISTRY, syncAdminRolePermissions } = require('../utils/permissions');

const ids = {
  admin: '507f1f77bcf86cd799439011',
  manager: '507f1f77bcf86cd799439012',
  managerPeer: '507f1f77bcf86cd799439013',
  cashier: '507f1f77bcf86cd799439014',
  adminRole: '607f1f77bcf86cd799439011',
  managerRole: '607f1f77bcf86cd799439012',
  cashierRole: '607f1f77bcf86cd799439013'
};

async function withHttpServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function makeEmployee(id, name, roleRef, role) {
  return {
    _id: id,
    name,
    email: `${name.toLowerCase()}@example.com`,
    role,
    roleRef,
    async save() { return this; },
    async deleteOne() { employees.delete(String(id)); }
  };
}

const adminRole = { _id: ids.adminRole, name: 'Admin', permissions: [] };
const managerRole = { _id: ids.managerRole, name: 'Manager', permissions: [PERMISSIONS.EMPLOYEES_MANAGE] };
const cashierRole = { _id: ids.cashierRole, name: 'Cashier', permissions: [] };
const roles = new Map([[ids.adminRole, adminRole], [ids.managerRole, managerRole], [ids.cashierRole, cashierRole]]);
const employees = new Map([
  [ids.admin, makeEmployee(ids.admin, 'Administrator', adminRole, 'admin')],
  [ids.manager, makeEmployee(ids.manager, 'Manager', managerRole, 'cashier')],
  [ids.managerPeer, makeEmployee(ids.managerPeer, 'Manager Peer', managerRole, 'cashier')],
  [ids.cashier, makeEmployee(ids.cashier, 'Cashier', cashierRole, 'cashier')]
]);

function employeeModel() {
  return {
    findOne: async () => null,
    findById(id) {
      const record = employees.get(String(id)) || null;
      const query = {
        populate() { return this; },
        select() { return this; },
        then(resolve, reject) { return Promise.resolve(record).then(resolve, reject); }
      };
      return query;
    },
    async countDocuments() {
      return [...employees.values()].filter((employee) =>
        String(employee.role || '').toLowerCase() === 'admin' ||
        [...roles.values()].some((role) => role.name.toLowerCase() === 'admin' && String(employee.roleRef?._id || employee.roleRef) === String(role._id))
      ).length;
    }
  };
}

async function request(baseUrl, path, method, body) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
}

test('Reports is registered centrally and the Admin sync is additive', async () => {
  assert.ok(PERMISSION_REGISTRY.some(({ key, features }) => key === 'reports.view' && features.includes('reports')));
  assert.equal(PERMISSIONS.REPORTS_VIEW, 'reports.view');
  assert.deepEqual(DEFAULT_ROLE_PERMISSIONS.admin, PERMISSION_REGISTRY.map(({ key }) => key));

  let update;
  await syncAdminRolePermissions({
    updateMany: async (filter, updateDoc) => { update = { filter, updateDoc }; }
  });
  assert.deepEqual(update.filter, { name: /^admin$/i });
  assert.ok(update.updateDoc.$addToSet.permissions.$each.includes('reports.view'));
  assert.equal(update.updateDoc.$set, undefined);
});

test('Reports API denies missing permission and permits reports.view', async () => {
  let permissions = ['sales.view_all'];
  const emptyQuery = (result) => ({
    select() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
  });
  const app = express();
  app.use('/api/reports', createReportRouter({
    protectMiddleware(req, res, next) { req.user = { permissions }; next(); },
    SaleModel: { find: () => emptyQuery([]) },
    ProductModel: { find: () => emptyQuery([]) },
    CategoryModel: { find: () => emptyQuery([]) }
  }));

  await withHttpServer(app, async (baseUrl) => {
    const denied = await request(baseUrl, '/api/reports/profit', 'GET');
    assert.equal(denied.status, 403);
    permissions = ['reports.view'];
    const allowed = await request(baseUrl, '/api/reports/profit', 'GET');
    assert.equal(allowed.status, 200);
  });
});

test('employee API enforces admin hierarchy, permits peer management, and protects the last admin', async () => {
  let actor = { id: ids.manager, role: 'Manager', permissions: [PERMISSIONS.EMPLOYEES_MANAGE] };
  const app = express();
  app.use(express.json());
  app.use('/api/employees', createEmployeeRouter({
    UserModel: employeeModel(),
    RoleModel: {
      find: async ({ name }) => [...roles.values()].filter((role) => name.test(role.name)),
      findById: async (id) => roles.get(String(id)) || null
    },
    mongooseClient: mongoose,
    protectMiddleware(req, res, next) { req.user = actor; next(); },
    checkPermissionMiddleware: (permission) => (req, res, next) =>
      req.user.permissions.includes(permission) ? next() : res.status(403).json({ message: 'Forbidden' })
  }));

  await withHttpServer(app, async (baseUrl) => {
    let response = await request(baseUrl, `/api/employees/${ids.admin}`, 'DELETE');
    assert.equal(response.status, 403);
    assert.ok(employees.has(ids.admin));

    response = await request(baseUrl, `/api/employees/${ids.admin}`, 'PUT', { name: 'Changed Admin' });
    assert.equal(response.status, 403);

    response = await request(baseUrl, `/api/employees/${ids.managerPeer}`, 'PUT', { roleRef: ids.adminRole });
    assert.equal(response.status, 403);

    response = await request(baseUrl, '/api/employees', 'POST', {
      name: 'New Administrator',
      email: 'new-admin@example.com',
      password: 'secure-password',
      roleRef: ids.adminRole
    });
    assert.equal(response.status, 403);

    response = await request(baseUrl, `/api/employees/${ids.cashier}`, 'PUT', { name: 'Updated Cashier' });
    assert.equal(response.status, 200);

    response = await request(baseUrl, `/api/employees/${ids.managerPeer}`, 'DELETE');
    assert.equal(response.status, 200);
    response = await request(baseUrl, `/api/employees/${ids.cashier}`, 'DELETE');
    assert.equal(response.status, 200);

    actor = { id: ids.admin, role: 'Admin', permissions: [PERMISSIONS.EMPLOYEES_MANAGE] };
    response = await request(baseUrl, `/api/employees/${ids.manager}`, 'DELETE');
    assert.equal(response.status, 200);

    actor = { id: ids.admin, role: 'Cashier', permissions: [] };
    response = await request(baseUrl, '/api/employees', 'GET');
    assert.equal(response.status, 403);

    actor = { id: ids.admin, role: 'Admin', permissions: [PERMISSIONS.EMPLOYEES_MANAGE] };
    response = await request(baseUrl, `/api/employees/${ids.admin}`, 'PUT', { roleRef: ids.cashierRole });
    assert.equal(response.status, 409);
    assert.ok(employees.has(ids.admin));
    response = await request(baseUrl, `/api/employees/${ids.admin}`, 'DELETE');
    assert.equal(response.status, 403);
    assert.ok(employees.has(ids.admin));
  });
});