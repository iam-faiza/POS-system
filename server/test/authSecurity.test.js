const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { admin, createProtect } = require('../middleware/authMiddleware');
const { createAuthRouter } = require('../routes/authRoutes');
const { createLoginRateLimiter } = require('../security/loginRateLimit');
const { createSaleRouter } = require('../routes/saleRoutes');
const {
  corsOptionsForOrigins,
  getAllowedOrigins,
  isAllowedOrigin,
  validateJwtSecret
} = require('../security/securityConfig');
const { customerProjectionForRole, customerResponseForRole } = require('../utils/customerResponse');
const { salesQueryForUser } = require('../utils/salesAccess');
const { DEFAULT_ROLE_PERMISSIONS } = require('../utils/permissions');
const { canReadArchivedProducts, canReadLowStockThreshold } = require('../utils/productAccess');

const jwtSecret = 'isolated-auth-test-secret-at-least-32-bytes';
const userId = '507f1f77bcf86cd799439011';

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

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function runProtect(token, currentUser) {
  const middleware = createProtect({
    UserModel: {
      findById: () => ({ populate() { return this; }, select: async () => currentUser })
    },
    getSecret: () => jwtSecret
  });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = responseRecorder();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test('protect rejects missing, expired, and tampered JWTs', async () => {
  const missingResponse = responseRecorder();
  await createProtect({ getSecret: () => jwtSecret })(
    { headers: {} }, missingResponse, () => assert.fail('next must not run')
  );
  assert.equal(missingResponse.statusCode, 401);

  const expired = jwt.sign({ id: userId, role: 'admin' }, jwtSecret, { expiresIn: -1, algorithm: 'HS256' });
  const expiredResult = await runProtect(expired, { _id: userId, role: 'admin' });
  assert.equal(expiredResult.res.statusCode, 401);
  assert.equal(expiredResult.nextCalled, false);

  const valid = jwt.sign({ id: userId, role: 'admin' }, jwtSecret, { expiresIn: '1h', algorithm: 'HS256' });
  const tampered = `${valid.slice(0, -1)}${valid.endsWith('a') ? 'b' : 'a'}`;
  const tamperedResult = await runProtect(tampered, { _id: userId, role: 'admin' });
  assert.equal(tamperedResult.res.statusCode, 401);
  assert.equal(tamperedResult.nextCalled, false);
});

test('protect uses the current database role and rejects missing or invalid accounts', async (t) => {
  const staleAdminToken = jwt.sign({ id: userId, role: 'admin' }, jwtSecret, { expiresIn: '1h', algorithm: 'HS256' });
  const demoted = await runProtect(staleAdminToken, { _id: userId, role: 'cashier' });
  assert.equal(demoted.nextCalled, true);
  assert.deepEqual(demoted.req.user, {
    id: userId,
    role: 'cashier',
    permissions: DEFAULT_ROLE_PERMISSIONS.cashier
  });

  for (const account of [null, { _id: userId, role: 'owner' }]) {
    await t.test(account ? 'unknown role' : 'deleted account', async () => {
      const result = await runProtect(staleAdminToken, account);
      assert.equal(result.res.statusCode, 401);
      assert.equal(result.nextCalled, false);
    });
  }
});

test('admin middleware rejects cashiers and permits admins', () => {
  const cashierResponse = responseRecorder();
  let cashierNext = false;
  admin({ user: { role: 'cashier' } }, cashierResponse, () => { cashierNext = true; });
  assert.equal(cashierResponse.statusCode, 403);
  assert.equal(cashierNext, false);

  let adminNext = false;
  admin({ user: { role: 'admin' } }, responseRecorder(), () => { adminNext = true; });
  assert.equal(adminNext, true);
});

test('cashiers cannot request archived products while ordinary reads stay available', () => {
  assert.equal(canReadArchivedProducts('cashier', undefined), true);
  assert.equal(canReadArchivedProducts('cashier', 'false'), true);
  assert.equal(canReadArchivedProducts('cashier', 'true'), false);
  assert.equal(canReadArchivedProducts('admin', 'true'), true);
  assert.equal(canReadLowStockThreshold('cashier'), false);
  assert.equal(canReadLowStockThreshold('admin'), true);
});

test('sales visibility returns all records for admins and only owned sales for cashiers', () => {
  assert.deepEqual(salesQueryForUser({ id: userId, role: 'admin' }), {});
  const cashierQuery = salesQueryForUser({ id: userId, role: 'cashier' });
  assert.deepEqual(Object.keys(cashierQuery), ['cashier']);
  assert.equal(String(cashierQuery.cashier), userId);
  assert.equal(salesQueryForUser({ role: 'cashier' }), null);
});

test('sales history route scopes cashiers and keeps admin history unfiltered', async () => {
  const queries = [];
  const SaleModel = {
    find(query) {
      queries.push({ query, projection: null });
      const captured = queries[queries.length - 1];
      return {
        select(projection) {
          captured.projection = projection;
          return this;
        },
        populate() { return this; },
        sort() { return this; },
        skip(value) { captured.skip = value; return this; },
        limit(value) { captured.limit = value; return Promise.resolve([]); }
      };
    },
    countDocuments: async () => 0
  };
  const app = express();
  let role = 'cashier';
  app.use('/api/sales', createSaleRouter({
    SaleModel,
    protectMiddleware(req, res, next) {
      req.user = { id: userId, role };
      next();
    }
  }));

  await withHttpServer(app, async (baseUrl) => {
    const cashierResponse = await fetch(`${baseUrl}/api/sales?preset=today&page=2&limit=50`);
    assert.equal(cashierResponse.status, 200);
    assert.equal(String(queries[0].query.cashier), userId);
    assert.ok(queries[0].query.createdAt.$gte instanceof Date);
    assert.ok(queries[0].query.createdAt.$lt instanceof Date);
    assert.match(queries[0].projection, /-customerSnapshot\.email/);
    assert.equal(queries[0].skip, 50);
    assert.equal(queries[0].limit, 50);
    assert.equal(cashierResponse.headers.get('x-total-count'), '0');

    role = 'admin';
    const adminResponse = await fetch(`${baseUrl}/api/sales`);
    assert.equal(adminResponse.status, 200);
    assert.deepEqual(queries[1].query, {});
    assert.match(queries[1].projection, /-paymentDetails\.cardholderName/);
    assert.equal(queries[1].skip, 0);
    assert.equal(queries[1].limit, 25);
  });
});

test('dashboard summary scopes sales to the cashier and shows stock alerts only to admins', async () => {
  let stockQueries = 0;
  const SaleModel = {
    aggregate: async () => [{ saleCount: 3, revenue: 125.5 }]
  };
  const ProductModel = {
    aggregate: async (pipeline) => {
      stockQueries += 1;
      assert.deepEqual(pipeline[0].$match.isArchived, { $ne: true });
      return [{
        count: [{ value: 12 }],
        products: [{ _id: 'p1', name: 'Low item', stockQuantity: 1, lowStockThreshold: 2 }]
      }];
    }
  };
  const app = express();
  let role = 'cashier';
  app.use('/api/sales', createSaleRouter({
    SaleModel,
    ProductModel,
    protectMiddleware(req, res, next) {
      req.user = { id: userId, role };
      next();
    }
  }));
  await withHttpServer(app, async (baseUrl) => {
    const cashierResponse = await fetch(`${baseUrl}/api/sales/summary`);
    assert.equal(cashierResponse.status, 200);
    const cashierSummary = await cashierResponse.json();
    assert.equal(cashierSummary.salesToday, 3);
    assert.equal(cashierSummary.lowStockCount, undefined);
    assert.equal(cashierSummary.lowStockProducts, undefined);
    assert.equal(stockQueries, 0);

    role = 'admin';
    const response = await fetch(`${baseUrl}/api/sales/summary`);
    assert.equal(response.status, 200);
    const summary = await response.json();
    assert.equal(summary.salesToday, 3);
    assert.equal(summary.revenueToday, 125.5);
    assert.equal(summary.lowStockCount, 12);
    assert.equal(summary.lowStockProducts[0].name, 'Low item');
    assert.equal(stockQueries, 1);

    role = 'unknown-role';
    const forbidden = await fetch(`${baseUrl}/api/sales/summary`);
    assert.equal(forbidden.status, 403);
  });
});

test('login rejects invalid credentials generically, signs bcrypt-authenticated users, and rate-limits attempts', async () => {
  const passwordHash = await bcrypt.hash('correct horse battery', 4);
  const user = { _id: userId, name: 'Cashier', email: 'cashier@example.com', role: 'cashier', password: passwordHash };
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({
    UserModel: { findOne: ({ email }) => ({ populate: async () => email === user.email ? user : null }) },
    getSecret: () => jwtSecret,
    loginRateLimiter: createLoginRateLimiter({ maxAttempts: 2, windowMs: 60000 })
  }));

  await withHttpServer(app, async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'cashier@example.com', password: 'wrong' })
    });
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), { message: 'Invalid email or password' });

    const malformed = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'wrong' })
    });
    assert.equal(malformed.status, 401);
    assert.deepEqual(await malformed.json(), { message: 'Invalid email or password' });

    const limited = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'cashier@example.com', password: 'correct horse battery' })
    });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  });

  const appWithFreshLimit = express();
  appWithFreshLimit.use(express.json());
  appWithFreshLimit.use('/api/auth', createAuthRouter({
    UserModel: { findOne: () => ({ populate: async () => user }) },
    getSecret: () => jwtSecret,
    loginRateLimiter: createLoginRateLimiter({ maxAttempts: 2 })
  }));
  await withHttpServer(appWithFreshLimit, async (baseUrl) => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'correct horse battery' })
    });
    assert.equal(login.status, 200);
    const result = await login.json();
    assert.equal(result.role, 'cashier');
    assert.equal(jwt.verify(result.token, jwtSecret, { algorithms: ['HS256'] }).id, userId);
  });
});

test('CORS allowlist permits configured and local dev origins but rejects unrelated origins', () => {
  const developmentOrigins = getAllowedOrigins({ NODE_ENV: 'development' });
  assert.equal(isAllowedOrigin('http://localhost:5173', developmentOrigins), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173', developmentOrigins), true);
  assert.equal(isAllowedOrigin('https://attacker.example', developmentOrigins), false);
  assert.equal(isAllowedOrigin(undefined, developmentOrigins), true);

  const productionOrigins = getAllowedOrigins({
    NODE_ENV: 'production',
    CORS_ALLOWED_ORIGINS: 'https://pos.example, https://admin.example'
  });
  assert.equal(isAllowedOrigin('https://pos.example', productionOrigins), true);
  assert.equal(isAllowedOrigin('http://localhost:5173', productionOrigins), false);
  assert.throws(() => getAllowedOrigins({ NODE_ENV: 'production' }), /CORS_ALLOWED_ORIGINS/);
  assert.throws(() => getAllowedOrigins({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: '*' }), /exact HTTP or HTTPS origins/);
  assert.throws(() => getAllowedOrigins({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://pos.example/path' }), /exact HTTP or HTTPS origins/);

  const corsOptions = corsOptionsForOrigins(productionOrigins);
  assert.deepEqual(corsOptions.exposedHeaders, ['X-Total-Count', 'X-Page', 'X-Page-Size', 'X-Total-Pages']);
  corsOptions.origin('https://pos.example', (error, allowed) => {
    assert.equal(error, null);
    assert.equal(allowed, true);
  });
  corsOptions.origin('https://attacker.example', (error, allowed) => {
    assert.equal(error, null);
    assert.equal(allowed, false);
  });
});

test('JWT startup validation rejects absent or short secrets without returning the secret', () => {
  assert.equal(validateJwtSecret(jwtSecret), jwtSecret);
  assert.equal(validateJwtSecret('a'.repeat(24)), 'a'.repeat(24));
  assert.throws(() => validateJwtSecret('a'.repeat(23)), /at least 24 bytes/);
  assert.throws(() => validateJwtSecret(undefined), /at least 24 bytes/);
});

test('cashier customer fields stay sufficient for POS but omit email', () => {
  const customer = {
    _id: userId,
    name: 'Buyer',
    phone: '923001234567',
    email: 'buyer@example.com',
    marketingConsent: false,
    createdAt: new Date('2026-01-01T00:00:00Z')
  };
  const response = customerResponseForRole(customer, 'cashier');
  assert.deepEqual(Object.keys(response).sort(), ['_id', 'createdAt', 'name', 'phone']);
  assert.equal(customerProjectionForRole('cashier').includes('email'), false);
  assert.equal(customerProjectionForRole('admin'), null);
  assert.equal(response.marketingConsent, undefined);
});

test('custom roleRef permissions and legacy fallbacks are correctly resolved and enforced', async () => {
  const customRole = {
    _id: '607f1f77bcf86cd7994390ff',
    name: 'CustomStaff',
    permissions: ['customers.create']
  };

  const token = jwt.sign({ id: userId, role: 'cashier' }, jwtSecret, { expiresIn: '1h', algorithm: 'HS256' });

  const customResult = await runProtect(token, {
    _id: userId,
    role: 'cashier',
    roleRef: customRole
  });
  assert.equal(customResult.nextCalled, true);
  assert.deepEqual(customResult.req.user.permissions, ['customers.create']);
  assert.equal(customResult.req.user.role, 'CustomStaff');

  const legacyResult = await runProtect(token, {
    _id: userId,
    role: 'cashier',
    roleRef: null
  });
  assert.equal(legacyResult.nextCalled, true);
  assert.ok(legacyResult.req.user.permissions.includes('sales.create'));
  assert.equal(legacyResult.req.user.role, 'cashier');
});