const mongodb = require('mongodb');
const jsonSchemaSchema = JSON.parse(JSON.stringify(require('ajv/lib/refs/json-schema-draft-07.json')));
const randomstring = require("randomstring");
const validate = require('./validate');
const util = require('./util');

function fixCoreSchema(schema) {
  if (typeof schema !== 'object') return;
  if (Array.isArray(schema)) return schema.forEach(fixCoreSchema);
  if (schema.$ref === '#') schema.$ref = '#/definitions/jsonSchema';
  for (let key in schema) fixCoreSchema(schema[key]);
}
fixCoreSchema(jsonSchemaSchema);
const jsonSchemaDefinitions = JSON.parse(JSON.stringify(jsonSchemaSchema.definitions));
jsonSchemaDefinitions.jsonSchema = jsonSchemaSchema;
delete jsonSchemaSchema.$id;
delete jsonSchemaSchema.definitions;

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

const CORE_TYPES = [{
  namespace: 'core',
  type: 'namespace',
  schema: {
    type: 'object',
    properties: {
      id: {type: 'string'},
      latestVersion: {type: 'string'},
      versions: {type: 'array', items: {type: 'string'}},
    },
    additionalProperties: false,
  }
}, {
  namespace: 'core',
  type: 'user',
  schema: {
    type: 'object',
    properties: {
      publicKey: {type: 'string'},
    },
    additionalProperties: false,
  },
}];

const CORE_OBJECTS = [{
  namespace: 'core',
  type: 'namespace',
  document: {
    id: 'core',
    acl: SYSTEM_ACL,
    data: {
      id: 'core',
      versions: [],
    }
  }
}, {
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
  type: 'type',
  document: {
    id: 'core/type',
    acl: SYSTEM_ACL,
    data: {
      namespace: 'core',
      type: 'type',
      versions: [{
        version: '0',
        schema: {
          type: 'object',
          definitions: jsonSchemaDefinitions,
          properties: {
            namespace: {type: 'string'},
            type: {type: 'string'},
            versions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idField: {type: 'string', default: DEFAULT_ID_FIELD},
                  version: {type: 'string'},
                  schema: jsonSchemaSchema,
                },
                additionalProperties: false,
              }
            }
          },
          additionalProperties: false,
        }
      }]
    }
  }
}]

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
      let existing = await db.get(type.namespace, 'type', type.type, SYSTEM_ACL);
      if (!existing) {
        await db.create(type.namespace, 'type', type, SYSTEM_ACL);
      }
    }
    await db.publishNamespace('core');
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

  async validate(typeInfo, obj) {
    let err = validate.validators.data(obj.data, typeInfo.schema);
    if (err) throw new Error(err);
    err = validate.validators.acl(obj.acl);
    if (err) throw new Error(err);
  }

  async publishNamespace(name) {
    const namespace = await this.get('core', 'namespace', name);
    if (namespace.acl.owner !== this.user.id) throw new Error(`User ${this.user.id} does not own namespace ${name}`);
    namespace.data.versions = namespace.data.versions || [];
    const newVersion = namespace.data.versions.length.toString();
    namespace.data.versions.push(newVersion);
    namespace.data.latestVersion = newVersion;
    const types = await this.getAll('core', 'type', {'data.namespace': name});
    for (let type of types) {
      let stagingVersion = type.data.versions.shift();
      if (stagingVersion.version !== 'staging') continue;
      stagingVersion.version = newVersion;
      type.data.versions.push(stagingVersion);
      await this.update('core', 'type', type.id, type.data);
    }
    await this.update('core', 'namespace', name, namespace.data);
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

  async get(namespace, type, id, access='read') {
    const arr = await this.getAll(namespace, type, {id}, access);
    if (arr.length > 1) throw new Error(`Multiple items found for ${namespace}/${type}/${id}`);
    if (!arr.length) return;
    return arr[0];
  }

  async create(namespace, type, data, acl={}) {
    acl.owner = this.user.id;
    const typeVersions = await this.get('core', 'type', namespace + '/' + type);
    if (!typeVersions) throw new Error(`Type ${namespace}/${type} not found`);
    const typeInfo = typeVersions.data.versions[typeVersions.data.versions.length - 1];
    let id = data[typeInfo.idField || DEFAULT_ID_FIELD] || randomstring.generate(ID_LENGTH);
    if (namespace === 'core' && type === 'type') {
      const namespaceInfo = await this.get('core', 'namespace', data.namespace);
      if (!namespaceInfo) throw new Error(`Namespace ${data.namespace} not found`);
      if (namespaceInfo.acl.owner !== acl.owner) throw new Error(`User ${acl.owner} does not own namespace ${data.namespace}`);
      id = data.namespace + '/' + data.type;
      data = {
        namespace: data.namespace,
        type: data.type,
        versions: [{version: STAGING_KEY, schema: data.schema, idField: data.idField || DEFAULT_ID_FIELD}],
      }
    } else if (namespace === 'core' && type === 'user') {
      acl.owner = id;
    }
    if (namespace === 'core') {
      acl.read = [USER_KEYS.all];
    }
    const existing = await this.get(namespace, type, id);
    if (existing) throw new Error(`Item ${namespace}/${type}/${id} already exists`);
    const obj = {id, data, acl};
    await this.validate(typeInfo, obj);
    const col = this.getCollection(namespace, type);
    let result = await col.insert(util.encodeDocument([obj]));
    return obj;
  }

  async update(namespace, type, id, data) {
    const existing = this.get(namespace, type, id, 'update');
    if (!existing) throw new Error(`User ${this.userID} cannot update ${namespace}/${type}/${id}, or ${namespace}/${type}/${id} does not exist`);
    const typeVersions = await this.get('core', 'type', namespace + '/' + type);
    if (!typeVersions) throw new Error(`Type ${namespace}/${type} not found`);
    const typeInfo = typeVersions.data.versions[typeVersions.data.versions.length - 1];
    await this.validate(typeInfo, {id, data, acl: {owner: 'dummy'}});
    const col = this.getCollection(namespace, type);
    const result = await col.update({id}, {$set: {data: util.encodeDocument(data)}});
    return result;
  }
}

module.exports = Database;
