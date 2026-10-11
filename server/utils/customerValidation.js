/**
 * Customer validation and normalization utility
 */

// Format customer name with sensible title-casing while preserving hyphens and apostrophes
const formatCustomerName = (rawName) => {
  if (!rawName) return '';
  const trimmed = String(rawName).trim().replace(/\s+/g, ' ');
  return trimmed
    .toLocaleLowerCase()
    .replace(/(^|[\s'.’\-])(\p{L})/gu, (_match, separator, letter) => separator + letter.toLocaleUpperCase());
};

// Validate optional email address
const validateEmail = (email) => {
  if (email === undefined || email === null) {
    return { error: null, normalized: '' };
  }

  const trimmed = String(email).trim();
  if (trimmed === '') {
    return { error: null, normalized: '' };
  }

  // Reject spaces or malformed basic structure
  if (trimmed.length > 254 || /\s/.test(trimmed)) {
    return { error: 'Email cannot contain spaces' };
  }

  // Must match user@domain.tld where tld is at least 2 characters
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return { error: 'Please enter a valid email address (e.g., customer@example.com)' };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { error: 'Please enter a valid email address' };
  }

  const domainParts = parts[1].split('.');
  const tld = domainParts[domainParts.length - 1];

  if (domainParts.length < 2 || tld.length < 2 || domainParts.some((p) => p.length === 0)) {
    return { error: 'Please enter a valid email address (e.g., customer@example.com)' };
  }

  return { error: null, normalized: trimmed.toLowerCase() };
};

// Validate and normalize Pakistani phone number to canonical 923001234567 format
const validatePhone = (phone) => {
  if (typeof phone !== 'string') {
    return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567)' };
  }
  const rawPhone = phone.trim();

  if (!rawPhone) {
    return { error: 'Phone number is required' };
  }

  if (!/^[+\d().\s-]+$/.test(rawPhone)) {
    return { error: 'Phone number contains invalid characters' };
  }

  const compact = rawPhone.replace(/[().\s-]/g, '');
  if (!/^\+?\d+$/.test(compact)) {
    return { error: 'Phone number format is invalid' };
  }

  let digits = compact.startsWith('+') ? compact.slice(1) : compact;
  let canonical;
  if (digits.startsWith('0092')) {
    canonical = `92${digits.slice(4)}`;
  } else if (digits.startsWith('92')) {
    canonical = digits;
  } else if (digits.startsWith('0')) {
    canonical = `92${digits.slice(1)}`;
  } else if (digits.length === 10) {
    canonical = `92${digits}`;
  } else {
    return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567)' };
  }

  if (!/^92[2-9]\d{9}$/.test(canonical)) {
    return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567)' };
  }

  return { error: null, normalized: canonical };
};

// Full customer validation
const validateCustomer = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Invalid customer details' };
  }
  const { name, phone, email, marketingConsent } = input;
  const rawName = String(name || '').trim().replace(/\s+/g, ' ');

  if (!rawName) {
    return { error: 'Customer name is required' };
  }

  if (rawName.length < 2) {
    return { error: 'Customer name must be at least 2 characters' };
  }

  if (rawName.length > 60) {
    return { error: 'Customer name cannot exceed 60 characters' };
  }
  if (!/[\p{L}\p{M}]/u.test(rawName) || !/^[\p{L}\p{M}]+(?:[\s'.’\-][\p{L}\p{M}]+)*$/u.test(rawName)) {
    return { error: 'Customer name contains invalid characters' };
  }

  const phoneResult = validatePhone(phone);
  if (phoneResult.error) {
    return { error: phoneResult.error };
  }

  const emailResult = validateEmail(email);
  if (emailResult.error) {
    return { error: emailResult.error };
  }

  const consent = marketingConsent === true || marketingConsent === 'true' || marketingConsent === 'on';

  return {
    error: null,
    data: {
      name: formatCustomerName(rawName),
      phone: phoneResult.normalized,
      email: emailResult.normalized || undefined,
      marketingConsent: consent
    }
  };
};

module.exports = {
  formatCustomerName,
  validateEmail,
  validatePhone,
  validateCustomer
};
