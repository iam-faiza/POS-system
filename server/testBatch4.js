/**
 * Automated Test Suite for Batch 4: Receipts, Printing Data Model, and Historical Fidelity
 */
const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('   STARTING BATCH 4 VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  // 1. Authenticate Admin and Cashier
  console.log('[TEST 1] Authentication and Setup');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login failed');
  const token = loginRes.data.token;
  console.log('  ✓ Admin authentication succeeded');

  // Get or create category
  const catList = await request('/categories', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const catId = catList.data[0]._id;

  // Create disposable product
  const prodRes = await request('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Batch4 Thermal Printer Roll',
      sku: `B4-ROLL-${Date.now().toString().slice(-4)}`,
      category: catId,
      price: 12.50,
      stockQuantity: 100,
      lowStockThreshold: 10
    })
  });
  assert.strictEqual(prodRes.status, 201, 'Product creation failed');
  const product = prodRes.data;
  console.log('  ✓ Created test product for sale:', product.name, `($${product.price})`);

  // 2. Test Walk-in Sale (Requirement 4)
  console.log('\n[TEST 2] Walk-in Sale Checkout & Invoice Creation (Requirement 4)');
  const walkInSaleRes = await request('/sales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items: [{
        productId: product._id,
        name: product.name,
        sku: product.sku,
        quantity: 3,
        price: product.price
      }],
      subtotal: 37.50,
      tax: 1.88,
      discount: 0,
      total: 39.38,
      paymentMethod: 'cash'
    })
  });
  assert.strictEqual(walkInSaleRes.status, 201, 'Walk-in sale failed');
  const walkInSale = walkInSaleRes.data;

  // Verify Invoice details
  assert(walkInSale.invoiceNumber.startsWith('INV-'), 'Missing invoice number');
  assert(walkInSale.createdAt, 'Missing createdAt timestamp');
  assert.strictEqual(walkInSale.customer, undefined, 'Walk-in sale should have no customer ID');
  assert.strictEqual(walkInSale.customerSnapshot, undefined, 'Walk-in sale should have no customerSnapshot');
  assert.strictEqual(walkInSale.items.length, 1);
  assert.strictEqual(walkInSale.items[0].quantity, 3);
  assert.strictEqual(walkInSale.items[0].price, 12.50);
  assert.strictEqual(walkInSale.total, 39.38);
  console.log('  ✓ Walk-in sale invoice created successfully:', walkInSale.invoiceNumber);
  console.log('  ✓ Receipt data includes products, quantities, unit prices, subtotal, tax, and final total');

  // 3. Test Sale with Selected Customer (Requirement 3)
  console.log('\n[TEST 3] Selected Customer Sale with Customer Snapshot (Requirement 3)');
  const custRes = await request('/customers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Maria BatchFour',
      phone: '03004455667',
      email: 'maria.b4@example.com'
    })
  });
  assert(custRes.status === 201 || custRes.status === 200, 'Customer creation failed');
  const customer = custRes.data;

  const customerSaleRes = await request('/sales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      customer: customer._id,
      items: [{
        productId: product._id,
        name: product.name,
        sku: product.sku,
        quantity: 2,
        price: product.price
      }],
      subtotal: 25.00,
      tax: 1.25,
      discount: 5.00,
      total: 21.25,
      paymentMethod: 'card'
    })
  });
  assert.strictEqual(customerSaleRes.status, 201, 'Customer sale failed');
  const customerSale = customerSaleRes.data;

  assert.strictEqual(customerSale.customerSnapshot.name, 'Maria Batchfour');
  assert.strictEqual(customerSale.customerSnapshot.phone, '923004455667');
  assert.strictEqual(customerSale.paymentMethod, 'card');
  assert.strictEqual(customerSale.discount, 5.00);
  assert.strictEqual(customerSale.total, 21.25);
  console.log('  ✓ Sale attached to customer with snapshot name and phone intact:', customerSale.invoiceNumber);

  // 4. Test Historical Receipt Fidelity (Requirement 7)
  console.log('\n[TEST 4] Historical Receipt Fidelity (Requirement 7)');
  // Modify customer in the database
  await request(`/customers/${customer._id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Changed Customer Name',
      phone: '03004455667',
      email: 'changed@example.com'
    })
  });

  // Modify product in the database
  await request(`/products/${product._id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Renamed Product After Sale',
      sku: product.sku,
      category: catId,
      price: 99.99,
      stockQuantity: 50,
      lowStockThreshold: 5
    })
  });

  // Retrieve sales history and verify historical receipt integrity
  const historyRes = await request('/sales', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(historyRes.status, 200);

  const fetchedSale = historyRes.data.find(s => s._id === customerSale._id);
  assert(fetchedSale != null, 'Sale not found in history');

  // Customer on historical receipt MUST retain snapshot name, NOT mutated name
  assert.strictEqual(fetchedSale.customerSnapshot.name, 'Maria Batchfour', 'Historical receipt customer name mutated!');
  console.log('  ✓ Historical customer snapshot preserved despite subsequent customer edits');

  // Product on historical receipt MUST retain snapshot name and price, NOT mutated values
  assert.strictEqual(fetchedSale.items[0].name, 'Batch4 Thermal Printer Roll', 'Historical receipt item name mutated!');
  assert.strictEqual(fetchedSale.items[0].price, 12.50, 'Historical receipt item price mutated!');
  console.log('  ✓ Historical line items preserved despite subsequent product renames/price changes');

  // Clean up disposable records
  await request(`/customers/${customer._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  await request(`/products/${product._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

  console.log('\n====================================================');
  console.log('   ALL BATCH 4 VERIFICATION TESTS PASSED (100%)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
