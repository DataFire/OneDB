const axios = require('axios');
const packageInfo = require('../package.json');
const Ajv = require('ajv');

const TIMEOUT = 30000;

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
    if (typeof window !== 'undefined') {
      window.addEventListener("message", (evt) => this.onMessage(evt), false);
    }
  }

  onMessage(event) {
    if (event.origin !== this.options.host) return;
    this.options.token = event.data;
    this.request('GET', '/users/me').then(user => {
      this.user = user;
      if (this.callback) this.callback(user);
      this.callback = null;
    })
  }

  authorize(callback) {
    if (typeof window === 'undefined') throw new Error("Cannot call authorize() outside of browser context");
    let origin = window.location.protocol + '//' + window.location.host;
    let path = '/users/authorize?origin=' + encodeURIComponent(origin);
    window.open(this.options.host + path, '_blank');
    this.callback = callback;
  }

  async request(method, path, query={}, body=null) {
    Object.keys(query).forEach((key, idx) => {
      path += idx === 0 ? '?' : '&';
      path += encodeURIComponent(key) + '=' + encodeURIComponent(query[key]);
    })
    let url = this.options.host + path;
    let headers = {
      'Content-Type': 'application/json',
    }
    let requestOpts = {method, url, headers, timeout: TIMEOUT};
    requestOpts.validateStatus = () => true;
    if (body !== null) {
      requestOpts.data = JSON.stringify(body);
    }
    if (this.options.token) {
      requestOpts.headers['Authorization'] = 'Bearer ' + this.options.token;
    } else if (this.options.username) {
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
    return this.request('post', '/users/register');
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
