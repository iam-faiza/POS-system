const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  SalesFilterError,
  buildSalesDateFilter,
  parseSalesPagination,
  zonedMidnightUtc
} = require('../utils/salesFilters');

test('sales date presets use store-local day boundaries and half-open ranges', () => {
  const now = new Date('2026-10-11T09:00:00.000Z');
  const today = buildSalesDateFilter({ preset: 'today' }, 'Asia/Karachi', now);
  assert.equal(today.createdAt.$gte.toISOString(), '2026-10-10T19:00:00.000Z');
  assert.equal(today.createdAt.$lt.toISOString(), '2026-10-11T19:00:00.000Z');

  const yesterday = buildSalesDateFilter({ preset: 'yesterday' }, 'Asia/Karachi', now);
  assert.equal(yesterday.createdAt.$gte.toISOString(), '2026-10-09T19:00:00.000Z');
  assert.equal(yesterday.createdAt.$lt.getTime(), today.createdAt.$gte.getTime());

  const mondayWeek = buildSalesDateFilter({ preset: 'week' }, 'Asia/Karachi', now);
  assert.equal(mondayWeek.createdAt.$gte.toISOString(), '2026-10-04T19:00:00.000Z');
  assert.equal(mondayWeek.createdAt.$lt.getTime(), today.createdAt.$lt.getTime());
});

test('specific date and custom range include the full local end date', () => {
  const specific = buildSalesDateFilter({ preset: 'date', date: '2026-10-11' }, 'Asia/Karachi');
  assert.equal(specific.createdAt.$gte.toISOString(), '2026-10-10T19:00:00.000Z');
  assert.equal(specific.createdAt.$lt.toISOString(), '2026-10-11T19:00:00.000Z');

  const range = buildSalesDateFilter({ preset: 'range', startDate: '2026-10-10', endDate: '2026-10-11' }, 'Asia/Karachi');
  assert.equal(range.createdAt.$gte.toISOString(), '2026-10-09T19:00:00.000Z');
  assert.equal(range.createdAt.$lt.toISOString(), '2026-10-11T19:00:00.000Z');
});

test('month/year boundaries and pagination caps are deterministic', () => {
  const now = new Date('2026-10-11T09:00:00.000Z');
  const month = buildSalesDateFilter({ preset: 'month' }, 'Asia/Karachi', now);
  assert.equal(month.createdAt.$gte.toISOString(), '2026-09-30T19:00:00.000Z');
  const year = buildSalesDateFilter({ preset: 'year' }, 'Asia/Karachi', now);
  assert.equal(year.createdAt.$gte.toISOString(), '2025-12-31T19:00:00.000Z');
  assert.deepEqual(parseSalesPagination({ page: '2', limit: '500' }), { page: 2, pageSize: 100, skip: 100 });
  assert.throws(() => parseSalesPagination({ page: 0 }), SalesFilterError);
});

test('date and timezone validation rejects invalid filters', () => {
  assert.throws(() => buildSalesDateFilter({ preset: 'date', date: '2026-02-30' }), SalesFilterError);
  assert.throws(() => buildSalesDateFilter({ preset: 'range', startDate: '2026-10-12', endDate: '2026-10-11' }), SalesFilterError);
  assert.throws(() => zonedMidnightUtc('2026-01-01', 'Not/AZone'), SalesFilterError);
  assert.equal(buildSalesDateFilter({ preset: 'all' }), null);
});