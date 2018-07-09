const express = require('express');
const RateLimit = require('express-rate-limit');
const packageInfo = require('../package.json');
const crud = require('./crud');
const defaultConfig = require('./config');

class Server {
  constructor(config={}) {
    config = Object.assign({}, defaultConfig, config);
    config.rateLimit = Object.assign({}, defaultConfig.rateLimit, config.rateLimit);

    this.app = express();

    this.app.enable('trust proxy');
    this.app.use(new RateLimit(config.rateLimit.all));

    this.app.get('/ping', (req, res) => {
      res.json('pong');
    });

    this.app.get('/info', (req, res) => {
      res.json({version: packageInfo.version});
    });

    let getRateLimit = new RateLimit(config.rateLimit.getData);
    let mutateRateLimit = new RateLimit(config.rateLimit.mutateData);
    this.app.use((req, res, next) => {
      if (req.method === 'GET') {
        getRateLimit(req, res, next);
      } else {
        mutateRateLimit(req, res, next);
      }
    })

    this.app.use('/data', crud);
  }

  async listen(port) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, resolve);
    });
  }

  close() {
    this.server.close();
  }
}

module.exports = Server;
