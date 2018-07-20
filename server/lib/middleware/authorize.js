const jwt = require('jsonwebtoken');
const config = require('../config');
const fail = require('../fail');

module.exports = function(database) {
  return async (req, res, next) => {
    let auth = req.get('authorization');
    if (!auth) {
      return fail("No authorization header", 401)
    }
    let parts = auth.split(' ');
    if (parts[0] === 'Basic') {
      let creds = (new Buffer(parts[1], 'base64')).toString().split(':');
      if (creds.length !== 2) return fail("Invalid authorization header", 401);
      email = creds[0];
      password = creds[1];
      req.user = await database.signIn(email, password);
      let data = {email};
      let opts = {expiresIn: '1d'};
      let token = jwt.sign(data, config.jwtSecret, opts);
      await database.addToken(email, token);
      res.json(token);
    } else {
      return fail("Invalid authorization header", 401);
    }
  }
}
