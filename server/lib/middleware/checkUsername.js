const errorGuard = require('../error-guard');

module.exports = function(database) {
  return errorGuard(async (req, res, next) => {
    let available = await database.getAvailableUsername(req.params.username);
    res.json(available);
  });
}
