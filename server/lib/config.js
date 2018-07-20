const fs = require('fs');
const OVERRIDE_FILE = __dirname + '/../../server-config.json';
const FIFTEEN_MIN = 15 * 60 * 1000;

module.exports = {
  maxDataSize: '100kb',
  host: 'http://localhost:3000',
  rateLimit: {
    all: {
      windowMs: FIFTEEN_MIN,
      max: 900,
      delayMs: 0,
    },
    createUser: {
      windowMS: FIFTEEN_MIN,
      max: 5,
      delayMs: 3 * 1000,
      delayAfter: 1,
    },
    getData: {  // 1 qps
      windowMS: FIFTEEN_MIN,
      max: 900,
      delayMs: 0,
    },
    mutateData: { // .25 qps
      windowMS: FIFTEEN_MIN,
      max: 225,
      delayMs: 500,
      delayAfter: 100,
    },
  }
}

if (fs.existsSync(OVERRIDE_FILE)) {
  let overrides = require(OVERRIDE_FILE);
  Object.assign(module.exports, overrides);
}
