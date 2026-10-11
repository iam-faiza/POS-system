/**
 * Automated Test Suite for Batch 3: Search, Filtering, and Bulk Management
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
  console.log('   STARTING BATCH 3 VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  // 1. Authenticate Admin and Cashier
  console.log('[TEST 1] Authentication and Authorization Checks');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('  ✓ Admin authentication succeeded');

  const cashierLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'cashier@example.com', password: 'cashier123' })
  });
  assert.strictEqual(cashierLogin.status, 200, 'Cashier login failed');
  const cashierToken = cashierLogin.data.token;
  console.log('  ✓ Cashier authentication succeeded');

  // 2. Customer Search Tests
  console.log('\n[TEST 2] Customer Search Functionality (Part A)');
  // Create a disposable test customer
  const custRes = await request('/customers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Zara BatchThree',
      phone: '03009911223',
      email: 'zara.batch3@example.com',
      marketingConsent: true
    })
  });
  assert.strictEqual(custRes.status, 201, 'Failed to create test customer');
  const testCustId = custRes.data._id;
  console.log('  ✓ Created disposable test customer:', custRes.data.name, custRes.data.phone);

  // Search by name (case-insensitive)
  const searchName = await request('/customers?search=zara', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(searchName.data.some(c => c._id === testCustId), 'Search by name failed');
  console.log('  ✓ Customer search by name (case-insensitive) passed');

  // Search by phone number (canonical or unformatted)
  const searchPhone = await request('/customers?search=03009911223', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(searchPhone.data.some(c => c._id === testCustId), 'Search by raw phone failed');
  console.log('  ✓ Customer search by raw phone number passed');

  const searchPhoneCanon = await request('/customers?search=923009911223', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(searchPhoneCanon.data.some(c => c._id === testCustId), 'Search by canonical phone passed');
  console.log('  ✓ Customer search by canonical phone passed');

  // Search by email (case-insensitive)
  const searchEmail = await request('/customers?search=ZARA.BATCH3', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(searchEmail.data.some(c => c._id === testCustId), 'Search by email failed');
  console.log('  ✓ Customer search by email passed');

  // Search with no matches
  const searchEmpty = await request('/customers?search=xyzNonExistent9999', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(searchEmpty.data.length, 0, 'Empty search should return 0 results');
  console.log('  ✓ Empty search handling passed');

  // 3. Product Search and Category Filtering Tests
  console.log('\n[TEST 3] Product Search & Category Filtering (Part D)');
  // Get an existing category or create one
  const catList = await request('/categories', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const catId = catList.data[0]._id;

  // Create two disposable test products
  const prod1Res = await request('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Batch3 Gaming Headset',
      sku: `B3-HEAD-${Date.now().toString().slice(-4)}`,
      category: catId,
      price: 89.99,
      stockQuantity: 25,
      lowStockThreshold: 5
    })
  });
  assert.strictEqual(prod1Res.status, 201, 'Failed to create product 1');
  const prod1 = prod1Res.data;

  const prod2Res = await request('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Batch3 Webcam Pro',
      sku: `B3-CAM-${Date.now().toString().slice(-4)}`,
      category: catId,
      price: 49.99,
      stockQuantity: 15,
      lowStockThreshold: 3
    })
  });
  assert.strictEqual(prod2Res.status, 201, 'Failed to create product 2');
  const prod2 = prod2Res.data;
  console.log('  ✓ Created test products:', prod1.name, 'and', prod2.name);

  // Search product by name (case-insensitive)
  const searchProdName = await request('/products?search=headset', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(searchProdName.data.some(p => p._id === prod1._id), 'Search by product name failed');
  console.log('  ✓ Product search by name passed');

  // Search product by SKU
  const searchProdSku = await request(`/products?search=${prod2.sku.toLowerCase()}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(searchProdSku.data.some(p => p._id === prod2._id), 'Search by product SKU failed');
  console.log('  ✓ Product search by SKU (case-insensitive) passed');

  // Filter by category
  const filterCat = await request(`/products?category=${catId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(filterCat.data.some(p => p._id === prod1._id), 'Category filter failed');
  assert(filterCat.data.some(p => p._id === prod2._id), 'Category filter failed');
  console.log('  ✓ Category filtering passed');

  // Combined search + category filter
  const combined = await request(`/products?category=${catId}&search=webcam`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(combined.data.some(p => p._id === prod2._id), 'Combined search + category failed');
  assert(!combined.data.some(p => p._id === prod1._id), 'Combined search should exclude non-matching');
  console.log('  ✓ Combined search and category filtering passed');

  // 4. Role Authorization on Deletion
  console.log('\n[TEST 4] Authorization Guards on Destructive Actions');
  // Cashier attempt individual customer delete -> should be 403 Forbidden
  const cashierDeleteCust = await request(`/customers/${testCustId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  assert.strictEqual(cashierDeleteCust.status, 403, 'Cashier should NOT be allowed to delete customer');
  console.log('  ✓ Cashier blocked from individual customer deletion (403 Forbidden)');

  // Cashier attempt bulk customer delete -> should be 403 Forbidden
  const cashierBulkCust = await request('/customers', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  assert.strictEqual(cashierBulkCust.status, 403, 'Cashier should NOT be allowed bulk customer deletion');
  console.log('  ✓ Cashier blocked from bulk customer deletion (403 Forbidden)');

  // Cashier attempt individual product delete -> should be 403 Forbidden
  const cashierDeleteProd = await request(`/products/${prod1._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  assert.strictEqual(cashierDeleteProd.status, 403, 'Cashier should NOT be allowed to delete product');
  console.log('  ✓ Cashier blocked from individual product deletion (403 Forbidden)');

  // Cashier attempt bulk product delete -> should be 403 Forbidden
  const cashierBulkProd = await request('/products', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cashierToken}` }
  });
  assert.strictEqual(cashierBulkProd.status, 403, 'Cashier should NOT be allowed bulk product deletion');
  console.log('  ✓ Cashier blocked from bulk product deletion (403 Forbidden)');

  // 5. Individual Deletion of Unreferenced Records (Part B & Part E)
  console.log('\n[TEST 5] Individual Deletion for Unreferenced Records');
  // Delete test customer with no sales
  const delCustRes = await request(`/customers/${testCustId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(delCustRes.status, 200);
  assert.strictEqual(delCustRes.data.deleted, true, 'Customer with no sales should be permanently deleted');
  console.log('  ✓ Individual customer with no sales deleted permanently');

  // Delete test product 1 with no sales
  const delProdRes = await request(`/products/${prod1._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(delProdRes.status, 200);
  assert.strictEqual(delProdRes.data.deleted, true, 'Product with no sales should be permanently deleted');
  console.log('  ✓ Individual product with no sales deleted permanently');

  // 6. Safe Archival and Historical Transactions Preservation (Part B, Part E, and Receipts)
  console.log('\n[TEST 6] Historical Transactions & Receipt Preservation');
  // Create customer C and product S
  const custC = (await request('/customers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Historical Customer',
      phone: '03007788990',
      email: 'history@example.com'
    })
  })).data;

  const prodS = (await request('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Historical Headphone',
      sku: `HIST-HP-${Date.now().toString().slice(-4)}`,
      category: catId,
      price: 30,
      stockQuantity: 10,
      lowStockThreshold: 2
    })
  })).data;

  // Process a sale with customer C and product S
  const saleRes = await request('/sales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      customer: custC._id,
      items: [{
        productId: prodS._id,
        name: prodS.name,
        sku: prodS.sku,
        quantity: 2,
        price: prodS.price
      }],
      subtotal: 60,
      tax: 3,
      discount: 0,
      total: 63,
      paymentMethod: 'cash'
    })
  });
  assert.strictEqual(saleRes.status, 201, 'Failed to process sale');
  const savedSale = saleRes.data;
  console.log('  ✓ Created sale invoice:', savedSale.invoiceNumber);

  // Now, attempt to delete customer C (who has historical sales)
  const delCustC = await request(`/customers/${custC._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(delCustC.status, 200);
  assert.strictEqual(delCustC.data.archived, true, 'Customer with sales should be ARCHIVED, not dropped');
  console.log('  ✓ Customer with sales safely archived:', delCustC.data.message);

  // Attempt to delete product S (which is referenced in the sale)
  const delProdS = await request(`/products/${prodS._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(delProdS.status, 200);
  assert.strictEqual(delProdS.data.archived, true, 'Product with sales should be ARCHIVED, not dropped');
  console.log('  ✓ Product with sales safely archived:', delProdS.data.message);

  // Verify historical sale still references customer and item details intact!
  const salesList = await request('/sales', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const checkSale = salesList.data.find(s => s._id === savedSale._id);
  assert(checkSale != null, 'Historical sale should remain intact');
  assert.strictEqual(checkSale.items[0].name, 'Historical Headphone', 'Historical item snapshot preserved');
  assert.strictEqual(checkSale.customerSnapshot.name, 'Historical Customer', 'Customer snapshot preserved');
  console.log('  ✓ Verified receipt and historical invoice remain 100% intact');

  // Clean up product 2 and the test sale
  await request(`/products/${prod2._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });

  console.log('\n====================================================');
  console.log('   ALL BATCH 3 VERIFICATION TESTS PASSED (100%)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
