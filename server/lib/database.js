const mongodb = require('mongodb');
const randomstring = require("randomstring");
const validate = require('./validate');
const util = require('./util');

const DB_NAME = 'freedb';
const ID_LENGTH = 8;
const STAGING_KEY = 'staging';

const START_TIME = (new Date()).toISOString();

const USER_KEYS = {
  all: '_all',
  system: '_system',
  owner: '_owner',
}

const DEFAULT_ACL = {
  read: [USER_KEYS.owner],
  write: [USER_KEYS.owner],
  append: [USER_KEYS.owner],
  destroy: [USER_KEYS.owner],
  modify_read: [USER_KEYS.owner],
  modify_write: [USER_KEYS.owner],
  modify_append: [USER_KEYS.owner],
  modify_destroy: [USER_KEYS.owner],
}

const SYSTEM_ACL = {
  owner: USER_KEYS.system,
  read: [USER_KEYS.all],
  write: [USER_KEYS.system],
  append: [USER_KEYS.system],
  destroy: [USER_KEYS.system],
  modify_read: [USER_KEYS.system],
  modify_write: [USER_KEYS.system],
  modify_append: [USER_KEYS.system],
  modify_destroy: [USER_KEYS.system],
};

const SYSTEM_INFO = {
  created: START_TIME,
  updated: START_TIME,
  created_by: USER_KEYS.system,
}

const CORE_OBJECTS = [{
  namespace: 'core',
  schema: 'user',
  document: {
    id: USER_KEYS.system,
    info: SYSTEM_INFO,
    acl: SYSTEM_ACL,
    data: {
      publicKey: '',
    }
  }
}, {
  namespace: 'core',
  schema: 'namespace',
  document: {
    id: 'core',
    info: SYSTEM_INFO,
    acl: SYSTEM_ACL,
    data: {
      id: 'core',
      versions: [{
        verision: '0',
        types: {
          user: {
            schema: {$ref: '/data/core/schema/user'},
            initial_acl: {
              read: [USER_KEYS.all],
              write: [USER_KEYS.owner],
            }
          },
          schema: {
            schema: {$ref: '/data/core/schema/schema'},
            initial_acl: {
              read: [USER_KEYS.all],
            }
          },
          namespace: {
            schema: {$ref: '/data/core/schema/namespace'},
            initial_acl: {
              read: [USER_KEYS.all],
              write: [USER_KEYS.owner],  // TODO: change this to append
            }
          },
        },
      }],
    }
  }
}, {
  namespace: 'core',
  schema: 'schema',
  document: {
    id: 'schema',
    info: SYSTEM_INFO,
    acl: SYSTEM_ACL,
    data: require('./schemas/schema'),
  }
}]

const CORE_TYPES = [{
  id: 'namespace',
  schema: require('./schemas/namespace'),
}, {
  id: 'user',
  schema: require('./schemas/user'),
}];

class Database {
  constructor(url) {
    this.url = url;
  }

  async initialize() {
    if (this.client) throw new Error("Database already initialized");
    this.client = await mongodb.MongoClient.connect(this.url, {useNewUrlParser: true});
    for (let obj of CORE_OBJECTS) {
      let coll = this.client.db(DB_NAME).collection(obj.namespace + '-' + obj.schema);
      let existing = await coll.find({id: obj.document.id}).toArray();
      if (!existing[0]) {
        let encoded = util.encodeDocument(obj.document);
        await coll.insert(encoded);
      }
    }
    let db = await this.user(USER_KEYS.system);
    for (let type of CORE_TYPES) {
      let existing = await db.get('core', 'schema', type.id);
      if (!existing) {
        existing = await db.create('core', 'schema', type.schema, type.id);
      }
    }
  }

  async user(user) {
    let db = new DatabaseForUser({client: this.client, user});
    await db.initialize();
    return db;
  }

  async createUser(publicKey) {
    let db = await this.user(USER_KEYS.system);
    let existing = await db.getCollection('core', 'user').find({'data.publicKey': publicKey}).toArray();
    if (existing.length) throw new Error("Public key already exists");
    let user = await db.create('core', 'user', {publicKey});
    return user;
  }
}

class DatabaseForUser {
  constructor(opts) {
    this.client = opts.client;
    this.userID = opts.user;
  }

  async initialize() {
    let users = await this.getCollection('core', 'user').find({id: this.userID}).toArray();
    if (!users || !users[0]) throw new Error(`User ${this.userID} not found`);
    if (users.length > 1) throw new Error("Multiple users found for ID " + this.userID);
    this.user = users[0];
  }

  getCollection(namespace, schema) {
    const collectionName = namespace + '-' + schema;
    return this.client.db(DB_NAME).collection(collectionName);
  }

  async validate(obj, schema=null) {
    if (schema) {
      let err = validate.validators.data(obj.data, schema);
      if (err) throw new Error(err);
    }
    if (obj.acl) {
      let err = validate.validators.acl(obj.acl);
      if (err) throw new Error(err);
    }
    if (obj.info) {
      let err = validate.validators.info(obj.info);
      if (err) throw new Error(err);
    }
  }

  async getSchema(namespace, schema) {
    const namespaceInfo = await this.get('core', 'namespace', namespace);
    if (!namespaceInfo) throw new Error(`Namespace ${namespace} not found`);
    const nsVersion = namespaceInfo.data.versions[namespaceInfo.data.versions.length - 1];
    if (!nsVersion) throw new Error(`Namespace ${namespace}@${namespaceInfo.data.versions.length - 1} not found`);
    const schemaRef = (nsVersion.types[schema] || {schema: {$ref: ''}}).schema.$ref.split('/').pop();
    if (!schemaRef) throw new Error(`Schema ${namespace}/${schema} not found`);
    const schemaInfo = await this.get('core', 'schema', schemaRef);
    if (!schemaInfo) throw new Error(`Item core/schema/${schemaRef} not found`);
    return {schemaInfo, namespaceInfo: nsVersion};
  }

  buildQuery(query={}, accesses='read') {
    if (accesses !== 'force') {
      query.$and = query.$and || [];
      if (typeof accesses === 'string') accesses = [accesses];
      accesses.forEach(access => {
        const ownerQuery = {$and: [{'acl.owner': this.user.id}, {}]};
        ownerQuery.$and[1]['acl.' + access] = {$in: [USER_KEYS.owner]};
        const accessQuery = {};
        accessQuery['acl.' + access] = {$in: [this.user.id, USER_KEYS.all]};
        query.$and.push({$or: [ownerQuery, accessQuery]});
      });
    }
    return query;
  }

  async getAll(namespace, schema, query={}, access='read') {
    const col = this.getCollection(namespace, schema);
    query = this.buildQuery(query, access);
    let arr = await col.find(query).toArray();
    let decoded = util.decodeDocument(arr);
    return util.decodeDocument(JSON.parse(JSON.stringify(arr)));
  }

  async get(namespace, schema, id, access='read') {
    const arr = await this.getAll(namespace, schema, {id}, access);
    if (arr.length > 1) throw new Error(`Multiple items found for ${namespace}/${schema}/${id}`);
    if (!arr.length) return;
    return arr[0];
  }

  async create(namespace, schema, data, id='') {
    const {schemaInfo, namespaceInfo} = await this.getSchema(namespace, schema);
    id = id || randomstring.generate(ID_LENGTH); // TODO: make sure random ID is not taken
    let err = validate.validators.itemID(id);
    if (err) throw new Error(err);
    const existing = await this.get(namespace, schema, id);
    if (existing) throw new Error(`Item ${namespace}/${schema}/${id} already exists`);
    let acl = JSON.parse(JSON.stringify(Object.assign({}, DEFAULT_ACL, namespaceInfo.types[schema].initial_acl)));
    acl.owner = this.user.id;
    if (namespace === 'core') {
      if (schema === 'schema') {
        util.fixSchemaRefs(data, id);
      } else if (schema === 'user') {
        acl.owner = id;
      }
    }

    const time = (new Date()).toISOString();
    const info = {
      created: time,
      updated: time,
      created_by: this.user.id,
    }

    const obj = {id, data, info, acl};
    await this.validate(obj, schemaInfo.data);
    const col = this.getCollection(namespace, schema);
    let result = await col.insert(util.encodeDocument([obj]));
    return obj;
  }

  async update(namespace, schema, id, data) {
    const query = this.buildQuery({id}, 'write');
    const {schemaInfo, namespaceInfo} = await this.getSchema(namespace, schema);
    await this.validate({data}, schemaInfo.data);
    const col = this.getCollection(namespace, schema);
    const result = await col.update(query, {
      $set: {
        data: util.encodeDocument(data),
        'info.updated': (new Date()).toISOString(),
      },
    });
    if (result.result.nModified === 0) throw new Error(`User ${this.userID} cannot update ${namespace}/${schema}/${id}, or ${namespace}/${schema}/${id} does not exist`);
    if (result.result.nModified > 1) throw new Error(`Multiple items found for ${namespace}/${schema}/${id}`);
  }

  async setACL(namespace, schema, id, acl) {
    await this.validate({acl: Object.assign({owner: 'dummy'}, acl)});
    const {schemaInfo, namespaceInfo} = await this.getSchema(namespace, schema);
    const necessaryPermissions = [];
    let query = {$and: [{id}]};
    const update = {$set: {}};
    for (let key in acl) {
      if (key === 'owner') {
        query.$and.push({'acl.owner': this.user.id});
        update.$set['acl.owner'] = acl.owner;
      } else {
        let aclKey = key.startsWith('modify_') ? key : 'modify_' + key;
        necessaryPermissions.push(aclKey);
        update.$set['acl.' + key] = acl[key];
      }
    }
    query = this.buildQuery(query, necessaryPermissions);
    const col = this.getCollection(namespace, schema);
    const result = await col.update(query, update);
    if (result.result.nModified === 0) throw new Error(`User ${this.userID} cannot update ACL for ${namespace}/${schema}/${id}, or ${namespace}/${schema}/${id} does not exist`);
    if (result.result.nModified > 1) throw new Error(`Multiple items found for ${namespace}/${schema}/${id}`);
  }

  async destroy(namespace, schema, id) {
    let query = {id};
    query = this.buildQuery(query, 'destroy');
    const col = this.getCollection(namespace, schema);
    const result = await col.remove(query, {justOne: true});
    if (result.result.n === 0) throw new Error(`User ${this.userID} cannot destroy ${namespace}/${schema}/${id}, or ${namespace}/${schema}/${id} does not exist`);
  }
}

module.exports = Database;
