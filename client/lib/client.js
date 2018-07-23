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
    window.addEventListener("message", (evt) => this.onMessage(evt), false);
  }

  onMessage(event) {
    if (event.origin !== this.options.host) return;
    console.log(event.data);
  }

  async authorize() {
    let origin = window.location.protocol + '//' + window.location.host;
    let path = '/authorize?origin=' + encodeURIComponent(origin);
    window.open(this.options.host + path, '_blank');
  }

  async request(method, path, query={}, body=null) {
    Object.keys(query).forEach((key, idx) => {
      path += idx === 0 ? '?' : '&';
      path += encodeURIComponent(key) + '=' + encodeURIComponent(query[key]);
    })
    let url = this.options.host + path;
    let headers = {
      'User-Agent': 'FreeDB Client v' + packageInfo.version,
      'Content-Type': 'application/json',
    }
    let requestOpts = {method, url, headers};
    requestOpts.validateStatus = () => true;
    if (body !== null) {
      requestOpts.data = JSON.stringify(body);
    }
    if (this.options.username) {
      requestOpts.auth = {
        username: this.options.username,
        password: this.options.password,
      }
    }
    let response = await axios.request(requestOpts);
    if (response.status >= 300) {
      let message = (response.data && response.data.message) || `Error code ${response.status} for ${method.toUpperCase()} ${path}`;
      throw new Error(message);
    }
    return response.data;
  }

  async createUser(username, password) {
    this.options.username = username;
    this.options.password = password;
    return this.request('post', '/register');
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
      let typeInfo = version.types[type];
      typeInfo.validate = await this.ajv.compileAsync(typeInfo.schema);
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

  async create(namespace, type, data, id='') {
    let url = '/data/' + namespace + '/' + type;
    if (id) url += '/' + id;
    id = await this.request('post', url, {}, data);
    return id;
  }

  async update(namespace, type, id, data) {
    await this.request('put', '/data/' + namespace + '/' + type + '/' + id, {}, data);
  }

  async destroy(namespace, type, id) {
    await this.request('delete', '/data/' + namespace + '/' + type + '/' + id);
  }
}

module.exports = Client;
