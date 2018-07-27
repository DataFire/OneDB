module.exports = {};

const crypto = require('crypto');
const validate = require('./validate');

const DOLLAR = "\uFF04";
const KEY_REPLACEMENTS = {
  dollar: {
    encode: /\$/g,
    decode: new RegExp(DOLLAR, 'g'),
    encoded: DOLLAR,
    decoded: '$',
  },
}

const KEY_REGEX = /^(\$ref|\$id|\$comment|\$schema|[A-Za-z]\w*)$/;

const START_TIME = (new Date()).toISOString();

const USER_KEYS = module.exports.USER_KEYS = {
  all: '_all',
  system: '_system',
  owner: '_owner',
}

const SYSTEM_INFO = {
  created: START_TIME,
  updated: START_TIME,
  created_by: USER_KEYS.system,
}

const DEFAULT_ACL = module.exports.DEFAULT_ACL = {
  allow: {
    read: [USER_KEYS.owner],
    write: [USER_KEYS.owner],
    append: [USER_KEYS.owner],
    destroy: [USER_KEYS.owner],
  },
  modify: {
    read: [USER_KEYS.owner],
    write: [USER_KEYS.owner],
    append: [USER_KEYS.owner],
    destroy: [USER_KEYS.owner],
  }
}

const SYSTEM_ACL = module.exports.SYSTEM_ACL = {
  owner: USER_KEYS.system,
  allow: {
    read: [USER_KEYS.all],
    write: [USER_KEYS.system],
    append: [USER_KEYS.system],
    destroy: [USER_KEYS.system],
  },
  modify: {
    read: [USER_KEYS.system],
    write: [USER_KEYS.system],
    append: [USER_KEYS.system],
    destroy: [USER_KEYS.system],
  }
};

const PRIVATE_ACL = module.exports.PRIVATE_ACL = JSON.parse(JSON.stringify(SYSTEM_ACL));
delete PRIVATE_ACL.owner;
PRIVATE_ACL.allow.read = [USER_KEYS.system];

const CORE_SCHEMAS = module.exports.CORE_SCHEMAS = {
  namespace:  require('../namespaces/core/namespace'),
  user: require('../namespaces/core/user'),
  user_private: require('../namespaces/core/user_private'),
  schema: JSON.parse(JSON.stringify(require('../namespaces/core/schema'))),
}
CORE_SCHEMAS.namespace.definitions = {schema: JSON.parse(JSON.stringify(CORE_SCHEMAS.schema))};
Object.assign(CORE_SCHEMAS.namespace.definitions, CORE_SCHEMAS.schema.definitions);
function rewriteCoreSchema(schema) {
  if (schema.$ref === '#') schema.$ref = '#/definitions/schema';
  if (schema.properties) {
    for (let key in schema.properties) rewriteCoreSchema(schema.properties[key]);
  }
  if (schema.definitions) {
    for (let key in schema.definitions) rewriteCoreSchema(schema.definitions[key]);
  }
  (schema.anyOf || []).forEach(rewriteCoreSchema);
  (schema.allOf || []).forEach(rewriteCoreSchema);
  (schema.oneOf || []).forEach(rewriteCoreSchema);
  if (schema.items) rewriteCoreSchema(schema.items);
  if (schema.additionalProperties) rewriteCoreSchema(schema.additionalProperties);
}
delete CORE_SCHEMAS.namespace.definitions.schema.definitions;
delete CORE_SCHEMAS.namespace.definitions.schema.$id;
rewriteCoreSchema(CORE_SCHEMAS.namespace.definitions.schema);

const CORE_OBJECTS = module.exports.CORE_OBJECTS = [{
  namespace: 'core',
  type: 'user',
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
  type: 'user',
  document: {
    id: USER_KEYS.all,
    info: SYSTEM_INFO,
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
    info: SYSTEM_INFO,
    acl: SYSTEM_ACL,
    data: {
      versions: [{
        version: '0',
        types: {
          user: {
            schema: {$ref: '/data/core/schema/user'},
            initial_acl: {
              allow: {
                read: [USER_KEYS.all],
                write: [USER_KEYS.owner],
              }
            }
          },
          schema: {
            schema: {$ref: '/data/core/schema/schema'},
            initial_acl: {
              allow: {
                read: [USER_KEYS.all],
                write: [],
                append: [],
                destroy: [],
              },
              modify: {
                read: [],
                write: [],
                append: [],
                destroy: [],
              }
            }
          },
          namespace: {
            schema: {$ref: '/data/core/schema/namespace'},
            initial_acl: {
              allow: {
                read: [USER_KEYS.all],
                write: [],
                //append: [USER_KEYS.owner],  TODO: enable append for versioning
                append: [],
                destroy: [],
              },
              modify: {
                read: [],
                write: [],
                append: [],
                destroy: [],
              }
            }
          },
          user_private: {
            schema: {$ref: '/data/core/schema/user_private'},
            initial_acl: Object.assign({owner: undefined}, PRIVATE_ACL),
          }
        },
      }],
    }
  }
}, {
  namespace: 'core',
  type: 'schema',
  document: {
    id: 'schema',
    info: SYSTEM_INFO,
    acl: SYSTEM_ACL,
    data: require('../namespaces/core/schema'),
  }
}]

module.exports.setRefHost = function(host) {
  let coreNS = CORE_OBJECTS.filter(o => o.namespace === 'core' && o.type === 'namespace').pop();
  let types = coreNS.document.data.versions[0].types;
  for (let type in types) {
    types[type].schema.$ref = host + types[type].schema.$ref;
  }
}

module.exports.encodeDocument = function(schema) {
  if (typeof schema !== 'object' || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(module.exports.encodeDocument);
  let obj = {};
  for (let key in schema) {
    if (!KEY_REGEX.test(key)) throw new Error(`Object key ${key} is invalid`);
    let newKey = key;
    for (let replaceKey in KEY_REPLACEMENTS) {
      let replacement = KEY_REPLACEMENTS[replaceKey];
      newKey = newKey.replace(replacement.encode, replacement.encoded);
    }
    obj[newKey] = module.exports.encodeDocument(schema[key]);
  }
  return obj;
}

module.exports.decodeDocument = function(schema) {
  if (typeof schema !== 'object' || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(module.exports.decodeDocument);
  let obj = {};
  for (let key in schema) {
    let newKey = key;
    for (let replaceKey in KEY_REPLACEMENTS) {
      let replacement = KEY_REPLACEMENTS[replaceKey];
      newKey = newKey.replace(replacement.decode, replacement.decoded);
    }
    obj[newKey] = module.exports.decodeDocument(schema[key]);
  }
  return obj;
}

const SALT_LENGTH = 32;
const VERIFICATION_ID_LENGTH = 16;
const ITERATIONS = 25000;
const KEY_LENGTH = 512;
const DIGEST_ALGO = 'sha256'

module.exports.computeCredentials = (password) => {
  return new Promise((resolve, reject) => {
    let result = {};
    crypto.randomBytes(SALT_LENGTH, (err, buf) => {
      if (err) return reject(err);
      result.salt = buf.toString('hex');
      crypto.randomBytes(VERIFICATION_ID_LENGTH, (err, buf) => {
        if (err) return reject(err);
        result.verificationID = buf.toString('hex');
        crypto.pbkdf2(password, result.salt, ITERATIONS, KEY_LENGTH, DIGEST_ALGO, (err, hashRaw) => {
          if (err) return reject(err);
          result.hash = new Buffer(hashRaw, 'binary').toString('hex');
          resolve(result);
        });
      });
    });
  });
}

module.exports.checkPassword = (password, hash, salt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST_ALGO, (err, hashRaw) => {
      if (err) return reject(err);
      let compHash = new Buffer(hashRaw, 'binary').toString('hex');
      resolve(compHash === hash);
    })
  });
}
