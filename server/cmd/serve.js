const Server = require('../lib/server');

module.exports = function(opts) {
  let server = new Server(opts);
  return server.listen(opts.port);
}

if (require.main === module) {
  module.exports(require('yargs').argv);
}
