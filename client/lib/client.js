const axios = require('axios');
const packageInfo = require('../package.json');
const Ajv = require('ajv');
const loginForm = require('./login-form');

const TIMEOUT = 10000;
const DEFAULT_CORE = 'https://alpha.baasket.org';
const DEFAULT_PRIMARY = DEFAULT_CORE;

const HOST_REGEX = /^(https?:\/\/((\w+)\.)*(\w+)(:\d+)?)(\/.*)?$/;
const REF_REGEX =  /^(.*)\/data\/(\w+)\/(\w+)\/(\w+)$/;
const DEFAULT_PAGE_SIZE = 20;

function replaceProtocol(str) {
  return str.replace(/^\w+:\/\/(www\.)?/, '');
}

class Client {
  constructor(options={}) {
    this.options = options;
    this.setHosts(this.options.hosts || {});
    this.namespaces = {};
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      loadSchema: async (uri) => {
        let resp = await axios.get(uri);
        delete resp.data.$;
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
    await this.getUser(this.hosts.primary);
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
        host.displayName = host.user.$.id + '@' + replaceProtocol(host.location);
      }
    }
    if (this.options.onLogin) {
      setTimeout(() => this.options.onLogin(host));
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
    if (this.options.scope) {
      path += '&scope=' + this.options.scope.join('+');
    }
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
      'X-FreeDB-Client': packageInfo.version,
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

  async loadNamespace(namespace, versionID) {
    const nsInfo = await this.get('core', 'namespace', namespace);
    const nsID = versionID ? namespace + '@' + versionID : namespace;
    const version = this.namespaces[nsID] = versionID ?
          nsInfo.versions.filter(v => v.version === versionID).pop() :
          nsInfo.versions[nsInfo.versions.length - 1];
    for (let type in version.types) {
      let typeInfo = version.types[type];
      delete typeInfo.schema.$;
      typeInfo.validate = await this.ajv.compileAsync(typeInfo.schema);
    }
  }

  async validateItem(namespace, type, item) {
    if (!this.namespaces[namespace]) await this.loadNamespace(namespace);
    const validate = this.namespaces[namespace].types[type].validate;
    if (!validate(item)) {
      throw new Error(`Item is not a valid ${namespace}/${type}: ` + this.ajv.errorsText(validate.errors));
    }
  }

  async resolveRefs(obj, defaultHost, cache={}) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    } else if (Array.isArray(obj)) {
      const resolved = await Promise.all(obj.map(item => {
        return this.resolveRefs(item, defaultHost, cache);
      }));
      return resolved;
    } else if (obj.$ref && !obj.$ref.startsWith('#')) {
      const match = obj.$ref.match(REF_REGEX);
      if (!match) throw new Error("Bad $ref:" + obj.$ref);
      const [full, hostname, ns, type, id] = match;
      let host = hostname ? this.getHost(hostname) : defaultHost;
      const noValidate = !!host;
      host = host || {location: hostname};
      cache[host.location] = cache[host.location] || {};
      cache[host.location][ns] = cache[host.location][ns] || {};
      const typeCache = cache[host.location][ns][type] = cache[host.location][ns][type] || {}
      if (typeCache[id] !== undefined) {
        return typeCache[id];
      }
      try {
        return typeCache[id] = await this.get(ns, type, id, host);
      } catch (e) {
        if (e.statusCode !== 404) throw e;
      }
      return obj;
    } else {
      await Promise.all(Object.keys(obj).filter(k => k !== '$').map(key => {
        return this.resolveRefs(obj[key], defaultHost, cache).then(resolved => {
          return obj[key] = resolved;
        })
      }))
      return obj;
    }
  }

  async get(namespace, type, id, host=null) {
    host = host || namespace === 'core' ? this.hosts.core : this.hosts.primary;
    const isTrusted = this.getHost(host.location);
    const item = await this.request(host, 'get', `/data/${namespace}/${type}/${id}`);
    const cache = {}
    cache[host.location] = item.$ && item.$.cache;
    await this.resolveRefs(item, host, cache);
    if (!isTrusted) {
      await this.validateItem(namespace, type, item);
    }
    return item;
  }

  async getACL(namespace, type, id) {
    let host = namespace === 'core' ? this.hosts.core : this.hosts.primary;
    let acl = await this.request(host, 'get', `/data/${namespace}/${type}/${id}/acl`);
    // TODO: validate
    return acl;
  }

  async getInfo(namespace, type, id) {
    let host = namespace === 'core' ? this.hosts.core : this.hosts.primary;
    let info = await this.request(host, 'get', `/data/${namespace}/${type}/${id}/info`);
    // TODO: validate
    return info;
  }

  async list(namespace, type, params={}) {
    const host = namespace === 'core' ? this.hosts.core : this.hosts.primary;
    const isTrusted = false; // If using another host, set to false
    params.skip = params.skip || 0;
    params.pageSize = params.pageSize || DEFAULT_PAGE_SIZE;
    const page = await this.request(host, 'get', `/data/${namespace}/${type}`, params);
    if (!isTrusted) {
      for (let item of page.items) {
        await this.validateItem(namespace, type, item);
      }
    }
    return page;
  }

  async create(namespace, type, id, data) {
    if (typeof data === 'undefined') {
      data = id;
      id = undefined;
    }
    let url = '/data/' + namespace + '/' + type;
    if (id) url += '/' + id;
    id = await this.request(this.hosts.primary, 'post', url, {}, data);
    return id;
  }

  async update(namespace, type, id, data) {
    await this.request(this.hosts.primary, 'put', `/data/${namespace}/${type}/${id}`, {}, data);
  }

  async append(namespace, type, id, data) {
    await this.request(this.hosts.primary, 'put', `/data/${namespace}/${type}/${id}/append`, {}, data);
  }

  async destroy(namespace, type, id) {
    await this.request(this.hosts.primary, 'delete', `/data/${namespace}/${type}/${id}`);
  }

  async updateACL(namespace, type, id, acl) {
    await this.request(this.hosts.primary, 'put', `/data/${namespace}/${type}/${id}/acl`, {}, acl);
  }
}

Client.prototype.loginForm = require('./login-form');

module.exports = Client;
