const axios = require('axios');
const packageInfo = require('../package.json');
const Ajv = require('ajv');
const loginForm = require('./login-form');

const TIMEOUT = 10000;
const DEFAULT_CORE = 'https://alpha.baasket.org';
const DEFAULT_PRIMARY = DEFAULT_CORE;

const HOST_REGEX = /(https?:\/\/((\w+)\.)*(\w+)(:\d+)?)(\/.*)?/;

function replaceProtocol(str) {
  return str.replace(/^\w+:\/\/(www\.)?/, '');
}

class Client {
  constructor(options={}) {
    this.options = options;
    this.setHosts(this.options.hosts);
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

  async setHosts(hosts) {
    this.hosts = hosts;
    this.hosts.core = this.hosts.core || {location: DEFAULT_CORE};
    this.hosts.primary = this.hosts.primary || {location: DEFAULT_PRIMARY};
    this.hosts.secondary = this.hosts.secondary || [];
    if (this.hosts.primary) {
      await this.getUser(this.hosts.primary);
    }
    for (let host of this.hosts.secondary) {
      await this.getUser(host);
    }
  }

  getHost(url) {
    let match = url.match(HOST_REGEX);
    if (!match) throw new Error("Bad URL: " + url);
    let location = match[1];
    let hosts = [this.hosts.primary].concat(this.hosts.secondary);
    hosts.push(this.hosts.core);
    for (let host of hosts) {
      if (host.location === location) return host;
    }
  }

  onMessage(event) {
    if (!this.hosts.authorizing) return;
    if (event.origin !== this.hosts.authorizing.location) return;
    this.hosts.authorizing.token = event.data;
    this.getUser(this.hosts.authorizing);
  }

  async getUser(host) {
    if (host) {
      if (!host.username && !host.token) {
        host.user = null;
      } else {
        try {
          host.user = await this.request(host, 'GET', '/users/me');
        } catch (e) {
          host.username = host.password = host.token = null;
          return this.getUser(host);
        }
        host.displayName = host.user._id + '@' + replaceProtocol(host.location);
      }
    }
    if (this.options.onUser) {
      this.options.onUser(host);
    }
  }

  async createUser(host, username, password) {
    host.username = username;
    host.password = password;
    return this.request(host, 'post', '/users/register');
  }

  authorize(host) {
    if (typeof window === 'undefined') {
      throw new Error("Cannot call authorize() outside of browser context");
    }
    this.hosts.authorizing = host;

    let origin = window.location.protocol + '//' + window.location.host;
    let path = '/users/authorize?origin=' + encodeURIComponent(origin);
    window.open(this.hosts.authorizing.location + path, '_blank');
  }

  async request(host, method, path, query={}, body=null) {
    let url = path;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = host.location + path;
    } else {
      host = this.getHost(url) || {};
    }
    let headers = {
      'Content-Type': 'application/json',
    }
    let requestOpts = {method, url, headers, params: query, timeout: TIMEOUT};
    requestOpts.validateStatus = () => true;
    if (body !== null) {
      requestOpts.data = JSON.stringify(body);
    }
    if (host.token) {
      requestOpts.headers['Authorization'] = 'Bearer ' + host.token;
    } else if (host.username) {
      requestOpts.auth = {
        username: host.username,
        password: host.password,
      }
    }
    let response = await axios.request(requestOpts);
    if (response.status >= 300) {
      let message = (response.data && response.data.message)
      message = message || `Error code ${response.status} for ${method.toUpperCase()} ${path}`;
      const err = new Error(message);
      err.statusCode = response.status;
      return Promise.reject(err);
    }
    return response.data;
  }

  async loadNamespace(namespace) {
    let nsInfo = null;
    nsInfo = await this.get('core', 'namespace', namespace, namespace === 'core');
    let version = this.namespaces[namespace] = JSON.parse(JSON.stringify(nsInfo.versions[nsInfo.versions.length - 1]));
    for (let type in version.types) {
      let typeInfo = version.types[type];
      typeInfo.validate = await this.ajv.compileAsync(typeInfo.schema);
    }
    // TODO: validate core namespace
  }

  async validateItem(namespace, type, item) {
    if (!this.namespaces[namespace]) await this.loadNamespace(namespace);
    const validate = this.namespaces[namespace].types[type].validate;
    if (!validate(item)) {
      throw new Error(`Item is not a valid ${namespace}/${type}: ` + this.ajv.errorsText(validate.errors));
    }
  }

  async resolveRefs(obj, defaultHost) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    } else if (Array.isArray(obj)) {
      const resolved = [];
      for (let item of obj) {
        resolved.push(await this.resolveRefs(item, defaultHost))
      }
      return resolved;
    } else if (obj.$ref && !obj.$ref.startsWith('#')) {
      try {
        return await this.request(defaultHost, 'get', obj.$ref);
      } catch (e) {
        if (e.statusCode !== 404) throw e;
      }
      return obj;
    } else {
      for (let key in obj) {
        obj[key] = await this.resolveRefs(obj[key], defaultHost);
      }
      return obj;
    }
  }

  async get(namespace, type, id, noValidate=false) {
    let host = namespace === 'core' ? this.hosts.core : this.hosts.primary;
    let item = await this.request(host, 'get', '/data/' + namespace + '/' + type + '/' + id);
    await this.resolveRefs(item, host);
    if (!noValidate) {
      await this.validateItem(namespace, type, item);
    }
    return item;
  }

  async getACL(namespace, type, id) {
    let host = namespace === 'core' ? this.hosts.core : this.hosts.primary;
    let acl = await this.request(host, 'get', '/data/' + namespace + '/' + type + '/' + id + '/acl');
    // TODO: validate
    return acl;
  }

  async getInfo(namespace, type, id) {
    let host = namespace === 'core' ? this.hosts.core : this.hosts.primary;
    let info = await this.request(host, 'get', '/data/' + namespace + '/' + type + '/' + id + '/info');
    // TODO: validate
    return info;
  }

  async list(namespace, type, params, sort) {
    let host = namespace === 'core' ? this.hosts.core : this.hosts.primary;
    let items = await this.request(host, 'get', '/data/' + namespace + '/' + type, params);
    for (let item of items) {
      await this.validateItem(namespace, type, item);
    }
    return items;
  }

  async create(namespace, type, data, id='') {
    let url = '/data/' + namespace + '/' + type;
    if (id) url += '/' + id;
    id = await this.request(this.hosts.primary, 'post', url, {}, data);
    return id;
  }

  async update(namespace, type, id, data) {
    await this.request(this.hosts.primary, 'put', '/data/' + namespace + '/' + type + '/' + id, {}, data);
  }

  async destroy(namespace, type, id) {
    await this.request(this.hosts.primary, 'delete', '/data/' + namespace + '/' + type + '/' + id);
  }
}

Client.prototype.loginForm = require('./login-form');

module.exports = Client;
