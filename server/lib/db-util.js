module.exports = {};

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
  read: [USER_KEYS.owner],
  write: [USER_KEYS.owner],
  append: [USER_KEYS.owner],
  destroy: [USER_KEYS.owner],
  modify_read: [USER_KEYS.owner],
  modify_write: [USER_KEYS.owner],
  modify_append: [USER_KEYS.owner],
  modify_destroy: [USER_KEYS.owner],
}

const SYSTEM_ACL = module.exports.SYSTEM_ACL = {
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

const PRIVATE_ACL = module.exports.PRIVATE_ACL = Object.assign({}, SYSTEM_ACL, {read: [USER_KEYS.system]});

const CORE_TYPES = module.exports.CORE_TYPES = [{
  id: 'namespace',
  schema: require('./schemas/namespace'),
}, {
  id: 'user',
  schema: require('./schemas/user'),
}, {
  id: 'user_private',
  schema: require('./schemas/user_private'),
}];


const CORE_OBJECTS = module.exports.CORE_OBJECTS = [{
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
  schema: 'user',
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
  schema: 'namespace',
  document: {
    id: 'core',
    info: SYSTEM_INFO,
    acl: SYSTEM_ACL,
    data: {
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
              write: [],
              append: [],
              destroy: [],
              modify_read: [],
              modify_write: [],
              modify_append: [],
              modify_destroy: [],
            }
          },
          namespace: {
            schema: {$ref: '/data/core/schema/namespace'},
            initial_acl: {
              read: [USER_KEYS.all],
              write: [],
              append: [USER_KEYS.owner],
              destroy: [],
              modify_read: [],
              modify_write: [],
              modify_append: [],
              modify_destroy: [],
            }
          },
          user_private: {
            schema: {$ref: '/data/core/schema/user_private'},
            initial_acl: PRIVATE_ACL,
          }
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

module.exports.setRefHost = function(host) {
  let coreNS = CORE_OBJECTS.filter(o => o.namespace === 'core' && o.schema === 'namespace').pop();
  let types = coreNS.document.data.versions[0].types;
  for (let type in types) {
    types[type].schema.$ref = host + types[type].schema.$ref;
  }
}
