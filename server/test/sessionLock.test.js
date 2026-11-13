const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { createProtect } = require('../middleware/authMiddleware');
const { createAuthRouter } = require('../routes/authRoutes');
const { createEmployeeRouter } = require('../routes/employeeRoutes');
const { createReportRouter } = require('../routes/reportRoutes');
const { createSaleRouter } = require('../routes/saleRoutes');
const { hashPin } = require('../security/employeePin');

const secret = 'persistent-pos-session-lock-test-secret';
const pepper = 'persistent-pos-session-lock-test-pepper';
const ids = {
  admin: '507f1f77bcf86cd799439031',
  cashier: '507f1f77bcf86cd799439032'
};
const sessionIds = { admin: 'admin-session-token-id', cashier: 'cashier-session-token-id' };

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

function createMemoryModels(users) {
  const sessions = new Map();
  const query = (value) => ({
    populate() { return this; },
    select() { return Promise.resolve(value || null); },
    then(resolve, reject) { return Promise.resolve(value || null).then(resolve, reject); }
  });
  const UserModel = {
    findById(id) { return query(users.get(String(id))); },
    async updateOne({ _id }, update) {
      const user = users.get(String(_id));
      if (!user) return { matchedCount: 0 };
      for (const [key, value] of Object.entries(update.$set || {})) user[key] = value;
      for (const [key, value] of Object.entries(update.$inc || {})) user[key] = Number(user[key] || 0) + value;
      for (const key of Object.keys(update.$unset || {})) delete user[key];
      return { matchedCount: 1 };
    }
  };
  const SessionModel = {
    sessions,
    async findOneAndUpdate(filter, update) {
      let session = sessions.get(filter.sessionId);
      if (!session) {
        session = { ...update.$setOnInsert };
        sessions.set(filter.sessionId, session);
      }
      if (String(session.user) !== String(filter.user)) return null;
      return session;
    },
    async create(session) {
      sessions.set(session.sessionId, session);
      return session;
    },
    async updateOne(filter, update) {
      const session = sessions.get(filter.sessionId);
      if (!session || String(session.user) !== String(filter.user)) return { matchedCount: 0 };
      Object.assign(session, update.$set || {});
      return { matchedCount: 1 };
    }
  };
  return { UserModel, SessionModel };
}

function createApp({ UserModel, SessionModel }) {
  const protect = createProtect({ UserModel, SessionModel, getSecret: () => secret });
  const allowLocked = createProtect({
    UserModel,
    SessionModel,
    getSecret: () => secret,
    allowLockedSessions: true
  });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({
    UserModel,
    SessionModel,
    protectMiddleware: protect,
    allowLockedSessionMiddleware: allowLocked,
    getSecret: () => secret,
    getPinPepper: () => pepper
  }));
  app.use('/api/sales', createSaleRouter({
    protectMiddleware: protect,
    SaleModel: {},
    ProductModel: {},
    ShiftModel: {}
  }));
  app.use('/api/employees', createEmployeeRouter({
    UserModel,
    RoleModel: {},
    protectMiddleware: protect
  }));
  app.use('/api/reports', createReportRouter({
    protectMiddleware: protect,
    SaleModel: {},
    ProductModel: {},
    CategoryModel: {}
  }));
  return app;
}

function tokenFor(id, sessionId) {
  return jwt.sign({ id, jti: sessionId }, secret, { expiresIn: '1h', algorithm: 'HS256' });
}

async function api(baseUrl, token, endpoint, method = 'GET', body, headers = {}) {
  return fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...headers,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

test('locked session blocks direct sales, checkout, employee, and report APIs despite client manipulation', async () => {
  const adminPassword = await bcrypt.hash('admin-password', 4);
  const adminPin = await hashPin('2468', { pepper });
  const cashierPassword = await bcrypt.hash('cashier-password', 4);
  const users = new Map([
    [ids.admin, { _id: ids.admin, name: 'Admin', role: 'admin', password: adminPassword, pinHash: adminPin, pinFailedAttempts: 0 }],
    [ids.cashier, { _id: ids.cashier, name: 'Cashier', role: 'cashier', password: cashierPassword, pinFailedAttempts: 0 }]
  ]);
  const { UserModel, SessionModel } = createMemoryModels(users);
  const adminToken = tokenFor(ids.admin, sessionIds.admin);
  const cashierToken = tokenFor(ids.cashier, sessionIds.cashier);
  const app = createApp({ UserModel, SessionModel });

  await withHttpServer(app, async (baseUrl) => {
    let response = await api(baseUrl, adminToken, '/api/sales/settings');
    assert.equal(response.status, 200, 'unlocked authenticated session still works');

    response = await api(baseUrl, adminToken, '/api/auth/lock', 'POST');
    assert.equal(response.status, 200);
    assert.equal(SessionModel.sessions.get(sessionIds.admin).locked, true);

    response = await api(baseUrl, adminToken, '/api/auth/lock/status');
    assert.deepEqual(await response.json(), { locked: true, hasPin: true });
    response = await api(baseUrl, adminToken, '/api/auth/pin/status');
    assert.equal(response.status, 423, 'PIN management is not part of the locked-session allowlist');

    const clientManipulationHeaders = {
      'x-lock-screen-dom': 'removed',
      'x-react-state': 'unlocked'
    };
    response = await api(baseUrl, adminToken, '/api/sales/settings', 'GET', undefined, clientManipulationHeaders);
    assert.equal(response.status, 423);

    response = await api(baseUrl, adminToken, '/api/sales', 'POST', { items: [] }, clientManipulationHeaders);
    assert.equal(response.status, 423, 'checkout rejected before reaching sale creation');

    response = await api(baseUrl, adminToken, '/api/employees', 'GET', undefined, clientManipulationHeaders);
    assert.equal(response.status, 423);
    response = await api(baseUrl, adminToken, '/api/reports/profit', 'GET', undefined, clientManipulationHeaders);
    assert.equal(response.status, 423);

    response = await api(baseUrl, adminToken, '/api/auth/unlock', 'POST', { pin: '1111' });
    assert.equal(response.status, 401);
    response = await api(baseUrl, adminToken, '/api/auth/lock/status');
    assert.equal((await response.json()).locked, true);
    response = await api(baseUrl, adminToken, '/api/sales/settings');
    assert.equal(response.status, 423);

    response = await api(baseUrl, cashierToken, '/api/auth/unlock', 'POST', {
      pin: '2468', sessionId: sessionIds.admin
    });
    assert.equal(response.status, 401, 'another employee cannot use the Admin PIN or select its session');
    assert.equal(SessionModel.sessions.get(sessionIds.admin).locked, true);

    response = await api(baseUrl, adminToken, '/api/auth/unlock', 'POST', { pin: '2468' });
    assert.equal(response.status, 200);
    assert.equal(SessionModel.sessions.get(sessionIds.admin).locked, false);
    response = await api(baseUrl, adminToken, '/api/sales/settings');
    assert.equal(response.status, 200);

    response = await api(baseUrl, cashierToken, '/api/auth/lock', 'POST');
    assert.equal(response.status, 200);
    response = await api(baseUrl, cashierToken, '/api/auth/unlock', 'POST', { password: 'wrong-password' });
    assert.equal(response.status, 401);
    assert.equal(SessionModel.sessions.get(sessionIds.cashier).locked, true);
    response = await api(baseUrl, cashierToken, '/api/auth/unlock', 'POST', { password: 'cashier-password' });
    assert.equal(response.status, 200, 'password fallback unlocks the unconfigured PIN account');
    response = await api(baseUrl, cashierToken, '/api/sales/settings');
    assert.equal(response.status, 200);
  });
});

test('lock remains enforced after app and middleware recreation using the same persisted session store', async () => {
  const password = await bcrypt.hash('admin-password', 4);
  const users = new Map([[ids.admin, { _id: ids.admin, role: 'admin', password, pinFailedAttempts: 0 }]]);
  const { UserModel, SessionModel } = createMemoryModels(users);
  const token = tokenFor(ids.admin, sessionIds.admin);
  const firstApp = createApp({ UserModel, SessionModel });

  await withHttpServer(firstApp, async (baseUrl) => {
    const locked = await api(baseUrl, token, '/api/auth/lock', 'POST');
    assert.equal(locked.status, 200);
  });

  const restartedApp = createApp({ UserModel, SessionModel });
  await withHttpServer(restartedApp, async (baseUrl) => {
    const status = await api(baseUrl, token, '/api/auth/lock/status');
    assert.equal((await status.json()).locked, true);
    const denied = await api(baseUrl, token, '/api/sales/settings');
    assert.equal(denied.status, 423);
  });
});
