const express = require('express');
const packageInfo = require('../../package.json');

const router = module.exports = new express.Router();
router.get('/ping', (req, res) => {
  res.json('pong');
});
router.get('/info', (req, res) => {
  res.json({version: packageInfo.version});
});
