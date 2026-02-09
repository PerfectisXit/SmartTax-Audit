const { AppError } = require('../errors');

const createRateLimiter = ({ windowMs, maxRequests }) => {
  const buckets = new Map();

  return (req, _res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now > current.expiresAt) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return next(new AppError('Too Many Requests', 429));
    }

    current.count += 1;
    return next();
  };
};

module.exports = { createRateLimiter };
