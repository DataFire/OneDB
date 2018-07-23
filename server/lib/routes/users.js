const express = require('express');
const RateLimit = require('express-rate-limit');
const cors = require('cors');
const middleware = require('../middleware');
const validate = require('../validate');
const errorGuard = require('../error-guard');
const fail = require('../fail');
const config = require('../config');

function replaceProtocol(str) {
  return str.replace(/^\w+:\/\/(www\.)?/, '');
}
config.hostWithoutProtocol = replaceProtocol(config.host);

module.exports = function(database) {
  const router = module.exports = new express.Router();
  router.use('/me', cors());
  router.get('/me', middleware.authenticate(database), (req, res) => {
    if (!req.user) return fail("You are not logged in", 401);
    req.db.user.data.id = req.db.user.id;
    res.json(req.db.user.data);
  });
  router.post('/register', new RateLimit(config.rateLimit.createUser), errorGuard(middleware.register(database)));
  router.get('/authorize', errorGuard((req, res) => {
    let error = validate.validators.url(req.query.origin || '');
    if (error) return res.status(400).send(error);
    req.query.originNoProtocol = replaceProtocol(req.query.origin);
    res.render('authorize', {query: req.query, config: config});
  }));
  router.post('/authorize', errorGuard(middleware.authorize(database)));
  return router;
}

