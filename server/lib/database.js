const mongodb = require('mongodb');
const randomstring = require("randomstring");
const validate = require('./validate');
const util = require('./util');

const DB_NAME = 'freedb';
const ID_LENGTH = 8;
const STAGING_KEY = 'staging';
const DEFAULT_ID_FIELD = 'id';

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
  type: 'user',
  document: {
    id: USER_KEYS.system,
    acl: SYSTEM_ACL,
    data: {
      publicKey: '',
    }
  }
}, {
  namespace: 'core',
  type: 'namespace',
  document: {
    id: 'core',
    acl: SYSTEM_ACL,
    data: {
      id: 'core',
      versions: [{
        verision: '0',
        types: {
          type: {$ref: '/core/type/type'},
          namespace: {$ref: '/core/type/namespace'},
          user: {$ref: '/core/type/user'},
        },
      }],
    }
  }
}, {
  namespace: 'core',
  type: 'type',
  document: {
    id: 'type',
    acl: SYSTEM_ACL,
    data: {
      id: 'type',
      schema: require('./schemas/type'),
    }
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
      let coll = this.client.db(DB_NAME).collection(obj.namespace + '-' + obj.type);
      let existing = await coll.find({id: obj.document.id}).toArray();
      if (!existing[0]) {
        let encoded = util.encodeDocument(obj.document);
        await coll.insert(encoded);
      }
    }
    let db = await this.user(USER_KEYS.system);
    for (let type of CORE_TYPES) {
      let existing = await db.get('core', 'type', type.id, SYSTEM_ACL);
      if (!existing) {
        existing = await db.create('core', 'type', type, SYSTEM_ACL);
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

  getCollection(namespace, type) {
    const collectionName = namespace + '-' + type;
    return this.client.db(DB_NAME).collection(collectionName);
  }

  async validate(schema, obj) {
    let err = validate.validators.data(obj.data, schema);
    if (err) throw new Error(err);
    err = validate.validators.acl(obj.acl);
    if (err) throw new Error(err);
  }

  async getAll(namespace, type, query={}, access='read') {
    const col = this.getCollection(namespace, type);
    query.$or = [{
      'acl.owner': this.user.id,
    }, {}]
    query.$or[1]['acl.' + access] = {$in: [this.user.id, USER_KEYS.all]};
    let arr = await col.find(query).toArray();
    let decoded = util.decodeDocument(arr);
    return util.decodeDocument(JSON.parse(JSON.stringify(arr)));
  }

  async getType(namespace, type) {
    const ns = await this.get('core', 'namespace', namespace);
    if (!ns) throw new Error(`Namespace ${namespace} not found`);
    const nsVersion = ns.data.versions[ns.data.versions.length - 1];
    if (!nsVersion) throw new Error(`Namespace ${namespace}@${ns.data.versions.length - 1} not found`);
    const typeRef = (nsVersion.types[type] || {$ref: ''}).$ref.split('/').pop();
    if (!typeRef) throw new Error(`Type ${namespace}/${type} not found`);
    const typeInfo = await this.get('core', 'type', typeRef);
    if (!typeInfo) throw new Error(`Item core/type/${typeRef} not found`);
    return typeInfo;
  }

  async get(namespace, type, id, access='read') {
    const arr = await this.getAll(namespace, type, {id}, access);
    if (arr.length > 1) throw new Error(`Multiple items found for ${namespace}/${type}/${id}`);
    if (!arr.length) return;
    return arr[0];
  }

  async create(namespace, type, data, acl={}) {
    acl.owner = this.user.id;
    const typeInfo = await this.getType(namespace, type);
    let id = randomstring.generate(ID_LENGTH);
    if (typeInfo.idField !== null) {
      id = data[typeInfo.idField || DEFAULT_ID_FIELD] || id;
    }
    let err = validate.validators.itemID(id);
    if (err) throw new Error(err);
    if (namespace === 'core') {
      acl.read = [USER_KEYS.all];
      if (type === 'type') {
        acl.owner = USER_KEYS.system;
        util.fixSchemaRefs(data.schema, id);
      } else if (type === 'user') {
        acl.owner = id;
      }
    }
    const existing = await this.get(namespace, type, id);
    if (existing) throw new Error(`Item ${namespace}/${type}/${id} already exists`);
    const obj = {id, data, acl};
    await this.validate(typeInfo.data.schema, obj);
    const col = this.getCollection(namespace, type);
    let result = await col.insert(util.encodeDocument([obj]));
    return obj;
  }

  async update(namespace, type, id, data) {
    const existing = await this.get(namespace, type, id, 'update');
    if (!existing) throw new Error(`User ${this.userID} cannot update ${namespace}/${type}/${id}, or ${namespace}/${type}/${id} does not exist`);
    const typeInfo = await this.getType(namespace, type);
    await this.validate(typeInfo.data.schema, {id, data, acl: {owner: 'dummy'}});
    const col = this.getCollection(namespace, type);
    // TODO: make idField readOnly
    const result = await col.update({id}, {$set: {data: util.encodeDocument(data)}});
    return result;
  }
}

module.exports = Database;
