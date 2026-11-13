const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const PIN_PATTERN = /^[0-9]{4}$/;
const PIN_HASH_ROUNDS = 10;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

function isValidPin(pin) {
  return typeof pin === 'string' && PIN_PATTERN.test(pin);
}

function pinHashInput(pin, pepper) {
  if (!isValidPin(pin)) throw new TypeError('PIN must be exactly four digits');
  if (typeof pepper !== 'string' || pepper.length < 1) throw new TypeError('PIN pepper is not configured');
  return crypto.createHmac('sha256', pepper).update(pin).digest('hex');
}

function hashPin(pin, { bcryptLibrary = bcrypt, pepper } = {}) {
  return bcryptLibrary.hash(pinHashInput(pin, pepper), PIN_HASH_ROUNDS);
}

function verifyPin(pin, hash, { bcryptLibrary = bcrypt, pepper } = {}) {
  if (!isValidPin(pin) || typeof hash !== 'string' || !hash) return Promise.resolve(false);
  return bcryptLibrary.compare(pinHashInput(pin, pepper), hash);
}

function getPinLockoutUntil(user) {
  if (!user?.pinLockedUntil) return null;
  const lockoutUntil = new Date(user.pinLockedUntil);
  return Number.isNaN(lockoutUntil.getTime()) ? null : lockoutUntil;
}

module.exports = {
  PIN_MAX_ATTEMPTS,
  PIN_LOCKOUT_MS,
  isValidPin,
  hashPin,
  verifyPin,
  getPinLockoutUntil
};
