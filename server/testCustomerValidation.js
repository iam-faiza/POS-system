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
assert.strictEqual(formatCustomerName('john DOE'), 'John Doe');
assert.strictEqual(formatCustomerName('mary-jane'), 'Mary-Jane');
assert.strictEqual(formatCustomerName("o'connor"), "O'Connor");
assert.strictEqual(formatCustomerName("d'angelo"), "D'Angelo");
assert.strictEqual(formatCustomerName("al-mansoor"), "Al-Mansoor");
assert.strictEqual(formatCustomerName("  ali   khan  "), "Ali Khan");
console.log('✓ Name capitalization passed');

console.log('--- Testing Customer Name Validation ---');
assert(validateCustomer({ name: '', phone: '03001234567' }).error.includes('required'));
assert(validateCustomer({ name: 'a', phone: '03001234567' }).error.includes('at least 2 characters'));
assert(validateCustomer({ name: '   x   ', phone: '03001234567' }).error.includes('at least 2 characters'));
assert(validateCustomer({ name: '12345', phone: '03001234567' }).error.includes('contain at least one letter'));
assert(validateCustomer({ name: 'a'.repeat(65), phone: '03001234567' }).error.includes('cannot exceed 60 characters'));
console.log('✓ Name validation passed');

console.log('--- Testing Pakistani Phone Validation & Normalization ---');
// Valid formats
const v1 = validateCustomer({ name: 'John Doe', phone: '03001234567' });
assert.strictEqual(v1.error, null);
assert.strictEqual(v1.data.phone, '03001234567');

const v2 = validateCustomer({ name: 'John Doe', phone: '+923001234567' });
assert.strictEqual(v2.error, null);
assert.strictEqual(v2.data.phone, '+923001234567');

const v3 = validateCustomer({ name: 'John Doe', phone: '0300-1234567' });
assert.strictEqual(v3.error, null);
assert.strictEqual(v3.data.phone, '03001234567');

const v4 = validateCustomer({ name: 'John Doe', phone: '+92 300 1234567' });
assert.strictEqual(v4.error, null);
assert.strictEqual(v4.data.phone, '+923001234567');

const v5 = validateCustomer({ name: 'John Doe', phone: '923001234567' });
assert.strictEqual(v5.error, null);
assert.strictEqual(v5.data.phone, '+923001234567');

// Invalid formats
assert(validateCustomer({ name: 'John Doe', phone: '' }).error.includes('required'));
assert(validateCustomer({ name: 'John Doe', phone: '0300abc1234' }).error.includes('letters'));
assert(validateCustomer({ name: 'John Doe', phone: '12345' }).error.includes('too short'));
assert(validateCustomer({ name: 'John Doe', phone: '030012' }).error.includes('too short'));
assert(validateCustomer({ name: 'John Doe', phone: '0300123456789012' }).error.includes('too long'));
assert(validateCustomer({ name: 'John Doe', phone: '12345678901' }).error.includes('valid Pakistani phone number'));
console.log('✓ Phone validation & normalization passed');

console.log('--- Testing Email Validation ---');
// Optional
const opt1 = validateCustomer({ name: 'John Doe', phone: '03001234567', email: '' });
assert.strictEqual(opt1.error, null);
assert.strictEqual(opt1.data.email, undefined);

const opt2 = validateCustomer({ name: 'John Doe', phone: '03001234567' });
assert.strictEqual(opt2.error, null);
assert.strictEqual(opt2.data.email, undefined);

// Malformed values
assert(validateCustomer({ name: 'John Doe', phone: '03001234567', email: 'abc' }).error !== null);
assert(validateCustomer({ name: 'John Doe', phone: '03001234567', email: 'abc@' }).error !== null);
assert(validateCustomer({ name: 'John Doe', phone: '03001234567', email: 'abc@gmail' }).error !== null);
assert(validateCustomer({ name: 'John Doe', phone: '03001234567', email: 'abc@.com' }).error !== null);
assert(validateCustomer({ name: 'John Doe', phone: '03001234567', email: 'abc@gmail.' }).error !== null);

// Valid emails
const em1 = validateCustomer({ name: 'John Doe', phone: '03001234567', email: 'abc@gmail.com' });
assert.strictEqual(em1.error, null);
assert.strictEqual(em1.data.email, 'abc@gmail.com');

const em2 = validateCustomer({ name: 'John Doe', phone: '03001234567', email: '  User@Example.PK  ' });
assert.strictEqual(em2.error, null);
assert.strictEqual(em2.data.email, 'user@example.pk');
console.log('✓ Email validation passed');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
