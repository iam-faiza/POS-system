const assert = require('assert');
const {
  formatCustomerName,
  validateEmail,
  validatePhone,
  validateCustomer
} = require('./utils/customerValidation');

console.log('--- Testing Customer Name Capitalization ---');
assert.strictEqual(formatCustomerName('john doe'), 'John Doe');
assert.strictEqual(formatCustomerName('JOHN DOE'), 'John Doe');
assert.strictEqual(formatCustomerName('mary-jane'), 'Mary-Jane');
assert.strictEqual(formatCustomerName("o'connor"), "O'Connor");
console.log('✓ Name capitalization passed');

console.log('--- Testing Canonical Phone Normalization ---');
// 03001234567 -> 923001234567
const p1 = validatePhone('03001234567');
assert.strictEqual(p1.normalized, '923001234567');

// +923001234567 -> 923001234567
const p2 = validatePhone('+923001234567');
assert.strictEqual(p2.normalized, '923001234567');

// 923001234567 -> 923001234567
const p3 = validatePhone('923001234567');
assert.strictEqual(p3.normalized, '923001234567');

// 00923001234567 -> 923001234567
const p4 = validatePhone('00923001234567');
assert.strictEqual(p4.normalized, '923001234567');

// Invalid lengths
assert(validatePhone('123').error !== null);
assert(validatePhone('03001234567890123').error !== null);
console.log('✓ Phone normalization passed');

console.log('--- Testing Duplicate Prevention Logic Simulation ---');
const c1 = validateCustomer({ name: 'Ali Raza', phone: '03001234567' });
const c2 = validateCustomer({ name: 'Ali Raza', phone: '+923001234567' });
// Both should have same phone
assert.strictEqual(c1.data.phone, c2.data.phone);
assert.strictEqual(c1.data.phone, '923001234567');
console.log('✓ Duplicate prevention simulation passed');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
