const mongodb = require('mongodb');
const randomstring = require("randomstring");
const validate = require('./validate');
const util = require('./util');

const DB_NAME = 'freedb';
const ID_LENGTH = 8;
const STAGING_KEY = 'staging';

const USER_KEYS = {
  all: '_all',
  system: '_system',
}

const SYSTEM_ACL = {
  owner: USER_KEYS.system,
  read: [USER_KEYS.all],
};

const CORE_OBJECTS = [{
  namespace: 'core',
  schema: 'user',
  document: {
    id: USER_KEYS.system,
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
    acl: SYSTEM_ACL,
    data: {
      id: 'core',
      versions: [{
        verision: '0',
        schemas: {
          schema: {$ref: '/core/schema/schema'},
          namespace: {$ref: '/core/schema/namespace'},
          user: {$ref: '/core/schema/user'},
        },
      }],
    }
  }
}, {
  namespace: 'core',
  schema: 'schema',
  document: {
    id: 'schema',
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
      let existing = await db.get('core', 'schema', type.id, SYSTEM_ACL);
      if (!existing) {
        existing = await db.create('core', 'schema', type.schema, type.id, SYSTEM_ACL);
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

  async validate(schema, obj) {
    let err = validate.validators.data(obj.data, schema);
    if (err) throw new Error(err);
    err = validate.validators.acl(obj.acl);
    if (err) throw new Error(err);
  }

  async getAll(namespace, schema, query={}, access='read') {
    const col = this.getCollection(namespace, schema);
    query.$or = [{
      'acl.owner': this.user.id,
    }, {}]
    query.$or[1]['acl.' + access] = {$in: [this.user.id, USER_KEYS.all]};
    let arr = await col.find(query).toArray();
    let decoded = util.decodeDocument(arr);
    return util.decodeDocument(JSON.parse(JSON.stringify(arr)));
  }

  async getSchema(namespace, schema) {
    const ns = await this.get('core', 'namespace', namespace);
    if (!ns) throw new Error(`Namespace ${namespace} not found`);
    const nsVersion = ns.data.versions[ns.data.versions.length - 1];
    if (!nsVersion) throw new Error(`Namespace ${namespace}@${ns.data.versions.length - 1} not found`);
    const schemaRef = (nsVersion.schemas[schema] || {$ref: ''}).$ref.split('/').pop();
    if (!schemaRef) throw new Error(`Schema ${namespace}/${schema} not found`);
    const schemaInfo = await this.get('core', 'schema', schemaRef);
    if (!schemaInfo) throw new Error(`Item core/schema/${schemaRef} not found`);
    return schemaInfo;
  }

  async get(namespace, schema, id, access='read') {
    const arr = await this.getAll(namespace, schema, {id}, access);
    if (arr.length > 1) throw new Error(`Multiple items found for ${namespace}/${schema}/${id}`);
    if (!arr.length) return;
    return arr[0];
  }

  async create(namespace, schema, data, id='', acl={}) {
    acl.owner = this.user.id;
    const schemaInfo = await this.getSchema(namespace, schema);
    id = id || randomstring.generate(ID_LENGTH); // TODO: make sure random ID is not taken
    let err = validate.validators.itemID(id);
    if (err) throw new Error(err);
    if (namespace === 'core') {
      acl.read = [USER_KEYS.all];
      if (schema === 'schema') {
        acl.owner = USER_KEYS.system;
        util.fixSchemaRefs(data, id);
      } else if (schema === 'user') {
        acl.owner = id;
      }
    }
    const existing = await this.get(namespace, schema, id);
    if (existing) throw new Error(`Item ${namespace}/${schema}/${id} already exists`);
    const obj = {id, data, acl};
    await this.validate(schemaInfo.data, obj);
    const col = this.getCollection(namespace, schema);
    let result = await col.insert(util.encodeDocument([obj]));
    return obj;
  }

  async update(namespace, schema, id, data) {
    const existing = await this.get(namespace, schema, id, 'update');
    if (!existing) throw new Error(`User ${this.userID} cannot update ${namespace}/${schema}/${id}, or ${namespace}/${schema}/${id} does not exist`);
    const schemaInfo = await this.getSchema(namespace, schema);
    await this.validate(schemaInfo.data, {id, data, acl: {owner: 'dummy'}});
    const col = this.getCollection(namespace, schema);
    const result = await col.update({id}, {$set: {data: util.encodeDocument(data)}});
    return result;
  }

  async setACL(namespace, schema, id, acl) {
    const existing = await this.get(namespace, schema, id, 'acl');
    if (!existing) throw new Error(`User ${this.userID} cannot update ACL for ${namespace}/${schema}/${id}, or ${namespace}/${schema}/${id} does not exist`);
    const schemaInfo = await this.getSchema(namespace, schema);
    existing.acl = acl;
    await this.validate(schemaInfo.data, existing);
    const col = this.getCollection(namespace, schema);
    const result = await col.update({id}, {$set :{acl}});
  }

  async destroy(namespace, schema, id) {
    const existing = await this.get(namespace, schema, id, 'destroy');
    if (!existing) throw new Error(`User ${this.userID} cannot destroy ${namespace}/${schema}/${id}, or ${namespace}/${schema}/${id} does not exist`);
    const col = this.getCollection(namespace, schema);
    const result = await col.remove({id}, {justOne: true});
  }
}

module.exports = Database;
