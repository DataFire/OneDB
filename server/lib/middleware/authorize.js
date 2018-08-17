const jwt = require('jsonwebtoken');
const config = require('../config');
const fail = require('../fail');
const errorGuard = require('../error-guard');
const validate = require('../validate');
const util = require('../util');

module.exports = errorGuard(async (req, res, next) => {
  const auth = req.get('authorization');
  if (!auth) {
    return fail("No authorization header", 401)
  }
  const parts = auth.split(' ');
  if (parts[0] === 'Basic') {
    const creds = (new Buffer(parts[1], 'base64')).toString().split(':');
    if (creds.length !== 2) return fail("Invalid authorization header", 401);
    const email = creds[0];
    const password = creds[1];
    req.query.scope = req.query.scope || '';
    const err = validate.validators.scope(req.query.scope);
    if (err) {
      return res.status(400).send(err);
    }
    // TODO: disallow empty scope
    const permissions = req.query.scope ? util.scopes(req.query.scope) : null;
    req.user = await req.systemDB.signIn(email, password);
    const data = {email, permissions};
    const opts = {expiresIn: '1d'};
    const token = jwt.sign(data, config.jwtSecret, opts);
    await req.systemDB.addToken(email, token, permissions);
    res.json(token);
  } else {
    return fail("Invalid authorization header", 401);
  }
})
