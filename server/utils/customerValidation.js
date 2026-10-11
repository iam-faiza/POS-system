/**
 * Customer validation and normalization utility
 */

// Format customer name with sensible title-casing while preserving hyphens and apostrophes
const formatCustomerName = (rawName) => {
  if (!rawName) return '';
  const trimmed = String(rawName).trim().replace(/\s+/g, ' ');
  return trimmed
    .toLowerCase()
    .replace(/(?:^|[\s'’.\-])[a-zA-Z\u00C0-\u024F\u0600-\u06FF]/g, (char) => char.toUpperCase());
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
  if (/\s/.test(trimmed)) {
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
  const rawPhone = String(phone || '').trim();

  if (!rawPhone) {
    return { error: 'Phone number is required' };
  }

  // Remove all non-digit characters for canonical comparison
  const digitsOnly = rawPhone.replace(/\D/g, '');

  // Handle various Pakistani formats:
  // 03001234567 (11 digits) -> 923001234567
  // +923001234567 or 923001234567 (12 digits) -> 923001234567
  // 00923001234567 (13+ digits) -> 923001234567
  
  let canonical = digitsOnly;
  if (canonical.startsWith('0092')) {
    canonical = canonical.slice(2);
  } else if (canonical.startsWith('0')) {
    canonical = '92' + canonical.slice(1);
  } else if (canonical.length === 10 && !canonical.startsWith('92')) {
    // Possibly missing leading zero or country code? 3001234567
    canonical = '92' + canonical;
  }

  // Basic length check for Pakistani mobile/landline with 92 prefix
  // Mobile: 92 (2) + 3XX (3) + XXXXXXX (7) = 12 digits
  // Landline: 92 (2) + 21/42/51 (2) + XXXXXXXX (8) = 12 digits
  if (canonical.length < 11 || canonical.length > 13) {
    return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567)' };
  }

  // Reject obviously invalid starts (Pakistani numbers after 92/0 start with 2-9)
  if (!/^[1-9]/.test(canonical.slice(2))) {
    return { error: 'Invalid phone number format' };
  }

  return { error: null, normalized: canonical };
};

// Full customer validation
const validateCustomer = ({ name, phone, email, marketingConsent }) => {
  const rawName = String(name || '').trim();

  if (!rawName) {
    return { error: 'Customer name is required' };
  }

  if (rawName.length < 2) {
    return { error: 'Customer name must be at least 2 characters' };
  }

  if (rawName.length > 60) {
    return { error: 'Customer name cannot exceed 60 characters' };
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
