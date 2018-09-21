const Server = require('../lib/server');

module.exports = function(opts) {
  let server = new Server(opts);
  return server.listen(opts.port);
}

;(async () => {
  if (require.main === module) {
    let opts = require('yargs').argv;
    try {
      await module.exports(opts);
      console.log('OneDB listening on port ' + opts.port);
    } catch (e) {
      console.log(e.message);
      console.log(e.stack);
      throw e;
    }
  }
})();
