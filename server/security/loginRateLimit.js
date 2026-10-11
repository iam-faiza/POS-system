const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_TRACKED_IPS = 10000;

function createLoginRateLimiter({ windowMs = WINDOW_MS, maxAttempts = MAX_ATTEMPTS, now = Date.now } = {}) {
  const attemptsByIp = new Map();

  return function loginRateLimiter(req, res, next) {
    const currentTime = now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    let record = attemptsByIp.get(ip);

    if (!record || currentTime >= record.resetAt) {
      record = { count: 0, resetAt: currentTime + windowMs };
      attemptsByIp.set(ip, record);
    }

    if (record.count >= maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - currentTime) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      res.set('RateLimit-Limit', String(maxAttempts));
      res.set('RateLimit-Remaining', '0');
      res.set('RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));
      return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
    }

    record.count += 1;
    res.set('RateLimit-Limit', String(maxAttempts));
    res.set('RateLimit-Remaining', String(maxAttempts - record.count));
    res.set('RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    if (attemptsByIp.size > MAX_TRACKED_IPS) {
      for (const [trackedIp, trackedRecord] of attemptsByIp) {
        if (currentTime >= trackedRecord.resetAt) attemptsByIp.delete(trackedIp);
      }
      while (attemptsByIp.size > MAX_TRACKED_IPS) {
        attemptsByIp.delete(attemptsByIp.keys().next().value);
      }
    }

    return next();
  };
}

module.exports = { createLoginRateLimiter, MAX_ATTEMPTS, WINDOW_MS };