const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

export async function fingerprintCheckoutPayload(saleData) {
  const canonicalPayload = {
    items: saleData.items.map(({ productId, quantity }) => ({ productId: String(productId), quantity })),
    customerId: saleData.customer || null,
    discountCents: Math.round(Number(saleData.discount || 0) * 100),
    paymentMethod: saleData.paymentMethod,
    paymentDetails: saleData.paymentDetails || null,
    cashReceivedCents: saleData.cashReceived === undefined
      ? null
      : Math.round(Number(saleData.cashReceived) * 100)
  };
  const input = new TextEncoder().encode(JSON.stringify(canonicalPayload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function loadCheckoutAttempt(storageKey, storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage.getItem(storageKey) || 'null');
    if (!stored || stored.version !== 1 ||
        !IDEMPOTENCY_KEY_PATTERN.test(stored.key || '') ||
        !FINGERPRINT_PATTERN.test(stored.fingerprint || '')) {
      return null;
    }
    return { key: stored.key, fingerprint: stored.fingerprint };
  } catch {
    return null;
  }
}

export function saveCheckoutAttempt(storageKey, attempt, storage = globalThis.localStorage) {
  try {
    storage.setItem(storageKey, JSON.stringify({ version: 1, ...attempt }));
    return true;
  } catch {
    return false;
  }
}

export function clearCheckoutAttempt(storageKey, storage = globalThis.localStorage) {
  try {
    storage.removeItem(storageKey);
  } catch {
    // Storage can be disabled; successful checkout still clears its in-memory attempt.
  }
}
