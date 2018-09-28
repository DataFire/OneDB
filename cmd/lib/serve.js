const Server = require('onedb-server').Server;
const fs = require('fs');
const npath = require('path');
const YAML = require('yamljs');

const CONFIG_FILE = npath.join(process.cwd(), 'OneDB.yml');

module.exports = function(opts) {
  if (fs.existsSync(CONFIG_FILE)) {
    opts = Object.assign({}, YAML.load(CONFIG_FILE), opts);
  }
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
