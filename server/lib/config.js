const fs = require('fs');
const OVERRIDE_FILE = __dirname + '/../../server-config.json';
const ONE_MIN = 60 * 1000;
const FIVE_MIN = 5 * ONE_MIN;
const FIFTEEN_MIN = 15 * ONE_MIN;

module.exports = {
  maxBytesPerItem: 100 * 1000, // 100 kiB
  maxItemsPerUser: 10 * 1000,  // 1 GiB total
  host: 'http://localhost:3000',
  rateLimit: {
    all: {
      windowMs: FIFTEEN_MIN,
      max: 900,
      delayMs: 0,
    },
    users: {
      windowMs: FIVE_MIN,
      max: 20,
      delayMs: 0,
    },
    createUser: {
      windowMs: FIFTEEN_MIN,
      max: 5,
      delayMs: 3 * 1000,
      delayAfter: 1,
    },
    getData: {  // 1 qps
      windowMs: FIFTEEN_MIN,
      max: 900,
      delayMs: 0,
    },
    mutateData: { // .25 qps
      windowMs: FIFTEEN_MIN,
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
