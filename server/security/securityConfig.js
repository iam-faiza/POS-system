const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

function validateJwtSecret(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 24) {
    throw new Error('JWT_SECRET must be configured with at least 24 bytes before starting the server');
  }
  return secret;
}

function getAllowedOrigins(env = process.env) {
  const configuredOrigins = (env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of configuredOrigins) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch (error) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain exact HTTP or HTTPS origins');
    }
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain exact HTTP or HTTPS origins');
    }
  }

  if (env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be configured in production');
  }

  return new Set([
    ...(env.NODE_ENV === 'production' ? [] : DEVELOPMENT_ORIGINS),
    ...configuredOrigins
  ]);
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.has(origin);
}

function corsOptionsForOrigins(allowedOrigins) {
  return {
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Page-Size', 'X-Total-Pages'],
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin, allowedOrigins));
    }
  };
}

module.exports = {
  DEVELOPMENT_ORIGINS,
  corsOptionsForOrigins,
  getAllowedOrigins,
  isAllowedOrigin,
  validateJwtSecret
};