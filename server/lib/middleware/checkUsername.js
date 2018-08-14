const errorGuard = require('../error-guard');

module.exports = errorGuard(async (req, res, next) => {
  let available = await req.systemDB.getAvailableUsername(req.params.username);
  res.json(available);
});
