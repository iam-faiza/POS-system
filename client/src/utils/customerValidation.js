const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const CUSTOMER_VALIDATION_KEYS = {
  'Customer name must be at least 2 characters': 'validation_name_short',
  'Customer name cannot exceed 60 characters': 'validation_name_long',
  'Customer name contains invalid characters': 'validation_name_chars',
  'Phone number is required': 'validation_phone_required',
  'Phone number contains invalid characters': 'validation_phone_chars',
  'Phone number format is invalid': 'validation_phone_format',
  'Please enter a valid Pakistani phone number (e.g., 03001234567)': 'validation_phone_country',
  'Please enter a valid email address': 'validation_email'
};

export function localizeCustomerValidationError(error, translate) {
  const key = CUSTOMER_VALIDATION_KEYS[error];
  return key ? translate(key) : error;
}

export function normalizeCustomerName(value) {
  const collapsed = String(value || '').trim().replace(/\s+/g, ' ');
  return collapsed
    .toLocaleLowerCase()
    .replace(/(^|[\s'.’-])(\p{L})/gu, (_match, separator, letter) => separator + letter.toLocaleUpperCase());
}

export function normalizePakistaniPhone(value) {
  if (typeof value !== 'string') return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567)' };
  const raw = value.trim();
  if (!raw) return { error: 'Phone number is required' };
  if (!/^[+\d().\s-]+$/.test(raw)) return { error: 'Phone number contains invalid characters' };
  const compact = raw.replace(/[().\s-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return { error: 'Phone number format is invalid' };
  let digits = compact.startsWith('+') ? compact.slice(1) : compact;
  let normalized;
  if (digits.startsWith('0092')) normalized = `92${digits.slice(4)}`;
  else if (digits.startsWith('92')) normalized = digits;
  else if (digits.startsWith('0')) normalized = `92${digits.slice(1)}`;
  else if (digits.length === 10) normalized = `92${digits}`;
  else return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567)' };
  if (!/^92[2-9]\d{9}$/.test(normalized)) {
    return { error: 'Please enter a valid Pakistani phone number (e.g., 03001234567)' };
  }
  return { error: null, normalized };
}

export function validateCustomerDetails({ name, phone, email }) {
  const normalizedName = normalizeCustomerName(name);
  if (normalizedName.length < 2) return { error: 'Customer name must be at least 2 characters' };
  if (normalizedName.length > 60) return { error: 'Customer name cannot exceed 60 characters' };
  if (!/[\p{L}\p{M}]/u.test(normalizedName) || !/^[\p{L}\p{M}]+(?:[\s'.’-][\p{L}\p{M}]+)*$/u.test(normalizedName)) {
    return { error: 'Customer name contains invalid characters' };
  }

  const phoneResult = normalizePakistaniPhone(phone);
  if (phoneResult.error) return phoneResult;

  const normalizedEmail = String(email || '').trim();
  if (normalizedEmail.length > 254 || (normalizedEmail && (/[\s]/.test(normalizedEmail) || !EMAIL_PATTERN.test(normalizedEmail)))) {
    return { error: 'Please enter a valid email address' };
  }

  return {
    error: null,
    data: {
      name: normalizedName,
      phone: phoneResult.normalized,
      email: normalizedEmail || undefined
    }
  };
}

export function originalArchivedPhone(value) {
  const phone = String(value || '');
  return phone.replace(/^archived_\d+_(?:[a-f\d]{24}_)?/i, '');
}