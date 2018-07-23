const npath = require('path');
const express = require('express');
const RateLimit = require('express-rate-limit');
const cors = require('cors');
const packageInfo = require('../package.json');
const validate = require('./validate');
const crud = require('./crud');
const middleware = require('./middleware');
const defaultConfig = require('./config');
const errorGuard = require('./error-guard');
const Database = require('./database');

const DEFAULT_PORT = 3000;

function replaceProtocol(str) {
  return str.replace(/^\w+:\/\/(www\.)?/, '');
}

class Server {
  constructor(config={}) {
    this.config = Object.assign({}, defaultConfig, config);
    this.config.rateLimit = Object.assign({}, defaultConfig.rateLimit, this.config.rateLimit);
    if (!this.config.mongodb) throw new Error("config.mongodb specified");
    if (!this.config.jwtSecret) throw new Error("config.jwtSecret not specified");
    this.config.hostWithoutProtocol = replaceProtocol(this.config.host);
  }

  async listen(port=DEFAULT_PORT) {
    const database = new Database({
      mongodb: this.config.mongodb,
      host: this.config.host,
    });
    await database.initialize();
    this.app = express();
    this.app.set('view engine', 'pug');
    this.app.set('views', npath.join(__dirname, '../web/views'));
    this.app.enable('trust proxy');
    this.app.use(new RateLimit(this.config.rateLimit.all));

    this.app.post('/register', new RateLimit(this.config.rateLimit.createUser), errorGuard(middleware.register(database)));
    this.app.get('/authorize', errorGuard((req, res) => {
      let error = validate.validators.url(req.query.origin || '');
      if (error) return res.status(400).send(error);
      req.query.originNoProtocol = replaceProtocol(req.query.origin);
      res.render('authorize', {query: req.query, config: this.config});
    }));
    this.app.post('/authorize', errorGuard(middleware.authorize(database)));
    this.app.use(errorGuard(middleware.authenticate(database)));

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
    this.app.use('/data', cors(), crud(database));

    this.app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({message: err.message || "Unknown error"});
    });

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, resolve);
    });
  }

  close() {
    this.server.close();
  }
}

module.exports = Server;
