const express = require('express');
const args = require('yargs').argv;
const packageInfo = require('./package.json');
const crud = require('./crud');

args.port = args.port || 3000;

const app = express();

app.get('/ping', (req, res) => {
  res.json('pong');
});

app.get('/info', (req, res) => {
  res.json({version: packageInfo.version});
});

app.use('/data', crud);

app.listen(args.port, () => {
  console.log("FreeDB listening on port " + args.port);
});
