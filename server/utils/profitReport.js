// Builds profit figures from sold lines. Pure: takes plain data, returns plain data.
//
// Definitions (kept simple and stated in the UI):
// - revenue: price x quantity for every sold line, before discounts and tax.
// - gross profit: revenue minus cost, counted only for lines that have a cost price.
// - net profit: gross profit minus all sale discounts.
// - margin: gross profit / revenue of the lines that have a cost.
// Lines without a cost price are excluded from profit and counted in itemsWithoutCost.

const round2 = (n) => Math.round(n * 100) / 100;

function buildProfitReport({ sales = [], timeZone = 'Asia/Karachi', dayKey, hourOf, productCategory = new Map(), categoryNames = new Map() }) {
  const summary = {
    salesCount: 0,
    revenue: 0,
    costedRevenue: 0,
    cost: 0,
    grossProfit: 0,
    discounts: 0,
    netProfit: 0,
    marginPercent: null,
    itemsWithoutCost: 0,
    salesWithoutCost: 0
  };
  const days = new Map();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, sales: 0 }));
  const products = new Map();
  const categories = new Map();
  const cashiers = new Map();

  for (const sale of sales) {
    summary.salesCount += 1;
    summary.discounts += Number(sale.discount) || 0;
    const created = new Date(sale.createdAt);
    const day = dayKey(created, timeZone);
    const hour = hourOf(created, timeZone);
    const dayRow = days.get(day) || { day, revenue: 0, grossProfit: 0, sales: 0 };
    dayRow.sales += 1;
    hours[hour].sales += 1;

    const cashierId = String(sale.cashier?._id || sale.cashier || 'unknown');
    const cashierRow = cashiers.get(cashierId) || { name: sale.cashier?.name || 'Unknown', sales: 0, revenue: 0 };
    cashierRow.sales += 1;

    let saleHasUnknown = false;
    let saleRevenue = 0;
    for (const item of sale.items || []) {
      const quantity = Number(item.quantity) || 0;
      const lineRevenue = (Number(item.price) || 0) * quantity;
      const hasCost = typeof item.costPrice === 'number' && Number.isFinite(item.costPrice);
      const lineCost = hasCost ? item.costPrice * quantity : 0;
      const lineProfit = hasCost ? lineRevenue - lineCost : 0;

      saleRevenue += lineRevenue;
      summary.revenue += lineRevenue;
      if (hasCost) {
        summary.costedRevenue += lineRevenue;
        summary.cost += lineCost;
        summary.grossProfit += lineProfit;
        dayRow.grossProfit += lineProfit;
      } else {
        summary.itemsWithoutCost += 1;
        saleHasUnknown = true;
      }
      dayRow.revenue += lineRevenue;
      hours[hour].revenue += lineRevenue;

      const productKey = String(item.productId || item.sku || item.name);
      const product = products.get(productKey) || {
        productId: productKey, name: item.name, sku: item.sku, quantity: 0, revenue: 0, grossProfit: 0, unknownLines: 0
      };
      product.quantity += quantity;
      product.revenue += lineRevenue;
      product.grossProfit += lineProfit;
      if (!hasCost) product.unknownLines += 1;
      products.set(productKey, product);

      const categoryId = String(productCategory.get(String(item.productId)) || 'none');
      const category = categories.get(categoryId) || {
        name: categoryNames.get(categoryId) || 'Uncategorized', revenue: 0, grossProfit: 0
      };
      category.revenue += lineRevenue;
      category.grossProfit += lineProfit;
      categories.set(categoryId, category);
    }

    if (saleHasUnknown) summary.salesWithoutCost += 1;
    cashierRow.revenue += saleRevenue;
    cashiers.set(cashierId, cashierRow);
    days.set(day, dayRow);
  }

  summary.discounts = round2(summary.discounts);
  summary.revenue = round2(summary.revenue);
  summary.costedRevenue = round2(summary.costedRevenue);
  summary.cost = round2(summary.cost);
  summary.grossProfit = round2(summary.grossProfit);
  summary.netProfit = round2(summary.grossProfit - summary.discounts);
  summary.marginPercent = summary.costedRevenue > 0
    ? round2((summary.grossProfit / summary.costedRevenue) * 100)
    : null;

  const roundRows = (rows, keys) => rows.map((row) => {
    const out = { ...row };
    for (const key of keys) out[key] = round2(out[key]);
    return out;
  });

  return {
    summary,
    byDay: roundRows([...days.values()].sort((a, b) => a.day.localeCompare(b.day)), ['revenue', 'grossProfit']),
    byHour: roundRows(hours, ['revenue']),
    topProducts: roundRows([...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10), ['revenue', 'grossProfit']),
    byCategory: roundRows([...categories.values()].sort((a, b) => b.revenue - a.revenue), ['revenue', 'grossProfit']),
    byCashier: roundRows([...cashiers.values()].sort((a, b) => b.revenue - a.revenue), ['revenue'])
  };
}

module.exports = { buildProfitReport };
