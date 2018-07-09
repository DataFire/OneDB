const express = require('express');
const RateLimit = require('express-rate-limit');
const args = require('yargs').argv;
const packageInfo = require('./package.json');
const crud = require('./crud');
const config = require('./config');

const app = express();

app.enable('trust proxy');

app.use(new RateLimit(config.rateLimit.all));

app.get('/ping', (req, res) => {
  res.json('pong');
});

app.get('/info', (req, res) => {
  res.json({version: packageInfo.version});
});

let getRateLimit = new RateLimit(config.rateLimit.getData);
let mutateRateLimit = new RateLimit(config.rateLimit.mutateData);
app.use((req, res, next) => {
  if (req.method === 'GET') {
    getRateLimit(req, res, next);
  } else {
    mutateRateLimit(req, res, next);
  }
})

app.use('/data', crud);

args.port = args.port || 3000;
app.listen(args.port, () => {
  console.log("FreeDB listening on port " + args.port);
});
