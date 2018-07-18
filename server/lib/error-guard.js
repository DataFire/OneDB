const errorGuard = module.exports = function(fn) {
  return async function(req, res, next) {
    try {
      await fn(req, res, next);
    } catch (err) {
      res.status(err.statusCode || 500);
      res.json({message: err.message || "Unknown error"});
    }
  }
}

