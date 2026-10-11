import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canConvertCurrency, formatCurrency } from '../src/utils/i18n.js';
import {
  normalizeCustomerName,
  normalizePakistaniPhone,
  validateCustomerDetails
} from '../src/utils/customerValidation.js';

test('customer form validation agrees on title case and Pakistani phone formats', () => {
  assert.equal(normalizeCustomerName('  o’NEIL   bin   ali '), 'O’Neil Bin Ali');
  assert.equal(normalizePakistaniPhone('0300-123-4567').normalized, '923001234567');
  assert.equal(normalizePakistaniPhone('+92 300 123 4567').normalized, '923001234567');
  assert.ok(normalizePakistaniPhone('letters03001234567').error);
  assert.ok(validateCustomerDetails({ name: 'A', phone: '03001234567' }).error);
  assert.equal(validateCustomerDetails({ name: 'O’Neil', phone: '03001234567', email: '' }).error, null);
});

test('currency formatter never applies a hardcoded foreign exchange rate', () => {
  assert.equal(canConvertCurrency('PKR'), true);
  assert.equal(canConvertCurrency('USD'), false);
  assert.equal(formatCurrency(278.5, 'USD'), formatCurrency(278.5, 'PKR'));
  assert.equal(formatCurrency(278.5, 'PKR'), '₨ 278.50');
});