const express = require('express');
const RateLimit = require('express-rate-limit');
const middleware = require('../middleware');
const validate = require('../validate');
const errorGuard = require('../error-guard');
const config = require('../config');

module.exports = function(database) {
  const router = module.exports = new express.Router();
  router.post('/register', new RateLimit(config.rateLimit.createUser), errorGuard(middleware.register(database)));
  router.get('/authorize', errorGuard((req, res) => {
    let error = validate.validators.url(req.query.origin || '');
    if (error) return res.status(400).send(error);
    req.query.originNoProtocol = replaceProtocol(req.query.origin);
    res.render('authorize', {query: req.query, config: this.config});
  }));
  router.post('/authorize', errorGuard(middleware.authorize(database)));
  return router;
}

