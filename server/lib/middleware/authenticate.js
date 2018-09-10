const jwt = require('jsonwebtoken');
const fail = require('../fail');
const errorGuard = require('../error-guard');

module.exports = function(config) {
  return errorGuard(async (req, res, next) => {
    let auth = req.get('authorization');
    if (!auth) {
      req.db = await req.systemDB.user('_all');
      return next();
    }
    let parts = auth.split(' ');
    if (parts[0] === 'Basic') {
      let creds = (new Buffer(parts[1], 'base64')).toString().split(':');
      if (creds.length !== 2) return fail("Invalid authorization header", 401);
      email = creds[0];
      password = creds[1];
      req.user = await req.systemDB.signIn(email, password);
      req.db = await req.systemDB.user(req.user);
      next();
    } else if (parts[0] === 'Bearer') {
      let token = parts[1];
      try {
        jwt.verify(token, config.jwtSecret);
      } catch (e) {
        return fail("Invalid Bearer token", 401);
      }
      const {id, permissions} = await req.systemDB.signInWithToken(token);
      req.user = id;
      req.db = await req.systemDB.user(id, permissions);
      next();
    } else {
      return fail("Invalid authorization header", 401);
    }
  })
}
