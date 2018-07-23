const express = require('express');
const packageInfo = require('../../package.json');

module.exports = function() {
  const router = module.exports = new express.Router();
  router.get('/ping', (req, res) => {
    res.json('pong');
  });
  router.get('/info', (req, res) => {
    res.json({version: packageInfo.version});
  });
  return router;
}
