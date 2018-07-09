const express = require('express');
const RateLimit = require('express-rate-limit');
const packageInfo = require('../package.json');
const crud = require('./crud');
const authenticate = require('./authenticate');
const register = require('./register');
const defaultConfig = require('./config');
const Database = require('./database');

class Server {
  constructor(config={}) {
    this.config = Object.assign({}, defaultConfig, config);
    this.config.rateLimit = Object.assign({}, defaultConfig.rateLimit, this.config.rateLimit);
  }

  async listen(port) {
    const database = new Database(this.config.mongodb);
    await database.initialize();
    this.app = express();
    this.app.enable('trust proxy');
    this.app.use(new RateLimit(this.config.rateLimit.all));

    this.app.post('/register', new RateLimit(this.config.rateLimit.createUser), register(database));
    this.app.use(authenticate(database));

    this.app.get('/ping', (req, res) => {
      res.json('pong');
    });
    this.app.get('/info', (req, res) => {
      res.json({version: packageInfo.version});
    });

    let getRateLimit = new RateLimit(this.config.rateLimit.getData);
    let mutateRateLimit = new RateLimit(this.config.rateLimit.mutateData);
    this.app.use((req, res, next) => {
      if (req.method === 'GET') {
        getRateLimit(req, res, next);
      } else {
        mutateRateLimit(req, res, next);
      }
    });
    this.app.use('/data', crud(database));

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, resolve);
    });
  }

  close() {
    this.server.close();
  }
}

module.exports = Server;
