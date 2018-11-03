const jwt = require('jsonwebtoken');
const fail = require('../fail');
const errorGuard = require('../error-guard');
const validate = require('../validate');
const util = require('../util');

module.exports = function(config) {
  return errorGuard(async (req, res, next) => {
    const auth = req.get('authorization');
    if (!auth) {
      return fail("No authorization header", 401)
    }

    // TODO: disallow empty scope
    req.query.scope = req.query.scope || '';
    const err = validate.validators.scope(req.query.scope);
    if (err) {
      return res.status(400).send(err);
    }
    const permissionsToGrant = req.query.scope ? util.scopes(req.query.scope) : null;
    const expiration = req.query.expires_in ? parseInt(req.query.expires_in) : undefined;

    function getToken(email) {
      const data = {email, permissionsToGrant};
      const opts = {expiresIn: '1d'};
      return jwt.sign(data, config.jwtSecret, opts);
    }

    const parts = auth.split(' ');
    if (parts[0] === 'Basic') {
      const creds = (new Buffer(parts[1], 'base64')).toString().split(':');
      if (creds.length !== 2) return fail("Invalid authorization header", 401);
      const email = creds[0];
      const password = creds[1];
      const token = getToken(email);
      await req.systemDB.addToken(email, token, permissionsToGrant, expiration);
      res.json(token);
    } else if (parts[0] === 'Bearer') {
      const currentToken = parts[1];
      try {
        jwt.verify(currentToken, config.jwtSecret);
      } catch (e) {
        return fail("Invalid Bearer token, JWT failed", 401);
      }
      const {id, email, permissions} = await req.systemDB.signInWithToken(currentToken);
      if (permissions === null) {
        const token = getToken(email);
        await req.systemDB.addToken(email, token, permissionsToGrant, expiration);
        res.json(token);
      } else {
        return fail("Selected token does not have permission to create new auth tokens", 401);
      }
    } else {
      return fail("Invalid authorization header", 401);
    }
  })
}
