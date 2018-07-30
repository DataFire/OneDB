const jwt = require('jsonwebtoken');
const config = require('../config');
const fail = require('../fail');
const errorGuard = require('../error-guard');

module.exports = function(database) {
  return errorGuard(async (req, res, next) => {
    let auth = req.get('authorization');
    if (!auth) {
      req.db = await database.user('_all');
      return next();
    }
    let parts = auth.split(' ');
    if (parts[0] === 'Basic') {
      let creds = (new Buffer(parts[1], 'base64')).toString().split(':');
      if (creds.length !== 2) return fail("Invalid authorization header", 401);
      email = creds[0];
      password = creds[1];
      req.user = await database.signIn(email, password);
      req.db = await database.user(req.user);
      next();
    } else if (parts[0] === 'Bearer') {
      let token = parts[1];
      try {
        jwt.verify(token, config.jwtSecret);
      } catch (e) {
        return fail("Invalid Bearer token", 401);
      }
      req.user = await database.signInWithToken(token);
      req.db = await database.user(req.user.id);
      next();
    } else {
      return fail("Invalid authorization header", 401);
    }
  })
}
