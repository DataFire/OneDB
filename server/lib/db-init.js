const dbUtil = require('./db-util');

const CORE_SCHEMAS = module.exports.CORE_SCHEMAS = {
  namespace:  require('../namespaces/core/namespace'),
  schema: require('../namespaces/core/schema'),
  authorization_token: require('../namespaces/system/authorization_token'),
  user: require('../namespaces/system/user'),
  user_private: require('../namespaces/system/user_private'),
}
for (let key in CORE_SCHEMAS) {
  let schema = CORE_SCHEMAS[key];
  if (key === 'schema') schema = schema.oneOf[1];
  schema.properties.$ = {type: 'object'};
}

let schemaSchemaCopy = JSON.parse(JSON.stringify(CORE_SCHEMAS.schema));
delete schemaSchemaCopy.definitions;
let definitions = Object.assign({
  schema: schemaSchemaCopy
}, CORE_SCHEMAS.schema.definitions);
CORE_SCHEMAS.namespace.definitions = CORE_SCHEMAS.schema.definitions = definitions;

module.exports.CORE_OBJECTS = [];
for (let key in CORE_SCHEMAS) {
  module.exports.CORE_OBJECTS.push({
    namespace: 'core',
    type: 'schema',
    document: {
      id: key,
      info: dbUtil.SYSTEM_INFO,
      acl: Object.assign({owner: dbUtil.USER_KEYS.system}, dbUtil.READ_ONLY_ACL_SET),
      data: CORE_SCHEMAS[key],
    }
  })
}

module.exports.CORE_OBJECTS = module.exports.CORE_OBJECTS.concat([{
  namespace: 'system',
  type: 'user',
  document: {
    id: dbUtil.USER_KEYS.system,
    info: dbUtil.SYSTEM_INFO,
    acl: Object.assign({owner: dbUtil.USER_KEYS.system}, dbUtil.READ_ONLY_ACL_SET),
    data: {}
  }
}, {
  namespace: 'system',
  type: 'user',
  document: {
    id: dbUtil.USER_KEYS.all,
    info: dbUtil.SYSTEM_INFO,
    acl: Object.assign({owner: dbUtil.USER_KEYS.system}, dbUtil.READ_ONLY_ACL_SET),
    data: {}
  }
}, {
  namespace: 'core',
  type: 'namespace',
  document: {
    id: 'system',
    info: dbUtil.SYSTEM_INFO,
    acl: Object.assign({owner: dbUtil.USER_KEYS.system}, dbUtil.READ_ONLY_ACL_SET),
    data: {
      versions: [{
        version: '0',
        types: {
          user: {
            schema: {$ref: '/data/core/schema/user'},
            initial_acl: {
              allow: {
                read: [dbUtil.USER_KEYS.all],
                write: [dbUtil.USER_KEYS.owner],
              },
              modify: dbUtil.SYSTEM_ACL,
            }
          },
          user_private: {
            schema: {$ref: '/data/core/schema/user_private'},
            initial_acl: dbUtil.PRIVATE_ACL_SET,
          },
          authorization_token: {
            schema: {$ref: '/data/core/schema/authorization_token'},
            initial_acl: dbUtil.PRIVATE_ACL_SET,
          },
        }
      }]
    }
  }
}, {
  namespace: 'core',
  type: 'namespace',
  document: {
    id: 'core',
    info: dbUtil.SYSTEM_INFO,
    acl: Object.assign({owner: dbUtil.USER_KEYS.system}, dbUtil.READ_ONLY_ACL_SET),
    data: {
      versions: [{
        version: '0',
        types: {
          schema: {
            schema: {$ref: '/data/core/schema/schema'},
            initial_acl: dbUtil.READ_ONLY_ACL_SET,
          },
          namespace: {
            schema: {$ref: '/data/core/schema/namespace'},
            initial_acl: {
              allow: Object.assign({}, dbUtil.READ_ONLY_ACL, {append: ['_owner']}),
              modify: dbUtil.SYSTEM_ACL,
            }
          },
        },
      }],
    }
  }
}, {
  namespace: 'core',
  type: 'schema',
  document: {
    id: 'schema',
    info: dbUtil.SYSTEM_INFO,
    acl: Object.assign({owner: dbUtil.USER_KEYS.system}, dbUtil.READ_ONLY_ACL_SET),
    data: require('../namespaces/core/schema'),
  }
}]);

