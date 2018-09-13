const IDENTITY_SCHEMA = {
  type: 'string',
  minLength: 2,
  maxLength: 100,
}

const ACL_LIST_SCHEMA = {
  type: 'array',
  items: IDENTITY_SCHEMA,
}

const ACL_LIST_WITH_DEFAULT_SCHEMA = Object.assign({}, ACL_LIST_SCHEMA, {default: ['_owner']});

const ACL_SET_SCHEMA = {
  type: 'object',
  default: {},
  additionalProperties: false,
  properties: {
    read:  ACL_LIST_SCHEMA,
    write: ACL_LIST_SCHEMA,
    append: ACL_LIST_SCHEMA,
    delete: ACL_LIST_SCHEMA,
  }
}
const ACL_SET_WITH_DEFAULT_SCHEMA = {
  type: 'object',
  default: {},
  additionalProperties: false,
  properties: {
    read:  ACL_LIST_WITH_DEFAULT_SCHEMA,
    write: ACL_LIST_WITH_DEFAULT_SCHEMA,
    append: ACL_LIST_WITH_DEFAULT_SCHEMA,
    delete: ACL_LIST_WITH_DEFAULT_SCHEMA,
  }
}

const ACL_SCHEMA = module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    owner: IDENTITY_SCHEMA,
    allow: ACL_SET_WITH_DEFAULT_SCHEMA,
    disallow: ACL_SET_SCHEMA,
    modify: ACL_SET_WITH_DEFAULT_SCHEMA,
  },
}

