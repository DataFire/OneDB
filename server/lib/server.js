const npath = require('path');
const express = require('express');
const RateLimit = require('express-rate-limit');
const cors = require('cors');
const validate = require('./validate');
const routes = require('./routes');
const middleware = require('./middleware');
const defaultConfig = require('./config');
const errorGuard = require('./error-guard');
const Database = require('./database');

const DEFAULT_PORT = 3000;

class Server {
  constructor(config={}) {
    this.config = Object.assign({}, defaultConfig, config);
    this.config.rateLimit = Object.assign({}, defaultConfig.rateLimit, this.config.rateLimit);
    if (!this.config.mongodb) throw new Error("config.mongodb specified");
    if (!this.config.jwtSecret) throw new Error("config.jwtSecret not specified");
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

    this.app.use(routes.info());
    this.app.use('/users', new RateLimit(this.config.rateLimit.users), routes.users(database));

    this.app.use(errorGuard(middleware.authenticate(database)));

    let getRateLimit = new RateLimit(this.config.rateLimit.getData);
    let mutateRateLimit = new RateLimit(this.config.rateLimit.mutateData);
    this.app.use((req, res, next) => {
      if (req.method === 'GET') {
        getRateLimit(req, res, next);
      } else {
        mutateRateLimit(req, res, next);
      }
    });
    this.app.use('/data', cors(), routes.crud(database));

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
