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

// Validate and normalize Pakistani phone number
const validatePhone = (phone) => {
  const rawPhone = String(phone || '').trim();

  if (!rawPhone) {
    return { error: 'Phone number is required' };
  }

  if (/[a-zA-Z]/.test(rawPhone)) {
    return { error: 'Phone number cannot contain letters' };
  }

  if (/[^\d\s\-+().]/.test(rawPhone)) {
    return { error: 'Phone number contains invalid characters' };
  }

  if ((rawPhone.match(/\+/g) || []).length > 1 || (rawPhone.includes('+') && !rawPhone.startsWith('+'))) {
    return { error: 'Invalid phone number format' };
  }

  const cleanedPhone = rawPhone.replace(/[\s\-().]/g, '');
  const digitsOnly = cleanedPhone.replace(/\D/g, '');

  if (digitsOnly.length < 10) {
    return { error: 'Phone number is too short' };
  }

  if (digitsOnly.length > 13) {
    return { error: 'Phone number is too long' };
  }

  // Pakistani phone formats: 03001234567, +923001234567, 923001234567, 00923001234567, or Pakistani landlines (021..., 051...)
  const pakPhoneRegex = /^(?:(?:\+92|0092|92)|0)[2-9]\d{8,9}$/;
  if (!pakPhoneRegex.test(cleanedPhone)) {
    return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567 or +923001234567)' };
  }

  // Consistently normalize phone without changing original representation unnecessarily
  let normalizedPhone = cleanedPhone;
  if (normalizedPhone.startsWith('0092')) {
    normalizedPhone = '+92' + normalizedPhone.slice(4);
  } else if (normalizedPhone.startsWith('92') && !normalizedPhone.startsWith('+92')) {
    normalizedPhone = '+92' + normalizedPhone.slice(2);
  }

  return { error: null, normalized: normalizedPhone };
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

  if (!/[a-zA-Z\u00C0-\u024F\u0600-\u06FF]/.test(rawName)) {
    return { error: 'Customer name must contain at least one letter' };
  }

  if (!/^[a-zA-Z\u00C0-\u024F\u0600-\u06FF\s'’.\-]+$/.test(rawName)) {
    return { error: 'Customer name can only contain letters, spaces, hyphens, periods, and apostrophes' };
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
