const homedir = require('os').homedir();
const npath = require('path');
module.exports.ONEDB_DIR = npath.join(homedir, '.onedb');
module.exports.CREDENTIALS_FILE = npath.join(module.exports.ONEDB_DIR, 'credentials.json');

