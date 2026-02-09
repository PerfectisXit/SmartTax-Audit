const { AppError } = require('../errors');

const validate = (schema, source = 'body') => {
  return (req, _res, next) => {
    const target = req[source];
    const result = schema.safeParse(target);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(new AppError('Invalid request payload', 400, details));
    }
    req[source] = result.data;
    return next();
  };
};

module.exports = { validate };
