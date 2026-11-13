const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { createProtect } = require('../middleware/authMiddleware');
const { createAuthRouter } = require('../routes/authRoutes');

const jwtSecret = 'employee-pin-test-secret-with-enough-entropy';
const pinPepper = 'test-only-independent-pin-pepper';
const ids = {
  cashierA: '507f1f77bcf86cd799439021',
  cashierB: '507f1f77bcf86cd799439022',
  cashierC: '507f1f77bcf86cd799439023'
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

function queryFor(user) {
  return {
    populate() { return this; },
    select() { return Promise.resolve(user || null); },
    then(resolve, reject) { return Promise.resolve(user || null).then(resolve, reject); }
  };
}

function createUserModel(users) {
  return {
    findById(id) { return queryFor(users.get(String(id))); },
    async updateOne({ _id }, update) {
      const user = users.get(String(_id));
      if (!user) return { matchedCount: 0 };
      for (const [key, value] of Object.entries(update.$set || {})) user[key] = value;
      for (const [key, value] of Object.entries(update.$inc || {})) user[key] = Number(user[key] || 0) + value;
      for (const key of Object.keys(update.$unset || {})) delete user[key];
      return { matchedCount: 1 };
    }
  };
}

function createSessionModel() {
  const sessions = new Map();
  return {
    sessions,
    async findOneAndUpdate(filter, update) {
      let session = sessions.get(filter.sessionId);
      if (!session) {
        session = { ...update.$setOnInsert };
        sessions.set(filter.sessionId, session);
      }
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
}

function makeAccount(id, name, password) {
  return { _id: id, name, email: `${name}@example.com`, role: 'cashier', password, pinFailedAttempts: 0 };
}

async function apiRequest(baseUrl, token, endpoint, method = 'GET', body) {
  return fetch(`${baseUrl}/api/auth${endpoint}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

function createToken(id) {
  return jwt.sign({ id }, jwtSecret, { expiresIn: '1h', algorithm: 'HS256' });
}

test('optional employee PIN lifecycle, isolation, password fallback, and lockout', async () => {
  const users = new Map([
    [ids.cashierA, makeAccount(ids.cashierA, 'cashier-a', await bcrypt.hash('account-password-a', 4))],
    [ids.cashierB, makeAccount(ids.cashierB, 'cashier-b', await bcrypt.hash('account-password-b', 4))],
    [ids.cashierC, makeAccount(ids.cashierC, 'cashier-c', await bcrypt.hash('account-password-c', 4))]
  ]);
  const UserModel = createUserModel(users);
  const SessionModel = createSessionModel();
  const protectMiddleware = createProtect({ UserModel, SessionModel, getSecret: () => jwtSecret });
  const allowLockedSessionMiddleware = createProtect({
    UserModel,
    SessionModel,
    getSecret: () => jwtSecret,
    allowLockedSessions: true
  });
  let currentTime = Date.now();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({
    UserModel,
    SessionModel,
    protectMiddleware,
    allowLockedSessionMiddleware,
    getSecret: () => jwtSecret,
    getPinPepper: () => pinPepper,
    now: () => currentTime
  }));
  const tokens = Object.fromEntries(Object.entries(ids).map(([name, id]) => [name, createToken(id)]));

  await withHttpServer(app, async (baseUrl) => {
    let response = await apiRequest(baseUrl, tokens.cashierA, '/pin/status');
    assert.deepEqual(await response.json(), { hasPin: false });

    response = await apiRequest(baseUrl, tokens.cashierA, '/unlock', 'POST', { password: 'account-password-a' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { unlocked: true });

    for (const invalidPin of ['123', '12345', '12a4', 1234]) {
      response = await apiRequest(baseUrl, tokens.cashierA, '/pin', 'POST', { pin: invalidPin, confirmPin: invalidPin });
      assert.equal(response.status, 400);
    }
    response = await apiRequest(baseUrl, tokens.cashierA, '/pin', 'POST', { pin: '0017', confirmPin: '0018' });
    assert.equal(response.status, 400);

    response = await apiRequest(baseUrl, tokens.cashierA, '/pin', 'POST', { pin: '0042', confirmPin: '0042', userId: ids.cashierB });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hasPin: true, message: 'PIN set successfully' });
    assert.notEqual(users.get(ids.cashierA).pinHash, '0042');

    response = await apiRequest(baseUrl, tokens.cashierA, '/pin/status');
    assert.deepEqual(await response.json(), { hasPin: true });

    response = await apiRequest(baseUrl, tokens.cashierA, '/unlock', 'POST', { pin: '1234' });
    assert.equal(response.status, 401);
    response = await apiRequest(baseUrl, tokens.cashierA, '/unlock', 'POST', { pin: '0042' });
    assert.equal(response.status, 200);

    response = await apiRequest(baseUrl, tokens.cashierB, '/pin', 'POST', { pin: '1234', confirmPin: '1234' });
    assert.equal(response.status, 200);
    response = await apiRequest(baseUrl, tokens.cashierA, '/unlock', 'POST', { pin: '1234' });
    assert.equal(response.status, 401);
    response = await apiRequest(baseUrl, tokens.cashierB, '/unlock', 'POST', { pin: '1234' });
    assert.equal(response.status, 200);

    response = await apiRequest(baseUrl, tokens.cashierA, '/pin', 'POST', {
      currentPin: '0042', pin: '0007', confirmPin: '0007'
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'PIN updated successfully');
    response = await apiRequest(baseUrl, tokens.cashierA, '/unlock', 'POST', { pin: '0042' });
    assert.equal(response.status, 401);
    response = await apiRequest(baseUrl, tokens.cashierA, '/unlock', 'POST', { pin: '0007' });
    assert.equal(response.status, 200);

    response = await apiRequest(baseUrl, tokens.cashierA, '/pin', 'DELETE', { currentPin: '0007' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hasPin: false, message: 'PIN removed successfully' });
    assert.equal(users.get(ids.cashierA).pinHash, undefined);
    response = await apiRequest(baseUrl, tokens.cashierA, '/unlock', 'POST', { password: 'account-password-a' });
    assert.equal(response.status, 200);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await apiRequest(baseUrl, tokens.cashierC, '/unlock', 'POST', { password: 'incorrect' });
      assert.equal(response.status, 401);
    }
    response = await apiRequest(baseUrl, tokens.cashierC, '/unlock', 'POST', { password: 'incorrect' });
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get('retry-after')) > 0);
    response = await apiRequest(baseUrl, tokens.cashierC, '/unlock', 'POST', { password: 'account-password-c' });
    assert.equal(response.status, 429);
    currentTime += 15 * 60 * 1000 + 1;
    response = await apiRequest(baseUrl, tokens.cashierC, '/unlock', 'POST', { password: 'account-password-c' });
    assert.equal(response.status, 200);
  });
});

test('PIN APIs do not reveal hashes and cannot act on another user by request body ID', async () => {
  const users = new Map([[ids.cashierA, makeAccount(ids.cashierA, 'cashier-a', 'irrelevant')]]);
  const UserModel = createUserModel(users);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({
    UserModel,
    SessionModel: createSessionModel(),
    protectMiddleware(req, res, next) { req.user = { id: ids.cashierA }; next(); },
    getPinPepper: () => pinPepper
  }));

  await withHttpServer(app, async (baseUrl) => {
    const response = await apiRequest(baseUrl, 'unused-test-token', '/pin', 'POST', {
      userId: ids.cashierB, pin: '0099', confirmPin: '0099'
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.hasPin, true);
    assert.equal(body.pinHash, undefined);
    assert.equal(users.has(ids.cashierB), false);
  });
});
