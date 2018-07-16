const cryptico = require('cryptico');
const axios = require('axios');
const packageInfo = require('../package.json');
const Ajv = require('ajv');

const KEY_SIZE = 2048;

class Client {
  constructor(options={}) {
    if (typeof options === 'string') {
      options = {host: options};
    }
    this.options = options;
    if (!this.options.host) throw new Error("No host specified");
    this.namespaces = {};
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      loadSchema: async (uri) => {
        let resp = await axios.get(uri);
        return resp.data;
      }
    });
  }

  async request(method, path, query={}, body=null) {
    Object.keys(query).forEach((key, idx) => {
      path += idx === 0 ? '?' : '&';
      path += encodeURIComponent(key) + '=' + encodeURIComponent(query[key]);
    })
    let url = this.options.host + path;
    let headers = {
      'User-Agent': 'FreeDB Client v' + packageInfo.version,
    }
    let requestOpts = {method, url, headers};
    requestOpts.validateStatus = () => true;
    if (body !== null) {
      requestOpts.data = JSON.stringify(body);
    }
    if (this.options.username) {
      requestOpts.username = username;
      requestOpts.password = password;
    }
    let response = await axios.request(requestOpts);
    if (response.status >= 300) {
      throw new Error(`Status code ${response.status} for ${method.toUpperCase()} ${path}: ` + JSON.stringify(response.data));
    }
    return response.data;
  }

  async createUser(passphrase) {
    let key = this.signIn(passphrase);
    return this.request('post', '/users', {}, {public_key: key});
  }

  async loadNamespace(namespace) {
    let nsInfo = null;
    if (namespace === 'core') {
      nsInfo = await this.request('get', '/data/core/namespace/core');
    } else {
      nsInfo = await this.get('core', 'namespace', namespace);
    }
    let version = this.namespaces[namespace] = JSON.parse(JSON.stringify(nsInfo.versions[nsInfo.versions.length - 1]));
    for (let type in version.types) {
      version.types[type].validate = await this.ajv.compileAsync(version.types[type].schema);
    }
    if (namespace === 'core') {
      await this.validateItem('core', 'namespace', nsInfo);
    }
  }

  async validateItem(namespace, type, item) {
    if (!this.namespaces[namespace]) await this.loadNamespace(namespace);
    const validate = this.namespaces[namespace].types[type].validate;
    if (!validate(item)) {
      throw new Error(`Item is not a valid ${namespace}/${type}: ` + this.ajv.errorsText(validate.errors));
    }
  }

  async get(namespace, type, id) {
    let item = await this.request('get', '/data/' + namespace + '/' + type + '/' + id);
    await this.validateItem(namespace, type, item);
    return item;
  }
}

module.exports = Client;
