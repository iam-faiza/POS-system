const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildProfitReport } = require('../utils/profitReport');
const { parseCostPrice } = require('../utils/costPrice');
const { localDateKey, localHour } = require('../utils/salesFilters');

const TZ = 'Asia/Karachi';

test('cost price: empty means unknown, valid values are rounded to paisa', () => {
  assert.deepEqual(parseCostPrice(''), { value: null });
  assert.deepEqual(parseCostPrice(undefined), { value: null });
  assert.deepEqual(parseCostPrice(null), { value: null });
  assert.deepEqual(parseCostPrice('12.5'), { value: 12.5 });
  assert.deepEqual(parseCostPrice(0), { value: 0 });
});

test('cost price: rejects negatives, text and more than two decimals', () => {
  assert.ok(parseCostPrice(-1).error);
  assert.ok(parseCostPrice('abc').error);
  assert.ok(parseCostPrice(1.234).error);
});

function sale(overrides) {
  return {
    createdAt: '2026-10-15T05:30:00Z', // 10:30 in Karachi
    subtotal: 0,
    discount: 0,
    cashier: { _id: 'c1', name: 'Ali' },
    items: [],
    ...overrides
  };
}

const base = { timeZone: TZ, dayKey: localDateKey, hourOf: localHour };

test('gross profit uses cost on each line, net profit subtracts discounts', () => {
  const report = buildProfitReport({
    ...base,
    sales: [
      sale({
        discount: 50,
        items: [
          { productId: 'p1', name: 'Mouse', sku: 'M1', quantity: 2, price: 100, costPrice: 60 },
          { productId: 'p2', name: 'Pen', sku: 'P1', quantity: 1, price: 30, costPrice: 10 }
        ]
      })
    ]
  });
  assert.equal(report.summary.revenue, 230);
  assert.equal(report.summary.cost, 130);
  assert.equal(report.summary.grossProfit, 100);
  assert.equal(report.summary.discounts, 50);
  assert.equal(report.summary.netProfit, 50);
  assert.equal(report.summary.marginPercent, 43.48);
});

test('lines without a cost are excluded from profit and counted', () => {
  const report = buildProfitReport({
    ...base,
    sales: [
      sale({
        items: [
          { productId: 'p1', name: 'Mouse', sku: 'M1', quantity: 1, price: 100, costPrice: 70 },
          { productId: 'p9', name: 'Mystery', sku: 'X1', quantity: 2, price: 50 }
        ]
      })
    ]
  });
  assert.equal(report.summary.revenue, 200);
  assert.equal(report.summary.costedRevenue, 100);
  assert.equal(report.summary.grossProfit, 30);
  assert.equal(report.summary.itemsWithoutCost, 1);
  assert.equal(report.summary.salesWithoutCost, 1);
  const mystery = report.topProducts.find((p) => p.sku === 'X1');
  assert.equal(mystery.unknownLines, 1);
  assert.equal(mystery.grossProfit, 0);
});

test('no costed revenue means margin is null, not a divide-by-zero', () => {
  const report = buildProfitReport({
    ...base,
    sales: [sale({ items: [{ productId: 'p9', name: 'A', sku: 'A1', quantity: 1, price: 10 }] })]
  });
  assert.equal(report.summary.marginPercent, null);
  assert.equal(report.summary.grossProfit, 0);
});

test('days and hours follow the store time zone, not UTC', () => {
  // 20:30 UTC on 14 Oct is 01:30 on 15 Oct in Karachi.
  const report = buildProfitReport({
    ...base,
    sales: [sale({ createdAt: '2026-10-14T20:30:00Z', items: [{ productId: 'p1', name: 'A', sku: 'A1', quantity: 1, price: 10, costPrice: 5 }] })]
  });
  assert.equal(report.byDay[0].day, '2026-10-15');
  assert.equal(report.byHour[1].sales, 1);
  assert.equal(report.byHour[20].sales, 0);
});

test('hourly and daily breakdown add up to the summary', () => {
  const report = buildProfitReport({
    ...base,
    sales: [
      sale({ createdAt: '2026-10-15T05:30:00Z', items: [{ productId: 'p1', name: 'A', sku: 'A1', quantity: 1, price: 100, costPrice: 40 }] }),
      sale({ createdAt: '2026-10-15T08:00:00Z', items: [{ productId: 'p1', name: 'A', sku: 'A1', quantity: 2, price: 100, costPrice: 40 }] })
    ]
  });
  const hourlyRevenue = report.byHour.reduce((sum, h) => sum + h.revenue, 0);
  const dailyProfit = report.byDay.reduce((sum, d) => sum + d.grossProfit, 0);
  assert.equal(hourlyRevenue, report.summary.revenue);
  assert.equal(dailyProfit, report.summary.grossProfit);
  assert.equal(report.summary.salesCount, 2);
});

test('categories and cashiers are ranked by revenue', () => {
  const report = buildProfitReport({
    ...base,
    productCategory: new Map([['p1', 'cat1'], ['p2', 'cat2']]),
    categoryNames: new Map([['cat1', 'Groceries'], ['cat2', 'Stationery']]),
    sales: [
      sale({ cashier: { _id: 'c1', name: 'Ali' }, items: [{ productId: 'p1', name: 'Rice', sku: 'R1', quantity: 1, price: 500, costPrice: 400 }] }),
      sale({ cashier: { _id: 'c2', name: 'Sana' }, items: [{ productId: 'p2', name: 'Pen', sku: 'P1', quantity: 1, price: 50, costPrice: 20 }] })
    ]
  });
  assert.equal(report.byCategory[0].name, 'Groceries');
  assert.equal(report.byCashier[0].name, 'Ali');
  assert.equal(report.byCashier[1].sales, 1);
});

test('empty period returns zeros and 24 hour buckets', () => {
  const report = buildProfitReport({ ...base, sales: [] });
  assert.equal(report.summary.salesCount, 0);
  assert.equal(report.byHour.length, 24);
  assert.equal(report.summary.marginPercent, null);
});
