class AppError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

const notFoundHandler = (_req, res) => {
  return res.status(404).json({ error: 'Not Found' });
};

const errorHandler = (err, _req, res, _next) => {
  const status = Number(err?.status) || 500;
  const exposeMessage = status < 500 || status === 502;
  const message = exposeMessage ? (err?.message || 'Request failed') : 'Internal Server Error';
  if (status >= 500 && status !== 502) {
    console.error('Unhandled Server Error:', err);
  }
  const payload = { error: message };
  if (status === 502 && err?.raw) {
    payload.raw = err.raw;
  }
  if (err?.details && status < 500) {
    payload.details = err.details;
  }
  return res.status(status).json(payload);
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
