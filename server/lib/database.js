const mongodb = require('mongodb');
const randomstring = require("randomstring");
const moment = require('moment');
const axios = require('axios');
const validate = require('./validate');
const dbUtil = require('./db-util');
const util = require('./util');
const fail = require('./fail');

const DB_NAME = 'freedb';
const ID_LENGTH = 8;
const REF_REGEX = /^\/data\/(\w+)\/(\w+)\/(\w+)$/;

const DEFAULT_SORT = {'info.updated': -1};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

const AUTH_TOKEN_EXPIRATION_DAYS = 1;

class Database {
  constructor(opts={}) {
    if (typeof opts == 'string') {
      opts = {mongodb: opts};
    }
    this.config = opts;
  }

  async initialize() {
    if (this.client) return fail("Database already initialized");
    this.client = await mongodb.MongoClient.connect(this.config.mongodb, {useNewUrlParser: true});
    this.db = this.client.db(DB_NAME);
    for (let obj of dbUtil.CORE_OBJECTS) {
      const coll = this.db.collection(obj.namespace + '-' + obj.type);
      const query = {id: obj.document.id};
      const existing = await coll.find(query).toArray();
      const doc = {
        id: obj.document.id,
        info: obj.document.info,
        acl: JSON.parse(JSON.stringify(obj.document.acl)),
        data: dbUtil.encodeDocument(JSON.parse(JSON.stringify(obj.document.data))),
      }
      if (existing[0]) {
        await coll.update(query, {$set: doc});
      } else {
        await coll.insert(doc);
      }
    }
  }

  async user(user, permissions) {
    if (!this.db) return fail("Database not initialized");
    const db = new DatabaseForUser({config: this.config, db: this.db, user, permissions});
    await db.initialize();
    return db;
  }

  async getAvailableUsername(username) {
    if (!username) username = util.randomName();
    const coll = this.db.collection('core-user');
    const existing = await coll.find({id: username}).toArray();
    return existing.length ? this.getAvailableUsername() : username;
  }

  async createUser(email, password, username=undefined, confirmation_code=undefined) {
    if (!this.db) return fail("Database not initialized");
    let err = validate.validators.email(email) || validate.validators.password(password);
    if (err) return fail(err, 400);
    const db = await this.user(dbUtil.USER_KEYS.system);
    const existing = await db.getCollection('core', 'user_private').find({'data.email': email}).toArray();
    if (existing.length) return fail("A user with that email address already exists");
    const user = await db.create('core', 'user', username, {});
    const creds = await dbUtil.computeCredentials(password);
    creds.email = email;
    creds.id = user.$.id;
    creds.email_confirmation = {
      code: confirmation_code,
      expires: moment().add(1, 'days').toISOString()
    };
    const userPrivate = await db.create('core', 'user_private', creds);
    return user;
  }

  async setPassword(id, password) {
    const err = validate.validators.password(password);
    if (err) return fail(err, 400);
    const creds = await dbUtil.computeCredentials(password);
    const update = {}
    for (let key in creds) {
      update['data.' + key] = creds[key];
    }
    const updated = await this.db.collection('core-user_private').update({'data.id': id}, {$set: update});
    if (updated.result.nModified !== 1) return fail("User not found", 404);
  }

  async addToken(email, token, permissions={}) {
    // TODO: remove old tokens
    if (!this.db) return fail("Database not initialized");
    let err = validate.validators.email(email);
    if (err) return fail(err, 400);
    const db = await this.user(dbUtil.USER_KEYS.system);
    const userCol = db.getCollection('core', 'user_private');
    const existing = await userCol.findOne({'data.email': email});
    if (!existing) return fail(`User ${email} not found`, 401);
    await db.create('core', 'authorization_token', {
      username: existing.data.id,
      token,
      permissions: permissions || undefined,
      expires: moment().add(AUTH_TOKEN_EXPIRATION_DAYS, 'days').toISOString(),
    });
  }

  async signIn(email, password) {
    if (!this.db) return fail("Database not initialized");
    let err = validate.validators.email(email) || validate.validators.password(password);
    if (err) return fail(err, 400);
    const db = await this.user(dbUtil.USER_KEYS.system);
    const existing = await db.getCollection('core', 'user_private').find({'data.email': email}).toArray();
    if (!existing.length) return fail(`User ${email} not found`, 401);
    const user = existing[0].data;
    const isValid = await dbUtil.checkPassword(password, user.hash, user.salt);
    if (!isValid) return fail(`Invalid password for ${email}`, 401);
    return user.id;
  }

  async signInWithToken(token) {
    const db = await this.user(dbUtil.USER_KEYS.system);
    const tokenCol = db.getCollection('core', 'authorization_token');
    const tokenQuery = {'data.token': token, 'data.expires': {$gt: moment().toISOString()}}
    const tokenObj = await tokenCol.findOne(tokenQuery);
    if (!tokenObj) return fail("The provided token is invalid", 401);
    const userCol = db.getCollection('core', 'user_private');
    const userObj = await userCol.findOne({'data.id': tokenObj.data.username});
    if (!userObj) return fail("The provided token is invalid", 401);
    return {id: userObj.data.id, permissions: tokenObj.data.permissions};
  }
}

class DatabaseForUser {
  constructor(opts) {
    this.db = opts.db;
    this.userID = opts.user;
    this.permissions = opts.permissions;
    this.config = opts.config;
    this.config.namespaces = this.config.namespaces || {};
    if (!this.userID) throw new Error("Username not specified");
  }

  async initialize() {
    await this.refreshUser();
  }

  async refreshUser() {
    let users = await this.getCollection('core', 'user').find({id: this.userID}).toArray();
    if (!users[0]) return fail(`User ${this.userID} not found`);
    if (users.length > 1) return fail("Multiple users found for ID " + this.userID);
    this.user = users[0];
  }

  getCollection(namespace, type) {
    namespace = namespace.split('@')[0];
    const collectionName = namespace + '-' + type;
    return this.db.collection(collectionName);
  }

  checkNamespace(namespace) {
    const [namespaceID, version] = namespace.split('@');
    let allowed = true;
    if (this.config.namespaces.allow) {
      allowed = allowed && this.config.namespaces.allow.includes(namespaceID);
    }
    if (this.config.namespaces.disallow) {
      allowed = allowed && !this.config.namespaces.disallow.includes(namespaceID);
    }
    if (!allowed) {
      fail("Namespace " + namespaceID + " is not supported by this server", 501);
    }
  }

  checkPermission(namespace, type, access) {
    if (!this.permissions) return true;
    const allowed = this.permissions[namespace];
    return allowed && allowed.includes(access);
  }

  async validate(obj, schema=null, namespace='', type='') {
    if (schema) {
      if (!namespace || !type) throw new Error("Need a namespace and type to validate schema");
      if (namespace !== 'core') {
        schema = dbUtil.schemaRefsToDBRefs(namespace, schema);
      }
      schema = {
        definitions: schema.definitions,
        anyOf: [Object.assign({definitions: {}}, schema), validate.getRefSchema(namespace, type)],
      }
      let err = validate.validators.data(obj.data, schema);
      if (err) {
        return fail(`Invalid ${namespace}/${type}: ${err}`);
      }
    }
    if (obj.acl) {
      let err = validate.validators.acl(obj.acl);
      if (err) return fail(err);
    }
  }

  async maybeProxy(namespace, type, id) {
    const proxyHost = this.config.namespaces.proxy && this.config.namespaces.proxy[namespace];
    let item = null;
    if (proxyHost) {
      try {
        item = (await axios.get(`${proxyHost}/data/${namespace}/${type}/${id}`)).data
      } catch (e) {
        if (!e.response || e.response.status !== 404) throw e;
      }
    } else {
      item = await this.get(namespace, type, id);
    }
    return item;
  }

  async getSchema(namespaceIDWithVersion, typeID) {
    const [namespaceID, versionID] = namespaceIDWithVersion.split('@');
    const namespace = await this.maybeProxy('core', 'namespace', namespaceID);
    if (!namespace) return fail(`Namespace ${namespaceID} not found`);
    const nsVersion = versionID ?
          namespace.versions.filter(v => v.version === versionID).pop() :
          namespace.versions[namespace.versions.length - 1];
    if (!nsVersion) return fail(`Version ${namespaceIDWithVersion} not found`);
    const schemaRef = (nsVersion.types[typeID] || {schema: {$ref: ''}}).schema.$ref.split('/').pop();
    if (!schemaRef) return fail(`Schema ${namespaceIDWithVersion}/${typeID} not found`);
    const schema = await this.maybeProxy('core', 'schema', schemaRef);
    if (!schema) return fail(`Item core/schema/${schemaRef} not found`);
    delete schema.$;
    return {schema, namespaceVersion: nsVersion};
  }

  buildQuery(namespace, type, query={}, accesses='read', modifyACL=false) {
    const nsVersion = namespace.split('@')[1];
    if (nsVersion) {
      query['info.namespace_version'] = nsVersion;
    }
    if (accesses === 'force') return query;
    let accessType = modifyACL ? 'modify' : 'allow';
    query.$and = query.$and || [];
    if (typeof accesses === 'string') accesses = [accesses];

    let ownerOK = true;
    if (modifyACL) {
      if (!this.checkPermission(namespace, type, 'modify_acl')) {
        return fail(`This app does not have permission to modify ACL for ${namespace}/${type}`, 401);
      }
    } else {
      for (let access of accesses) {
        if (!this.checkPermission(namespace, type, access)) {
          if (access === 'read') {
            ownerOK = false;
          } else {
            return fail(`This app does not have permission to ${access} ${namespace}/${type}`, 401);
          }
        }
      }
    }

    accesses.forEach(access => {
      let allowKey = ['acl', accessType, access].join('.');
      let disallowKey = ['acl', 'disallow', access].join('.');
      if (ownerOK) {
        const ownerQuery = {$and: [{'acl.owner': this.user.id}, {}, {}]};
        ownerQuery.$and[1][allowKey] = {$in: [dbUtil.USER_KEYS.owner]};
        ownerQuery.$and[2][disallowKey] = {$nin: [dbUtil.USER_KEYS.owner]};
        const accessQuery = {$and: [{}, {}]};
        accessQuery.$and[0][allowKey] = {$in: [this.user.id, dbUtil.USER_KEYS.all]};
        accessQuery.$and[1][disallowKey] = {$nin: [this.user.id, dbUtil.USER_KEYS.all]};
        query.$and.push({$or: [ownerQuery, accessQuery]});
      } else {
        const accessQuery = {$and: [{}, {}]}
        accessQuery.$and[0][allowKey] = {$in: [dbUtil.USER_KEYS.all]};
        accessQuery.$and[1][disallowKey] = {$nin: [this.user.id, dbUtil.USER_KEYS.all]};
        query.$and.push(accessQuery);
      }
    });
    return query;
  }

  async buildListQuery(namespace, type, params) {
    const {schema, namespaceVersion} = await this.getSchema(namespace, type);
    const query = {};
    const sort = {}
    const skip = params.skip || 0;
    const pageSize = params.pageSize || DEFAULT_PAGE_SIZE;
    if (params.sort) {
      const parts = params.sort.split(':');
      if (parts.length === 1) parts.push('ascending');
      sort[parts[0]] = parts[1] === 'ascending' ? 1 : -1;
    }
    if (params.created_since) {
      query['info.created'] = {$gt: new Date(params.created_since)}
    }
    if (params.created_before) {
      query['info.created'] = {$lt: new Date(params.created_before)}
    }
    if (params.updated_since) {
      query['info.updated'] = {$gt: new Date(params.updated_since)}
    }
    if (params.updated_before) {
      query['info.updated'] = {$lt: new Date(params.updated_before)}
    }
    if (params.owner) {
      query['acl.owner'] = {$eq: params.owner}
    }
    for (let key in params) {
      if (key !== 'data' && !key.startsWith('data.')) continue;
      let parts = key.split('.');
      parts.shift();
      let subschema = schema;
      for (let part of parts) {
        subschema = subschema &&
              ((subschema.properties && subschema.properties[part]) || subschema.additionalProperties);
      }
      if (!subschema) return fail(`No subschema found for ${key}`, 400);
      if (subschema.type === 'number') {
        try {
          query[key] = parseFloat(params[key]);
        } catch(e) {}
      } else if (subschema.type === 'integer') {
        try {
          query[key] = parseInt(params[key]);
        } catch (e) {}
      } else if (subschema.type === 'boolean') {
        try {
          query[key] = parseBoolean(params[key]);
        } catch (e) {}
      } else {
        query[key] = params[key];
      }
    }
    return {query, sort, pageSize, skip}
  }

  async getAll(namespace, type, query={}, access='read', sort=DEFAULT_SORT, limit=DEFAULT_PAGE_SIZE, skip=0, keepACL=false) {
    this.checkNamespace(namespace);
    if (Object.keys(sort).length !== 1) sort = DEFAULT_SORT;
    const col = this.getCollection(namespace, type);
    query = this.buildQuery(namespace, type, query, access);
    let arr = await col.find(query).sort(sort).skip(skip).limit(limit).toArray();
    arr = arr.map(item => {
      let data = dbUtil.decodeDocument(item.data);
      data.$ = {
        id: item.id,
        info: item.info,
      }
      if (keepACL) data.$.acl = item.acl;
      return data;
    })
    return JSON.parse(JSON.stringify(arr));
  }

  async count(namespace, type, query) {
    this.checkNamespace(namespace);
    const col = this.getCollection(namespace, type);
    query = this.buildQuery(namespace, type, query, 'read');
    let count = await col.find(query).count();
    return count;
  }

  async get(namespace, type, id, access='read') {
    this.checkNamespace(namespace);
    const arr = await this.getAll(namespace, type, {id}, access);
    if (arr.length > 1) return fail(`Multiple items found for ${namespace}/${type}/${id}`);
    if (!arr.length) return;
    return arr[0];
  }

  async getACL(namespace, type, id) {
    this.checkNamespace(namespace);
    const arr = await this.getAll(namespace, type, {id}, 'read', DEFAULT_SORT, DEFAULT_PAGE_SIZE, 0, true);
    if (arr.length > 1) return fail(`Multiple items found for ${namespace}/${type}/${id}`);
    if (!arr.length) return;
    return arr[0].$.acl;
  }

  async list(namespace, type, query={}, sort=DEFAULT_SORT, pageSize, skip) {
    this.checkNamespace(namespace);
    return this.getAll(namespace, type, query, 'read', sort, pageSize, skip);
  }

  async disassemble(namespace, data, schema) {
    if (namespace === 'core') return data;  // TODO: remove special case
    if (!schema || (typeof data) !== 'object') return data;
    if (Array.isArray(data)) {
      let newData = [];
      for (let datum of data) {
        newData.push(await this.disassemble(namespace, datum, schema.items));
      }
      return newData;
    }
    if (schema.$ref) {
      if (data.$ref) return data;
      let match = schema.$ref.match(/#\/definitions\/(\w+)/);
      if (!match) return data;
      let id = null;
      if (data.$ && data.$.id) {
        id = data.$.id;
        delete data.$;
        await this.update(namespace, match[1], id, data);
      } else {
        let item = await this.create(namespace, match[1], data);
        id = item.$.id;
      }
      return {$ref: '/data/' + namespace + '/' + match[1] + '/' + id};
    }
    for (let key in data) {
      let subschema = (schema.properties || {})[key] || schema.additionalProperties;
      data[key] = await this.disassemble(namespace, data[key], subschema);
    }
    return data;
  }

  async disassembleNamespace(data) {
    for (let version of data.versions) {
      let definitions = {};
      for (let type in version.types) {
        let schema = version.types[type].schema;
        if (!schema) return fail("No schema specified for type " + type, 400);
        if (!schema.$ref) {
          definitions[type] = schema;
        }
      }
      for (let type in version.types) {
        let schema = Object.assign({definitions}, version.types[type].schema);
        if (!schema.$ref) {
          let newSchema = await this.create('core', 'schema', schema);
          version.types[type].schema = {$ref: '/data/core/schema/' + newSchema.$.id};
        }
      }
    }
    return data;
  }

  async create(namespace, type, id, data) {
    if (typeof data === 'undefined') {
      data = id;
      id = undefined;
    }
    this.checkNamespace(namespace);
    if (this.user.data.items >= this.config.maxItemsPerUser) {
      return fail(`You have hit your maximum of ${this.config.maxItemsPerUser} items. Please delete something to create a new one`, 403);
    }
    if (!this.checkPermission(namespace, type, 'create')) {
      return fail(`This app does not have permission to create items in ${namespace}/${type}`, 401);
    }
    const {schema, namespaceVersion} = await this.getSchema(namespace, type);
    id = id || randomstring.generate(ID_LENGTH); // TODO: make sure random ID is not taken
    let err = validate.validators.itemID(id);
    if (err) return fail(err);
    const existing = await this.get(namespace, type, id, 'force');
    if (existing) return fail(`Item ${namespace}/${type}/${id} already exists`);
    const acl = namespaceVersion.types[type].initial_acl || JSON.parse(JSON.stringify(dbUtil.OWNER_ACL_SET));
    acl.owner = this.user.id;
    if (namespace === 'core') {
      if (type === 'schema' && id !== 'schema') {
        let err = validate.validators.schema(data);
        if (err) return fail(err, 400);
        data.properties = data.properties || {}
        data.properties.$ = {type: 'object'};
      } else if (type === 'user') {
        acl.owner = id;
      } else if (type === 'namespace') {
        data.versions = [data.versions[0]];
        data.versions[0].version = '0.0';
        await this.disassembleNamespace(data);
      }
    }

    const time = new Date(Date.now());
    const info = {
      created: time,
      updated: time,
      created_by: this.user.id,
      namespace_version: namespaceVersion.version,
    }

    delete data.$;
    const obj = {id, data, info, acl};
    data = await this.disassemble(namespace, data, schema);
    await this.validate(obj, schema, namespace, type);
    const col = this.getCollection(namespace, type);
    const result = await col.insert({
      id: obj.id,
      info: obj.info,
      acl: obj.acl,
      data: dbUtil.encodeDocument(obj.data),
    });

    const userUpdate = {
      $inc: {'data.items': 1},
      $addToSet: {'data.namespaces': namespace},
    }
    const userCol = this.getCollection('core', 'user');
    await userCol.update({id: this.user.id}, userUpdate);
    await this.refreshUser();
    return Object.assign({$: {id, info, acl}}, obj.data);
  }

  async update(namespace, type, id, data) {
    this.checkNamespace(namespace);
    const query = this.buildQuery(namespace, type, {id}, 'write');
    const {schema, namespaceVersion} = await this.getSchema(namespace, type);
    delete data.$;
    data = await this.disassemble(namespace, data, schema)
    await this.validate({data}, schema, namespace, type);
    const col = this.getCollection(namespace, type);
    const result = await col.update(query, {
      $set: {
        data: dbUtil.encodeDocument(data),
        'info.updated': new Date(Date.now()),
        'info.namespace_version': namespaceVersion.version,
      },
    });
    if (result.result.n === 0) return fail(`User ${this.userID} cannot update ${namespace}/${type}/${id}, or ${namespace}/${type}/${id} does not exist`, 401);
    if (result.result.n > 1) return fail(`Multiple items found for ${namespace}/${type}/${id}`);
  }

  async append(namespace, type, id, data) {
    const query = this.buildQuery(namespace, type, {id}, 'append');
    const col = this.getCollection(namespace, type);
    const existing = await this.get(namespace, type, id, 'force');
    if (!existing) return fail(`User ${this.userID} cannot update ${namespace}/${type}/${id}, or ${namespace}/${type}/${id} does not exist`, 401);
    delete existing.$;
    const {schema, namespaceVersion} = await this.getSchema(namespace, type);
    if (namespace === 'core' && type === 'namespace') {
      data = await this.disassembleNamespace(data);
      const lastVersion = existing.versions[existing.versions.length - 1];
      let previousID = lastVersion.version;
      (data.versions || []).forEach(newVersion => {
        previousID = newVersion.version = (Math.floor(+previousID) + 1).toString() + '.0';
      });
    } else {
      data = await this.disassemble(namespace, data, schema);
    }
    const doc = {$push: {}}
    for (let key in data) {
      if (!Array.isArray(data[key])) continue;
      let subschema = schema.properties && schema.properties[key];
      subschema = subschema && subschema.items;
      if (!subschema) return fail(`Schema not found for key ${key}`, 400);
      subschema.definitions = schema.definitions;
      let subtype = type;
      if (schema.$ref) {
        subtype = subschema.$ref.split('/').pop();
      }
      for (let item of data[key]) {
        await this.validate({data: item}, subschema, namespace, subtype);
      }
      existing[key] = (existing[key] || []).concat(data[key]);
      doc.$push['data.' + key] = {$each: dbUtil.encodeDocument(data[key])};
    }

    const newDoc = JSON.stringify(existing);
    if (newDoc.length > this.config.maxBytesPerItem) {
      return fail(`Item ${namespace}/${type}/${id} would exceed the maximum of ${this.config.maxBytesPerItem} bytes`);
    }

    const result = await col.update(query, doc);
    if (result.result.nModified === 0) {
      return fail(`User ${this.userID} cannot update ${namespace}/${type}/${id}, or ${namespace}/${type}/${id} does not exist`, 401);
    }
    if (result.result.nModified > 1) {
      return fail(`Multiple items found for ${namespace}/${type}/${id}`);
    }
  }

  async modifyACL(namespace, type, id, acl) {
    this.checkNamespace(namespace);
    const copyACL = JSON.parse(JSON.stringify(acl)); // Make a copy where defaults are set
    await this.validate({acl: Object.assign({owner: 'dummy'}, copyACL)});
    const {schema, namespaceVersion} = await this.getSchema(namespace, type);
    const necessaryPermissions = [];
    let query = {$and: [{id}]};
    const update = {$set: {}};
    for (let key in acl) {
      if (key === 'owner') {
        query.$and.push({'acl.owner': this.user.id});
        update.$set['acl.owner'] = acl.owner;
      } else {
        for (let permission in acl[key]) {
          necessaryPermissions.push(permission);
          update.$set['acl.' + key + '.' + permission] = acl[key][permission];
        }
      }
    }
    query = this.buildQuery(namespace, type, query, necessaryPermissions, true);
    const col = this.getCollection(namespace, type);
    const result = await col.update(query, update);
    if (result.result.n === 0) return fail(`User ${this.userID} cannot update ACL for ${namespace}/${type}/${id}, or ${namespace}/${type}/${id} does not exist`, 401);
    if (result.result.n > 1) return fail(`Multiple items found for ${namespace}/${type}/${id}`);
  }

  async delete(namespace, type, id) {
    this.checkNamespace(namespace);
    let query = {id};
    query = this.buildQuery(namespace, type, query, 'delete');
    const col = this.getCollection(namespace, type);
    const result = await col.remove(query, {justOne: true});
    if (result.result.n === 0) return fail(`User ${this.userID} cannot delete ${namespace}/${type}/${id}, or ${namespace}/${type}/${id} does not exist`, 401);
    const userUpdate = {
      $inc: {'data.items': -1}
    };
    const userCol = this.getCollection('core', 'user');
    await userCol.update({id: this.user.id}, userUpdate);
    await this.refreshUser();
  }

  async cacheRefs(data, cache={}) {
    if (typeof data !== 'object') {
      return cache
    }
    if (Array.isArray(data)) {
      await Promise.all(data.map(datum => {
        return this.cacheRefs(datum, cache);
      }));
      return cache;
    }
    for (let key in data) {
      if (key === '$ref') {
        const match = data[key].match(REF_REGEX);
        if (!match) continue;
        const [full, ns, type, id] = match;
        cache[ns] = cache[ns] || {};
        cache[ns][type] = cache[ns][type] || {}
        if (cache[ns][type][id]) continue;
        const toCache = await this.get(ns, type, id);
        if (toCache) {
          cache[ns][type][id] = toCache;
        }
      } else {
        await this.cacheRefs(data[key], cache)
      }
    }
    return cache;
  }
}

module.exports = Database;
