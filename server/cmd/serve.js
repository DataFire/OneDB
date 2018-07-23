const Server = require('../lib/server');

module.exports = function(opts) {
  let server = new Server(opts);
  return server.listen(opts.port);
}

;(async () => {
  if (require.main === module) {
    try {
      await module.exports(require('yargs').argv);
    } catch (e) {
      console.log(e.message);
      console.log(e.stack);
      throw e;
    }
  }
})();
