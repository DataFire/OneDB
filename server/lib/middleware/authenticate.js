const util = require('./util');

module.exports = function(database) {
  return async (req, res, next) => {
    let auth = req.get('authorization');
    if (!auth) {
      req.db = await database.user('_all');
      return next();
    }
    let parts = auth.split(' ');
    if (parts[0] === 'Basic') {
      let creds = (new Buffer(parts[1], 'base64')).toString().split(':');
      if (creds.length !== 2) return res.status(401).send("Invalid authorization header");
      email = creds[0];
      password = creds[1];
      req.user = await database.signIn(email, password);
      req.db = await database.user(req.user.id);
      next();
    } else {
      res.status(401).send("Invalid authorization header");
    }
  }
}
