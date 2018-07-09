const FIFTEEN_MIN = 15 * 60 * 1000;

module.exports = {
  maxDataSize: '1000kb',
  rateLimit: {
    all: {
      windowMs: FIFTEEN_MIN,
      max: 900,
    },
    createUser: {
      windowMS: FIFTEEN_MIN,
      max: 5,
    },
    getData: {  // 1 qps
      windowMS: FIFTEEN_MIN,
      max: 900,
    },
    mutateData: { // .25 qps
      windowMS: FIFTEEN_MIN,
      max: 225,
    },
  }
}
